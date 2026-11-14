/**
 * "Why is the Analog Score so low?" — a one-line reason built from the weakest dimension(s) and
 * their real grid values (display only; never changes a score).
 *
 * - Shown when the Analog Score is below LOW_SCORE (0..1).
 * - Items: the limiting dimension first, then the next weakest dimension below WEAK_DIM, at most
 *   MAX_ITEMS in total. The direction ("too high" / "too low") is read from the frozen scoring
 *   config (/public/data/scoring_config.json, imported read-only): a low lower_better score means
 *   the value is too high, a low higher_better score means it is too low, and a band compares the
 *   value with the band's full range.
 */
import SCORING from "../../public/data/scoring_config.json";
import { TARGETS } from "@/data/targets";
import type { ScanGridSample } from "./scanGrid";
import type { TargetId } from "./types";

/** UI thresholds (display only), stated openly. */
export const LOW_SCORE = 0.15;
export const WEAK_DIM = 0.3;
export const MAX_ITEMS = 2;

export type Direction = "high" | "low";

export interface LowScoreItem {
  feature: string;
  dir: Direction;
  value: number | null;
}

export interface LowScoreReason {
  body: "moon" | "mars";
  items: LowScoreItem[];
}

interface DimConfig {
  feature: string;
  id?: string;
  type: "lower_better" | "higher_better" | "band";
  full_low?: number;
  full_high?: number;
}

const DIMS = (SCORING as unknown as { targets: Record<string, { dims: DimConfig[] }> }).targets;

export function direction(dim: DimConfig, value: number | null): Direction {
  if (dim.type === "lower_better") return "high";
  if (dim.type === "higher_better") return "low";
  return value !== null && dim.full_low !== undefined && value < dim.full_low ? "low" : "high";
}

export function lowScoreReason(
  target: TargetId,
  total: number | null,
  dims: Readonly<Record<string, number | null>>,
  limiting: string | null,
  features: Readonly<Record<string, number | null>>,
): LowScoreReason | null {
  if (total === null || total >= LOW_SCORE) return null;
  const config = DIMS[target]?.dims ?? [];
  const byId = new Map(config.map((d) => [d.id ?? d.feature, d] as const));
  const scored = Object.entries(dims)
    .filter((e): e is [string, number] => e[1] !== null && byId.has(e[0]))
    .sort((a, b) => a[1] - b[1]);
  const ids: string[] = [];
  if (limiting && byId.has(limiting)) ids.push(limiting);
  for (const [id, s] of scored) {
    if (ids.length >= MAX_ITEMS) break;
    if (!ids.includes(id) && (ids.length === 0 || s < WEAK_DIM)) ids.push(id);
  }
  if (ids.length === 0) return null;
  return {
    body: TARGETS[target].body,
    items: ids.map((id) => {
      const d = byId.get(id)!;
      const value = features[d.feature] ?? null;
      return { feature: d.feature, dir: direction(d, value), value };
    }),
  };
}

export function lowScoreFromSample(sample: ScanGridSample, target: TargetId): LowScoreReason | null {
  const s = sample.targets[target];
  if (!s) return null;
  const features = Object.fromEntries(Object.entries(sample.features).map(([k, f]) => [k, f.value]));
  return lowScoreReason(target, s.total, s.dims, s.limiting, features);
}
