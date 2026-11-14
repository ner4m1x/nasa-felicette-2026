/**
 * Turn a scan-grid sample into a DeckCard-shaped value, so the point inspector reuses exactly the
 * same Mission Fit code as the deck (src/lib/missionFit.ts).
 *
 * - The Analog entry is the grid's own score for each target (same numbers as the map overlay).
 * - `regionAreaKm2` stays null: a clicked point is not a region, so the footprint constraint is
 *   reported as unverified rather than computed from an arbitrary area.
 * - Percentile is not stored in the grid; it is set to NaN and never displayed for points.
 * - Unit conversion only: a feature published in "%" is divided by 100 to get the 0..1 fraction
 *   the deck schema uses (the pipeline does the same for deck.json `basaltFrac`).
 */
import type { ScanGridSample } from "./scanGrid";
import { TARGET_IDS, type AnalogEntry, type DeckCard, type TargetId } from "./types";

function fraction(sample: ScanGridSample, name: string): number | null {
  const f = sample.features[name];
  if (!f || f.value === null) return null;
  return f.units === "%" ? f.value / 100 : f.value;
}

function value(sample: ScanGridSample, name: string): number | null {
  return sample.features[name]?.value ?? null;
}

export function analogFromSample(sample: ScanGridSample, target: TargetId): AnalogEntry | null {
  const s = sample.targets[target];
  if (!s || s.total === null) return null;
  const dims: Record<string, number> = {};
  for (const [k, v] of Object.entries(s.dims)) if (v !== null) dims[k] = v;
  return { total: s.total, dims, limiting: s.limiting ?? "", percentile: Number.NaN };
}

export function cardFromSample(sample: ScanGridSample, lat: number, lon: number): DeckCard {
  const analog: Partial<Record<TargetId, AnalogEntry>> = {};
  for (const t of TARGET_IDS) {
    const e = analogFromSample(sample, t);
    if (e) analog[t] = e;
  }
  return {
    id: `point:${sample.cellLat},${sample.cellLon}`,
    kind: "discovery",
    name: "",
    country: null,
    lat,
    lon,
    scale: "regional",
    regionAreaKm2: null,
    analog: Object.keys(analog).length ? analog : null,
    mission: {
      slopeMeanDeg: value(sample, "slope_mean_deg"),
      trafficableFrac: fraction(sample, "trafficable_frac"),
      reliefStdM: value(sample, "relief_std_m"),
      iceProxy: fraction(sample, "ice_proxy"),
      basaltFrac: fraction(sample, "basalt_frac"),
    },
    stability: null,
    known: false,
    breakdown: {},
    sourceIds: [],
  };
}
