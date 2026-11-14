/**
 * Reader for the pipeline's click-lookup grid (scripts/pipeline/export.py → build_grid):
 *   /data/scan_grid_meta.json  — layout, band list, scale/offset per band, nodata, origin, step
 *   /data/<meta.file>          — e.g. scan_grid.bin.gz; gzip-compressed when meta.encoding = "gzip"
 *
 * Everything about the layout is read from the meta file; nothing is assumed here except the
 * documented decode rule (`value = offset + scale × q`, `q = nodata` → no data; a "limiting" band
 * stores an index into its `categories`). Values are uint8-quantised by the pipeline, so they are
 * approximations of the 0.25° data at 0.5° resolution.
 *
 * This is the same data as the map overlays: the point inspector's Analog Score comes from here.
 * When the files are absent the inspector shows "from global scan (pending)".
 */
import { TARGET_IDS, type TargetId } from "./types";
import { DATA_BASE, fetchOptionalJson, isObj, num, once, str } from "./pipelineFiles";

export const SCAN_GRID_META_URL = `${DATA_BASE}scan_grid_meta.json`;

export type BandKind = "feature" | "score" | "dim" | "limiting" | "mask" | "flag";

export interface ScanBand {
  index: number;
  name: string;
  kind: BandKind;
  units: string | null;
  scale: number;
  offset: number;
  target?: TargetId;
  dim?: string;
  categories?: string[];
}

export interface ScanGridMeta {
  file: string;
  encoding: "gzip" | "raw";
  nlat: number;
  nlon: number;
  stepDeg: number;
  latNorth: number;
  lonWest: number;
  nodata: number;
  configVersion: number | null;
  generated: string | null;
  bands: ScanBand[];
  /** overlays[target].transparent_below from the meta: scores below it are transparent in the PNG */
  overlayTransparentBelow?: Partial<Record<TargetId, number>>;
}

export class ScanGridFormatError extends Error {
  constructor(detail: string) {
    super(`Invalid scan grid: ${detail}`);
    this.name = "ScanGridFormatError";
  }
}

const BAND_KINDS: readonly BandKind[] = ["feature", "score", "dim", "limiting", "mask", "flag"];

export function parseScanGridMeta(json: unknown): ScanGridMeta | null {
  if (!isObj(json) || !Array.isArray(json.bands)) return null;
  const file = str(json.file);
  const nlat = num(json.nlat);
  const nlon = num(json.nlon);
  const step = num(json.step_deg);
  const origin = isObj(json.origin) ? json.origin : {};
  const latNorth = num(origin.lat_north);
  const lonWest = num(origin.lon_west);
  const nodata = num(json.nodata);
  if (!file || !nlat || !nlon || !step || latNorth === null || lonWest === null || nodata === null) return null;

  // Per-target overlay cutoff: scores below it are transparent in the PNG (still scored).
  const overlayTransparentBelow: Partial<Record<TargetId, number>> = {};
  if (isObj(json.overlays)) {
    for (const t of TARGET_IDS) {
      const o = json.overlays[t];
      const v = isObj(o) ? num(o.transparent_below) : null;
      if (v !== null) overlayTransparentBelow[t] = v;
    }
  }

  const bands: ScanBand[] = [];
  json.bands.forEach((b, i) => {
    if (!isObj(b)) return;
    const name = str(b.name);
    const kind = BAND_KINDS.find((k) => k === b.kind);
    const scale = num(b.scale);
    const offset = num(b.offset);
    if (!name || !kind || scale === null || offset === null) return;
    const target = TARGET_IDS.find((t) => t === b.target);
    bands.push({
      index: num(b.index) ?? i,
      name,
      kind,
      units: str(b.units),
      scale,
      offset,
      ...(target ? { target } : {}),
      ...(str(b.dim) ? { dim: b.dim as string } : {}),
      ...(Array.isArray(b.categories) ? { categories: b.categories.filter((c): c is string => typeof c === "string") } : {}),
    });
  });
  return {
    file,
    encoding: json.encoding === "gzip" ? "gzip" : "raw",
    nlat,
    nlon,
    stepDeg: step,
    latNorth,
    lonWest,
    nodata,
    configVersion: num(json.config_version),
    generated: str(json.generated),
    bands,
    overlayTransparentBelow,
  };
}

