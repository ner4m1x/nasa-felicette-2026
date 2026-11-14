/**
 * Display-only formatting helpers (never fed back into scores).
 *
 * - Percentiles: values ≥ TOP_PERCENTILE render as "≥ 99.9" (top 0.1 %), otherwise one decimal
 *   place; "100" is never shown.
 * - NASA POWER units: raw API unit strings are mapped to display units; precipitation in mm/day
 *   also gets an approximate mm/yr equivalent (× DAYS_PER_YEAR).
 */

export const TOP_PERCENTILE = 99.95;
export const DAYS_PER_YEAR = 365.25;

export type PercentileDisplay =
  | { kind: "none" }
  | { kind: "top" }
  | { kind: "value"; text: string };

export function formatPercentile(p: number | null | undefined, lang: string): PercentileDisplay {
  if (p === null || p === undefined || !Number.isFinite(p)) return { kind: "none" };
  if (p >= TOP_PERCENTILE) return { kind: "top" };
  const text = new Intl.NumberFormat(lang, { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(Math.max(0, p));
  return { kind: "value", text };
}

/** Raw POWER unit string → display unit. Unknown units pass through unchanged. */
export function displayUnit(raw: string): string {
  const u = raw.trim();
  if (u === "C") return "°C";
  if (u === "kW-hr/m^2/day") return "kWh/m²/day";
  return u;
}

export interface PowerValueDisplay {
  /** formatted number + display unit, e.g. "1.2 mm/day" */
  main: string;
  /** optional secondary conversion, e.g. "≈ 438 mm/yr" */
  extra: string | null;
}

export function formatPowerValue(value: number | null, rawUnit: string, lang: string): PowerValueDisplay {
  if (value === null || !Number.isFinite(value)) return { main: "—", extra: null };
  const nf = (v: number, d: number) => new Intl.NumberFormat(lang, { maximumFractionDigits: d }).format(v);
  const unit = displayUnit(rawUnit);
  const main = `${nf(value, 2)}${unit ? ` ${unit}` : ""}`;
  const extra = rawUnit.trim() === "mm/day" ? `≈ ${nf(value * DAYS_PER_YEAR, 0)} mm/yr` : null;
  return { main, extra };
}
