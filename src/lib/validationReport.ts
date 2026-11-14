/**
 * Reader for /data/validation_report.json (scripts/pipeline/validate.py). The Mission Report's
 * validation badge is built only from this file — nothing about the validation outcome is ever
 * written in the app. Absent file = "validation pending".
 */
import { TARGET_IDS, type TargetId } from "./types";
import { DATA_BASE, fetchOptionalJson, isObj, num, once, str } from "./pipelineFiles";

export const VALIDATION_URL = `${DATA_BASE}validation_report.json`;

export interface GroupSummary {
  n: number;
  medianPercentile: number | null;
}

export interface TargetValidation {
  benchmarks: GroupSummary;
  traps: GroupSummary;
  /** as computed by the pipeline: benchmark median percentile > trap median percentile */
  patternHolds: boolean;
}

export interface ValidationReport {
  generated: string | null;
  configVersion: number | null;
  configCommit: string | null;
  siteRadiusKm: number | null;
  nSites: number;
  summary: Partial<Record<TargetId, TargetValidation>>;
}

function group(v: unknown): GroupSummary {
  const g = isObj(v) ? v : {};
  return { n: num(g.n) ?? 0, medianPercentile: num(g.median_percentile) };
}

export function parseValidationReport(json: unknown): ValidationReport | null {
  if (!isObj(json) || !isObj(json.summary)) return null;
  const summary: Partial<Record<TargetId, TargetValidation>> = {};
  for (const t of TARGET_IDS) {
    const s = json.summary[t];
    if (!isObj(s)) continue;
    summary[t] = { benchmarks: group(s.benchmarks), traps: group(s.traps), patternHolds: s.pattern_holds === true };
  }
  const git = isObj(json.config_git) ? json.config_git : {};
  const method = isObj(json.method) ? json.method : {};
  return {
    generated: str(json.generated),
    configVersion: num(json.config_version),
    configCommit: str(git.commit),
    siteRadiusKm: num(method.site_radius_km),
    nSites: Array.isArray(json.sites) ? json.sites.length : 0,
    summary,
  };
}

/** How many targets the pipeline reported, and for how many the expected pattern held. */
export function validationTally(report: ValidationReport): { holds: number; total: number } {
  const entries = Object.values(report.summary);
  return { holds: entries.filter((e) => e.patternHolds).length, total: entries.length };
}

const reportOnce = once(async () => parseValidationReport(await fetchOptionalJson(VALIDATION_URL)));

export const loadValidationReport = reportOnce.get;
export const resetValidationCache = reportOnce.reset;
