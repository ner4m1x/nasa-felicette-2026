/**
 * NASA POWER climatology client (source id "nasa-power").
 *
 * Verified with curl on 2026-11-14 (API v2.10.1):
 *   GET https://power.larc.nasa.gov/api/temporal/climatology/point
 *       ?parameters=TS,TS_MAX,TS_MIN,PRECTOTCORR,ALLSKY_SFC_SW_DWN&community=RE
 *       &latitude={lat}&longitude={lon}&format=JSON
 *   → 200, `access-control-allow-origin: *` (no proxy needed).
 *   Body: properties.parameter[ID] = { JAN … DEC, ANN }, parameters[ID] = { units, longname },
 *   header.fill_value (-999), header.range (climatology period).
 *
 * Units, long names, the fill value and the period are always read from the response — never
 * hard-coded here. Fill values become null and render as "—".
 *
 * Cache: key = coordinates rounded to CACHE_GRID_DEG; in memory + sessionStorage (try/catch).
 * Network: REQUEST_TIMEOUT_MS per attempt, one retry.
 */

export const POWER_ENDPOINT = "https://power.larc.nasa.gov/api/temporal/climatology/point";
export const POWER_PARAMETERS = ["TS", "TS_MAX", "TS_MIN", "PRECTOTCORR", "ALLSKY_SFC_SW_DWN"] as const;
export type PowerParameterId = (typeof POWER_PARAMETERS)[number];

/** Requests are snapped to this grid (degrees): POWER's coarsest source grid is ~0.5–1°. */
export const CACHE_GRID_DEG = 0.5;
export const REQUEST_TIMEOUT_MS = 10_000;
export const MAX_ATTEMPTS = 2;

const MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"] as const;
const SESSION_PREFIX = "purr.power.";

export interface PowerParameter {
  units: string;
  longname: string;
  annual: number | null;
  monthly: (number | null)[];
}

export interface PowerClimatology {
  /** the (rounded) coordinates actually queried */
  lat: number;
  lon: number;
  /** climatology period as stated by the API, e.g. "25-year … (January 2001 - December 2025)" */
  range: string | null;
  apiVersion: string | null;
  /** parameter id -> { units, longname, annual, monthly[12] }, all taken from the API response */
  parameters: Record<string, PowerParameter>;
}

export class PowerUnavailableError extends Error {
  constructor(detail: string) {
    super(`NASA POWER unavailable: ${detail}`);
    this.name = "PowerUnavailableError";
  }
}

// ---------- Pure helpers ----------

export function snapToGrid(value: number, step = CACHE_GRID_DEG): number {
  const snapped = Math.round(value / step) * step;
  return Object.is(snapped, -0) ? 0 : snapped;
}

export function cacheKey(lat: number, lon: number): string {
  return `${snapToGrid(lat).toFixed(1)},${snapToGrid(lon).toFixed(1)}`;
}

export function powerUrl(lat: number, lon: number): string {
  const q = new URLSearchParams({
    parameters: POWER_PARAMETERS.join(","),
    community: "RE",
    latitude: String(snapToGrid(lat)),
    longitude: String(snapToGrid(lon)),
    format: "JSON",
  });
  return `${POWER_ENDPOINT}?${q.toString()}`;
}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null;

/** Parse a POWER climatology JSON body. Throws PowerUnavailableError on an unexpected shape. */
export function parsePowerResponse(json: unknown, lat: number, lon: number): PowerClimatology {
  if (!isObj(json) || !isObj(json.properties) || !isObj(json.properties.parameter)) {
    throw new PowerUnavailableError("unexpected response shape");
  }
  const header = isObj(json.header) ? json.header : {};
  const fill = typeof header.fill_value === "number" ? header.fill_value : null;
  const meta = isObj(json.parameters) ? json.parameters : {};
  const values = json.properties.parameter;

  const clean = (v: unknown): number | null =>
    typeof v === "number" && Number.isFinite(v) && v !== fill ? v : null;

  const parameters: Record<string, PowerParameter> = {};
  for (const [id, series] of Object.entries(values)) {
    if (!isObj(series)) continue;
    const m = isObj(meta[id]) ? meta[id] : {};
    parameters[id] = {
      units: typeof m.units === "string" ? m.units : "",
      longname: typeof m.longname === "string" ? m.longname : id,
      annual: clean(series.ANN),
      monthly: MONTHS.map((mo) => clean(series[mo])),
    };
  }
  if (Object.keys(parameters).length === 0) throw new PowerUnavailableError("no parameters in response");

  const api = isObj(header.api) ? header.api : {};
  return {
    lat: snapToGrid(lat),
    lon: snapToGrid(lon),
    range: typeof header.range === "string" ? header.range : null,
    apiVersion: typeof api.version === "string" ? api.version : null,
    parameters,
  };
}

