/**
 * Reader for /data/sensitivity_report.json (scripts/pipeline/sensitivity.py): the robustness line under
 * the Mission Report's validation badge. Every figure shown comes from this file; absent file = no line.
 *
 * Per target the pipeline publishes, for each known site, the spread (p05…p95) of its percentile over
 * the Monte Carlo runs, and for each candidate region the share of runs in which it stays in the top 1 %.
 * The UI reduces that to one strict check per target: the LOWEST benchmark p05 versus the HIGHEST trap
 * p95, i.e. even a benchmark's bad run stays above a trap's good run.
 */
import { TARGET_IDS, type TargetId } from "./types";
import { DATA_BASE, fetchOptionalJson, isObj, num, once, str } from "./pipelineFiles";

export const SENSITIVITY_URL = `${DATA_BASE}sensitivity_report.json`;

export interface TargetRobustness {
  /** lowest 5th-percentile (over runs) percentile among benchmark sites; null = no scorable benchmark */
  worstBenchmarkP05: number | null;
  /** highest 95th-percentile (over runs) percentile among trap sites; null = no scorable trap */
  bestTrapP95: number | null;
  /** worstBenchmarkP05 > bestTrapP95 (false when either side is missing) */
  separated: boolean;
  /** median share of runs (0–1) in which a baseline candidate region stays in the top 1 % */
  medianRegionStability: number | null;
  nRegions: number;
}

export interface SensitivityReport {
  runs: number | null;
  /** ± fraction applied to weights / threshold spans, parsed from the pipeline's method strings */
  weightJitter: number | null;
  thresholdJitter: number | null;
  targets: Partial<Record<TargetId, TargetRobustness>>;
}

function median(xs: number[]): number | null {
  if (xs.length === 0) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

/** "x U(1-0.25, 1+0.25), renormalised" → 0.25 */
function weightJitter(s: string | null): number | null {
  const m = s?.match(/U\(\s*1\s*-\s*([\d.]+)/);
  return m ? Number(m[1]) : null;
}
/** "each breakpoint + U(-0.15, 0.15) x span of its function" → 0.15 */
function thresholdJitter(s: string | null): number | null {
  const m = s?.match(/U\(\s*-\s*([\d.]+)/);
  return m ? Number(m[1]) : null;
}

function target(v: Record<string, unknown>): TargetRobustness {
  const spread = isObj(v.site_percentile_spread) ? v.site_percentile_spread : {};
  const benchP05: number[] = [];
  const trapP95: number[] = [];
  for (const site of Object.values(spread)) {
    if (!isObj(site)) continue; // null = site not scorable for this target (e.g. Lanzarote)
    if (site.category === "benchmark") {
      const p = num(site.p05);
      if (p !== null) benchP05.push(p);
    } else if (site.category === "trap") {
      const p = num(site.p95);
      if (p !== null) trapP95.push(p);
    }
  }
  const stab = Object.values(isObj(v.region_stability) ? v.region_stability : {})
    .map(num)
    .filter((x): x is number => x !== null);
  const worstBenchmarkP05 = benchP05.length ? Math.min(...benchP05) : null;
  const bestTrapP95 = trapP95.length ? Math.max(...trapP95) : null;
  return {
    worstBenchmarkP05,
    bestTrapP95,
    separated: worstBenchmarkP05 !== null && bestTrapP95 !== null && worstBenchmarkP05 > bestTrapP95,
    medianRegionStability: median(stab),
    nRegions: num(v.n_regions) ?? stab.length,
  };
}

export function parseSensitivityReport(json: unknown): SensitivityReport | null {
  if (!isObj(json) || !isObj(json.targets)) return null;
  const targets: Partial<Record<TargetId, TargetRobustness>> = {};
  for (const t of TARGET_IDS) {
    const v = json.targets[t];
    if (isObj(v)) targets[t] = target(v);
  }
  const method = isObj(json.method) ? json.method : {};
  return {
    runs: num(json.runs),
    weightJitter: weightJitter(str(method.weights)),
    thresholdJitter: thresholdJitter(str(method.thresholds)),
    targets,
  };
}

/** For how many reported targets the strict benchmark/trap separation held across runs. */
export function robustnessTally(report: SensitivityReport): { holds: number; total: number } {
  const entries = Object.values(report.targets);
  return { holds: entries.filter((e) => e.separated).length, total: entries.length };
}

const reportOnce = once(async () => parseSensitivityReport(await fetchOptionalJson(SENSITIVITY_URL)));

export const loadSensitivityReport = reportOnce.get;
export const resetSensitivityCache = reportOnce.reset;