// ---------- Lookup ----------

export interface FeatureSample {
  value: number | null;
  units: string | null;
}

export interface TargetSample {
  total: number | null;
  dims: Record<string, number | null>;
  limiting: string | null;
}

export interface ScanGridSample {
  /** centre of the 0.5° grid cell that contains the point */
  cellLat: number;
  cellLon: number;
  /** null when the grid has no land band */
  land: boolean | null;
  features: Record<string, FeatureSample>;
  targets: Partial<Record<TargetId, TargetSample>>;
  /** "ndvi_imputed" flag band (null/absent when the grid has no such band or no data) */
  ndviImputed?: boolean | null;
}

export interface ScanGrid {
  meta: ScanGridMeta;
  sample: (lat: number, lon: number) => ScanGridSample;
  /**
   * Percentile of the cell's Analog Score among all scored land cells of THIS grid (0.5°,
   * uint8-quantised): 100 × (n_below + 0.5 × n_equal) / n — the pipeline's formula, applied to the
   * published grid. null when the cell has no score.
   */
  percentile: (target: TargetId, lat: number, lon: number) => number | null;
}

/** Row/col of the cell containing (lat, lon); longitudes are wrapped, latitudes clamped. */
export function cellIndex(meta: Pick<ScanGridMeta, "nlat" | "nlon" | "stepDeg" | "latNorth" | "lonWest">, lat: number, lon: number) {
  const span = meta.nlon * meta.stepDeg;
  const wrapped = ((((lon - meta.lonWest) % span) + span) % span) + meta.lonWest;
  const row = Math.min(meta.nlat - 1, Math.max(0, Math.floor((meta.latNorth - lat) / meta.stepDeg)));
  const col = Math.min(meta.nlon - 1, Math.max(0, Math.floor((wrapped - meta.lonWest) / meta.stepDeg)));
  return { row, col };
}

export function decodeScanGrid(meta: ScanGridMeta, bytes: Uint8Array): ScanGrid {
  const plane = meta.nlat * meta.nlon;
  const nBands = meta.bands.reduce((m, b) => Math.max(m, b.index + 1), 0);
  if (bytes.length < nBands * plane) {
    throw new ScanGridFormatError(`expected ≥ ${nBands * plane} bytes for ${nBands} bands, got ${bytes.length}`);
  }

  const read = (band: ScanBand, cell: number): number | null => {
    const q = bytes[band.index * plane + cell];
    return q === meta.nodata ? null : band.offset + band.scale * q;
  };
  const readCategory = (band: ScanBand, cell: number): string | null => {
    const q = bytes[band.index * plane + cell];
    return q === meta.nodata ? null : (band.categories?.[q] ?? null);
  };

  const sample = (lat: number, lon: number): ScanGridSample => {
    const { row, col } = cellIndex(meta, lat, lon);
    const cell = row * meta.nlon + col;
    const features: Record<string, FeatureSample> = {};
    const targets: Partial<Record<TargetId, TargetSample>> = {};
    const tgt = (t: TargetId) => (targets[t] ??= { total: null, dims: {}, limiting: null });
    let land: boolean | null = null;
    let ndviImputed: boolean | null = null;

    for (const band of meta.bands) {
      switch (band.kind) {
        case "feature":
          features[band.name] = { value: read(band, cell), units: band.units };
          break;
        case "score":
          if (band.target) tgt(band.target).total = read(band, cell);
          break;
        case "dim":
          if (band.target && band.dim) tgt(band.target).dims[band.dim] = read(band, cell);
          break;
        case "limiting":
          if (band.target) tgt(band.target).limiting = readCategory(band, cell);
          break;
        case "mask":
          if (band.name === "land") land = read(band, cell) === 1;
          break;
        case "flag":
          if (band.name === "ndvi_imputed") {
            const v = read(band, cell);
            ndviImputed = v === null ? null : v === 1;
          }
          break;
      }
    }
    return {
      cellLat: meta.latNorth - (row + 0.5) * meta.stepDeg,
      cellLon: meta.lonWest + (col + 0.5) * meta.stepDeg,
      land,
      features,
      targets,
      ndviImputed,
    };
  };

  // Per-target histogram of quantised scores over land cells (built lazily, once).
  const landBand = meta.bands.find((b) => b.kind === "mask" && b.name === "land");
  const histograms = new Map<TargetId, { counts: Uint32Array; n: number }>();
  const histogram = (band: ScanBand) => {
    const target = band.target as TargetId;
    let h = histograms.get(target);
    if (!h) {
      const counts = new Uint32Array(256);
      let n = 0;
      for (let cell = 0; cell < plane; cell++) {
        if (landBand && bytes[landBand.index * plane + cell] !== 1) continue;
        const q = bytes[band.index * plane + cell];
        if (q === meta.nodata) continue;
        counts[q]++;
        n++;
      }
      h = { counts, n };
      histograms.set(target, h);
    }
    return h;
  };

  const percentile = (target: TargetId, lat: number, lon: number): number | null => {
    const band = meta.bands.find((b) => b.kind === "score" && b.target === target);
    if (!band) return null;
    const { row, col } = cellIndex(meta, lat, lon);
    const q = bytes[band.index * plane + row * meta.nlon + col];
    if (q === meta.nodata) return null;
    const { counts, n } = histogram(band);
    if (n === 0) return null;
    let below = 0;
    for (let i = 0; i < q; i++) if (i !== meta.nodata) below += counts[i];
    return (100 * (below + 0.5 * counts[q])) / n;
  };

  return { meta, sample, percentile };
}

