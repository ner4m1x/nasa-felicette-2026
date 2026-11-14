/**
 * Source resolution for `DeckCard.sourceIds`.
 *
 * Two registries, looked up in this order:
 *  1. Literature and web sources: src/data/sources.ts (hand-curated citations).
 *  2. Datasets used by the pipeline: /data/manifest.json, written by `global_scan.py export`.
 *     Its `datasets` map is keyed by an internal name; each entry carries a `source_id` (e.g.
 *     "MOD13C2.061", "ETOPO_2022_60s", "GLiM") — the id that deck cards reference. Names,
 *     versions and DOIs come from the dataset metadata the pipeline downloaded (never typed here).
 *  3. Anything else is "unknown" and is rendered as plain text — never a crash.
 */
import { getSource, type SourceEntry } from "@/data/sources";
import { DATA_BASE, fetchOptionalJson, isObj, num, once, str } from "./pipelineFiles";

export const MANIFEST_URL = `${DATA_BASE}manifest.json`;

export interface DatasetEntry {
  /** the id deck cards use, e.g. "MOD13C2.061" */
  sourceId: string;
  shortName: string;
  version: string | null;
  title: string | null;
  /** bare DOI as recorded by the pipeline (paper DOI for non-Earthdata sources) */
  doi: string | null;
  datasetDoi: string | null;
  /** best human-facing link: DOI resolver, else landing page, else download URL */
  url: string | null;
  role: string | null;
  temporalRange: string | null;
}

export interface Manifest {
  pipelineVersion: string | null;
  runTimestamp: string | null;
  years: number[];
  configCommit: string | null;
  /** keyed by sourceId */
  datasets: Record<string, DatasetEntry>;
}

/** "10.5067/…", "doi:10.5067/…" or "https://doi.org/10.5067/…" → resolver URL; null otherwise. */
export function doiUrl(doi: string | null): string | null {
  if (!doi) return null;
  const bare = doi
    .trim()
    .replace(/^doi:\s*/i, "")
    .replace(/^https?:\/\/(dx\.)?doi\.org\//i, "");
  return /^10\.\d{4,}\/\S+$/.test(bare) ? `https://doi.org/${bare}` : null;
}

function temporal(v: unknown): string | null {
  if (typeof v === "string") return str(v);
  if (Array.isArray(v)) {
    // the pipeline writes [first granule begin, last granule end]; either may be null
    const parts = v.map((x) => str(x));
    return parts.some((x) => x !== null) ? parts.map((x) => x ?? "…").join(" – ") : null;
  }
  if (isObj(v)) {
    const a = str(v.start) ?? str(v.begin) ?? str(v.BeginningDateTime);
    const b = str(v.end) ?? str(v.EndingDateTime);
    return a || b ? `${a ?? "…"} – ${b ?? "…"}` : null;
  }
  return null;
}

/** Parse manifest.json leniently: malformed dataset entries are skipped, never thrown. */
export function parseManifest(json: unknown): Manifest | null {
  if (!isObj(json) || !isObj(json.datasets)) return null;
  const datasets: Record<string, DatasetEntry> = {};
  for (const [key, raw] of Object.entries(json.datasets)) {
    if (!isObj(raw)) continue;
    const sourceId = str(raw.source_id) ?? key;
    const doi = str(raw.doi);
    const datasetDoi = str(raw.dataset_doi);
    datasets[sourceId] = {
      sourceId,
      shortName: str(raw.short_name) ?? key,
      version: str(raw.version) ?? (num(raw.version) !== null ? String(raw.version) : null),
      title: str(raw.title),
      doi,
      datasetDoi,
      url: doiUrl(datasetDoi) ?? doiUrl(doi) ?? str(raw.landing_url) ?? str(raw.url),
      role: str(raw.role),
      temporalRange: temporal(raw.temporal_range),
    };
  }
  const config = isObj(json.config) ? json.config : {};
  return {
    pipelineVersion: str(json.pipeline_version) ?? (num(json.pipeline_version) !== null ? String(json.pipeline_version) : null),
    runTimestamp: str(json.run_timestamp),
    years: Array.isArray(json.years) ? json.years.filter((y): y is number => typeof y === "number") : [],
    configCommit: str(config.commit),
    datasets,
  };
}

export type ResolvedSource =
  | { kind: "literature"; id: string; entry: SourceEntry }
  | { kind: "dataset"; id: string; entry: DatasetEntry }
  | { kind: "unknown"; id: string };

export function resolveSource(id: string, manifest: Manifest | null): ResolvedSource {
  const lit = getSource(id);
  if (lit) return { kind: "literature", id, entry: lit };
  const ds = manifest?.datasets[id];
  if (ds) return { kind: "dataset", id, entry: ds };
  return { kind: "unknown", id };
}

const manifestOnce = once(async () => parseManifest(await fetchOptionalJson(MANIFEST_URL)));

/** /data/manifest.json, or null when the pipeline has not published it. Shared, cached. */
export const loadManifest = manifestOnce.get;
export const resetManifestCache = manifestOnce.reset;
