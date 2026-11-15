import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parseValidationReport, validationTally } from "@/lib/validationReport";
import { parseSensitivityReport, robustnessTally } from "@/lib/sensitivityReport";

const published = (name: string): unknown =>
  JSON.parse(readFileSync(join(__dirname, "..", "public", "data", name), "utf8"));

describe("validation_report.json (published file)", () => {
  const raw = published("validation_report.json") as { summary: Record<string, Record<string, { median_percentile: number }>> };
  const report = parseValidationReport(raw);

  it("parses the committed file (badge must not fall back to 'pending')", () => {
    expect(report).not.toBeNull();
    expect(Object.keys(report!.summary).sort()).toEqual(Object.keys(raw.summary).sort());
  });

  it("passes the pipeline's medians through unchanged", () => {
    for (const [tid, s] of Object.entries(report!.summary)) {
      expect(s.benchmarks.medianPercentile).toBe(raw.summary[tid].benchmarks.median_percentile);
      expect(s.traps.medianPercentile).toBe(raw.summary[tid].traps.median_percentile);
    }
    const { holds, total } = validationTally(report!);
    expect(total).toBe(Object.keys(raw.summary).length);
    expect(holds).toBeLessThanOrEqual(total);
  });

  it("returns null without a summary (→ 'validation pending')", () => {
    expect(parseValidationReport({ sites: [] })).toBeNull();
    expect(parseValidationReport(null)).toBeNull();
  });
});

describe("sensitivity_report.json (robustness line)", () => {
  it("parses the committed file with every target and the run settings", () => {
    const raw = published("sensitivity_report.json") as { runs: number; targets: Record<string, unknown> };
    const r = parseSensitivityReport(raw)!;
    expect(r.runs).toBe(raw.runs);
    expect(r.weightJitter).toBe(0.25);
    expect(r.thresholdJitter).toBe(0.15);
    expect(Object.keys(r.targets).sort()).toEqual(Object.keys(raw.targets).sort());
    for (const t of Object.values(r.targets)) {
      expect(t.worstBenchmarkP05).not.toBeNull();
      expect(t.bestTrapP95).not.toBeNull();
      expect(t.separated).toBe(t.worstBenchmarkP05! > t.bestTrapP95!);
    }
  });

  const fake = {
    runs: 10,
    method: { weights: "x U(1-0.3, 1+0.3)", thresholds: "+ U(-0.1, 0.1) x span" },
    targets: {
      mars_jezero: {
        n_regions: 3,
        region_stability: { a: 0.2, b: 0.9, c: 0.5 },
        site_percentile_spread: {
          b1: { category: "benchmark", p05: 80, p95: 95 },
          b2: { category: "benchmark", p05: 60, p95: 90 },
          gone: null,
          t1: { category: "trap", p05: 10, p95: 65 },
        },
      },
      moon_shackleton: {
        n_regions: 2,
        region_stability: { a: 1, b: 0.5 },
        site_percentile_spread: {
          b1: { category: "benchmark", p05: 90, p95: 99 },
          t1: { category: "trap", p05: 5, p95: 30 },
        },
      },
    },
  };

  it("uses the lowest benchmark p05 vs the highest trap p95, skipping unscorable sites", () => {
    const r = parseSensitivityReport(fake)!;
    expect(r.targets.mars_jezero).toMatchObject({ worstBenchmarkP05: 60, bestTrapP95: 65, separated: false, medianRegionStability: 0.5, nRegions: 3 });
    expect(r.targets.moon_shackleton).toMatchObject({ separated: true, medianRegionStability: 0.75 });
    expect(robustnessTally(r)).toEqual({ holds: 1, total: 2 });
    expect(r.weightJitter).toBe(0.3);
    expect(r.thresholdJitter).toBe(0.1);
  });

  it("is not separated when a side is missing, and null without targets", () => {
    const r = parseSensitivityReport({ targets: { mars_arcadia: { site_percentile_spread: { b: { category: "benchmark", p05: 50 } } } } })!;
    expect(r.targets.mars_arcadia!.separated).toBe(false);
    expect(r.weightJitter).toBeNull();
    expect(parseSensitivityReport({ runs: 1 })).toBeNull();
  });
});