// ---------- Loading ----------

export async function gunzip(data: ArrayBuffer | Uint8Array): Promise<Uint8Array> {
  const stream = new Blob([data as BlobPart]).stream().pipeThrough(new DecompressionStream("gzip"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

export type ScanGridState =
  | { status: "pending" }
  | { status: "ready"; grid: ScanGrid }
  | { status: "error"; message: string };

export async function fetchScanGrid(fetchImpl: typeof fetch = fetch): Promise<ScanGridState> {
  const meta = parseScanGridMeta(await fetchOptionalJson(SCAN_GRID_META_URL, fetchImpl));
  if (!meta) return { status: "pending" };
  let res: Response;
  try {
    res = await fetchImpl(`${DATA_BASE}${meta.file}`, { cache: "no-store" });
  } catch {
    return { status: "pending" };
  }
  if (!res.ok) return { status: "pending" };
  try {
    const buf = await res.arrayBuffer();
    const bytes = meta.encoding === "gzip" ? await gunzip(buf) : new Uint8Array(buf);
    return { status: "ready", grid: decodeScanGrid(meta, bytes) };
  } catch (e) {
    return { status: "error", message: e instanceof Error ? e.message : String(e) };
  }
}

const gridOnce = once(() => fetchScanGrid());

/** Shared, cached: the grid is fetched (≤ 8 MB) only when first needed. */
export const loadScanGrid = gridOnce.get;
export const resetScanGridCache = gridOnce.reset;

// ---------- Overlays ----------

/** Pipeline overlays are Web Mercator PNGs spanning the full Mercator latitude range. */
export const SCAN_OVERLAY_BOUNDS: [[number, number], [number, number]] = [
  [-85.0511, -180],
  [85.0511, 180],
];

export const scanOverlayUrl = (target: TargetId) => `${DATA_BASE}scan_${target}.png`;

/** HEAD check: does the pipeline overlay for `target` exist? */
export async function overlayExists(target: TargetId, fetchImpl: typeof fetch = fetch): Promise<boolean> {
  try {
    const res = await fetchImpl(scanOverlayUrl(target), { method: "HEAD", cache: "no-store" });
    return res.ok && (res.headers.get("content-type") ?? "image/png").startsWith("image/");
  } catch {
    return false;
  }
}
