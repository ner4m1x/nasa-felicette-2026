/**
 * Optional files published by the Python pipeline into /public/data (served at /data/…).
 * Each one may be absent (not published yet): absence is a normal state, never an error.
 */

export const DATA_BASE = "/data/";

/** Fetch a JSON file; null when it is missing, unreachable or not valid JSON. */
export async function fetchOptionalJson(url: string, fetchImpl: typeof fetch = fetch): Promise<unknown | null> {
  try {
    const res = await fetchImpl(url, { cache: "no-store" });
    if (!res.ok) return null;
    return (await res.json()) as unknown;
  } catch {
    return null;
  }
}

export const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null;
export const str = (v: unknown): string | null => (typeof v === "string" && v.trim() !== "" ? v : null);
export const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);

/** Memoise an async loader so every caller shares one request (reset only in tests). */
export function once<T>(load: () => Promise<T>): { get: () => Promise<T>; reset: () => void } {
  let p: Promise<T> | null = null;
  return {
    get: () => (p ??= load()),
    reset: () => {
      p = null;
    },
  };
}
