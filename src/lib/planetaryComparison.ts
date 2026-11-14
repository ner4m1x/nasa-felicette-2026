/**
 * Rows for the PlanetaryComparison table (display only; never feeds back into scores).
 *
 * - Earth column: the scan_grid feature value at the clicked/card cell, or "invisible" when the
 *   entry has no Earth feature, or "pending" when no grid sample is available.
 * - Score column: the target's frozen dimension score for that feature — only if the feature is a
 *   scored dimension of that target in the grid; otherwise null ("—").
 */
import { planetaryRefsFor, type PlanetaryRef } from "@/data/planetaryReference";
import type { ScanGridSample } from "./scanGrid";
import type { TargetId } from "./types";

export const DAYS_PER_YEAR_POLAR = 365;

export type EarthCell =
  | { kind: "invisible" }
  | { kind: "pending" }
  | { kind: "value"; value: number; unit: string };

export interface ComparisonRow {
  ref: PlanetaryRef;
  earth: EarthCell;
  /** dimension score 0..1, or null when the feature is not a scored dimension (or no data) */
  score: number | null;
  /** whether the feature is a scored dimension of the target (known only with a grid sample) */
  scored: boolean;
}

const UNIT_DISPLAY: Record<string, string> = { degC: "°C", degree: "°", "mm yr-1": "mm/yr", "1": "" };

export function earthUnit(raw: string | null): string {
  if (raw === null) return "";
  return UNIT_DISPLAY[raw] ?? raw;
}

function earthCell(ref: PlanetaryRef, sample: ScanGridSample | null): EarthCell {
  if (ref.earthFeature === null) return { kind: "invisible" };
  const f = sample?.features[ref.earthFeature];
  if (!f || f.value === null) return { kind: "pending" };
  if (ref.earthTransform === "daysPerYear") return { kind: "value", value: f.value * DAYS_PER_YEAR_POLAR, unit: "days" };
  if (ref.earthTransform === "percent") return { kind: "value", value: f.value * 100, unit: "%" };
  return { kind: "value", value: f.value, unit: earthUnit(f.units) };
}

export function comparisonRows(target: TargetId, sample: ScanGridSample | null): ComparisonRow[] {
  const dims = sample?.targets[target]?.dims ?? {};
  return planetaryRefsFor(target).map((ref) => {
    const scored = ref.earthFeature !== null && ref.earthFeature in dims;
    const score = scored ? (dims[ref.earthFeature as string] ?? null) : null;
    return { ref, earth: earthCell(ref, sample), score, scored };
  });
}
