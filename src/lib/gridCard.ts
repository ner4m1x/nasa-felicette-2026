/**
 * Build a deck card from one scan-grid cell (no hand-typed scores): analog entries, mission
 * features and the NDVI-imputed flag all come from the published grid at the card's coordinates.
 * Percentiles are computed over the published 0.5° grid (ScanGrid.percentile).
 */
import { cardFromSample } from "./pointCard";
import type { ScanGrid } from "./scanGrid";
import { TARGET_IDS, type AnalogEntry, type DeckCard, type TargetId } from "./types";

/** Everything about a grid card that is not read from the grid. */
export type GridCardBase = Omit<DeckCard, "analog" | "mission" | "ndviImputed" | "stability" | "regionAreaKm2">;

/** null when the cell is not land or has no scores at all. */
export function cardFromGridCell(grid: ScanGrid, base: GridCardBase): DeckCard | null {
  const sample = grid.sample(base.lat, base.lon);
  if (sample.land === false) return null;
  const fromSample = cardFromSample(sample, base.lat, base.lon);
  if (!fromSample.analog) return null;

  const analog: Partial<Record<TargetId, AnalogEntry>> = {};
  for (const t of TARGET_IDS) {
    const e = fromSample.analog[t];
    if (!e) continue;
    analog[t] = { ...e, percentile: grid.percentile(t, base.lat, base.lon) ?? Number.NaN };
  }
  return {
    ...base,
    analog,
    mission: fromSample.mission,
    stability: null,
    regionAreaKm2: null,
    ndviImputed: sample.ndviImputed === true,
  };
}
