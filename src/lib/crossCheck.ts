/**
 * Independent cross-check: live NASA POWER vs the pipeline grid ("POWER: X mm/yr, our grid: Y mm/yr").
 *
 * Both sides are MERRA-2-based precipitation, but POWER is a 2001–2025 climatology and the grid is
 * the pipeline's chosen years, at different resolutions — so they agree only roughly. The app shows
 * both and never blends them.
 *
 * Unit handling is explicit: we only convert when the units read from the data are exactly the
 * ones we know how to convert; otherwise no comparison is shown.
 */
import type { PowerClimatology } from "./power";
import type { ScanGridSample } from "./scanGrid";

/** Mean days per year: unit conversion for a mean daily rate → annual total. */
export const DAYS_PER_YEAR = 365.25;

/** POWER unit string for a daily precipitation rate, as read from the API on 2026-11-14. */
const POWER_MM_PER_DAY = "mm/day";
/** Pipeline unit string for annual precipitation (scripts/pipeline/features.py UNITS). */
const GRID_MM_PER_YEAR = "mm yr-1";

export interface PrecipCrossCheck {
  powerMmYr: number;
  gridMmYr: number;
}

export function precipCrossCheck(power: PowerClimatology | null, sample: ScanGridSample | null): PrecipCrossCheck | null {
  const p = power?.parameters.PRECTOTCORR;
  const g = sample?.features.precip_mm_yr;
  if (!p || p.annual === null || p.units.trim() !== POWER_MM_PER_DAY) return null;
  if (!g || g.value === null || (g.units ?? "").trim() !== GRID_MM_PER_YEAR) return null;
  return { powerMmYr: p.annual * DAYS_PER_YEAR, gridMmYr: g.value };
}