// ---------- Cache ----------

const memoryCache = new Map<string, PowerClimatology>();
const inFlight = new Map<string, Promise<PowerClimatology>>();

function readSession(key: string): PowerClimatology | null {
  try {
    const raw = window.sessionStorage.getItem(SESSION_PREFIX + key);
    return raw ? (JSON.parse(raw) as PowerClimatology) : null;
  } catch {
    return null;
  }
}

function writeSession(key: string, value: PowerClimatology): void {
  try {
    window.sessionStorage.setItem(SESSION_PREFIX + key, JSON.stringify(value));
  } catch {
    // storage blocked or full: the memory cache still works
  }
}

export function clearPowerCache(): void {
  memoryCache.clear();
  inFlight.clear();
}

/** Synchronous cache lookup (memory, then sessionStorage). */
export function cachedPowerClimatology(lat: number, lon: number): PowerClimatology | null {
  const key = cacheKey(lat, lon);
  const hit = memoryCache.get(key) ?? (typeof window !== "undefined" ? readSession(key) : null);
  if (hit) memoryCache.set(key, hit);
  return hit;
}

// ---------- Network ----------

export interface FetchPowerOptions {
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
  signal?: AbortSignal;
}

async function attempt(url: string, fetchImpl: typeof fetch, timeoutMs: number, outer?: AbortSignal) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  const onOuterAbort = () => ctrl.abort();
  outer?.addEventListener("abort", onOuterAbort);
  try {
    const res = await fetchImpl(url, { signal: ctrl.signal });
    if (!res.ok) throw new PowerUnavailableError(`HTTP ${res.status}`);
    return (await res.json()) as unknown;
  } finally {
    clearTimeout(timer);
    outer?.removeEventListener("abort", onOuterAbort);
  }
}

/**
 * Fetch the POWER climatology for a point (snapped to CACHE_GRID_DEG), with cache, a timeout and
 * one retry. Rejects with PowerUnavailableError when the service cannot be reached.
 */
export async function fetchPowerClimatology(
  lat: number,
  lon: number,
  options: FetchPowerOptions = {},
): Promise<PowerClimatology> {
  const key = cacheKey(lat, lon);
  const cached = cachedPowerClimatology(lat, lon);
  if (cached) return cached;
  const pending = inFlight.get(key);
  if (pending) return pending;

  const fetchImpl = options.fetchImpl ?? fetch;
  const timeoutMs = options.timeoutMs ?? REQUEST_TIMEOUT_MS;
  const url = powerUrl(lat, lon);

  const run = async () => {
    let lastError: unknown = null;
    for (let i = 0; i < MAX_ATTEMPTS; i++) {
      if (options.signal?.aborted) break;
      try {
        const result = parsePowerResponse(await attempt(url, fetchImpl, timeoutMs, options.signal), lat, lon);
        memoryCache.set(key, result);
        if (typeof window !== "undefined") writeSession(key, result);
        return result;
      } catch (e) {
        lastError = e;
      }
    }
    throw lastError instanceof PowerUnavailableError
      ? lastError
      : new PowerUnavailableError(lastError instanceof Error ? lastError.message : "request failed");
  };

  const promise = run().finally(() => inFlight.delete(key));
  inFlight.set(key, promise);
  return promise;
}
