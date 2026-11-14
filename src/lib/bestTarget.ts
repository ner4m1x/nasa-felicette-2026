/**
 * "Which target fits this place best?" — all four targets for one scan-grid cell, side by side.
 * Display only: reads the grid's own totals; nothing is re-scored here.
 *
 * Best target = highest Analog Score. Ties (equal quantised totals) are broken by the higher
 * percentile, then by TARGET_IDS order. Targets without a score are never best; if no target has
 * a score, there is no best target (null).
 */
import type { ScanGridSample } from "./scanGrid";
import { TARGET_IDS, type TargetId } from "./types";

export interface TargetRow {
  target: TargetId;
  /** 0..1, null = not scored here */
  total: number | null;
  /** 0..100 among scored land cells (ScanGrid.percentile), null = unknown */
  percentile: number | null;
  limiting: string | null;
}

export type PercentileFn = (target: TargetId) => number | null;

export function targetRows(sample: ScanGridSample, percentile: PercentileFn): TargetRow[] {
  return TARGET_IDS.map((target) => {
    const s = sample.targets[target];
    const total = s?.total ?? null;
    return {
      target,
      total,
      percentile: total === null ? null : percentile(target),
      limiting: total === null ? null : (s?.limiting ?? null),
    };
  });
}

export function bestTarget(rows: readonly TargetRow[]): TargetId | null {
  let best: TargetRow | null = null;
  for (const r of rows) {
    if (r.total === null || !Number.isFinite(r.total)) continue;
    if (
      best === null ||
      r.total > (best.total as number) ||
      (r.total === best.total && (r.percentile ?? -1) > (best.percentile ?? -1))
    ) {
      best = r;
    }
  }
  return best?.target ?? null;
}
