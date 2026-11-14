import { describe, expect, it } from "vitest";
import { bestTarget, targetRows, type TargetRow } from "@/lib/bestTarget";
import type { ScanGridSample } from "@/lib/scanGrid";

// Synthetic rows/samples: arbitrary test inputs, not data.
const row = (target: TargetRow["target"], total: number | null, percentile: number | null = null): TargetRow => ({
  target,
  total,
  percentile,
  limiting: null,
});

describe("bestTarget", () => {
  it("picks the highest Analog Score", () => {
    expect(
      bestTarget([row("moon_shackleton", 0.2), row("moon_tranquillitatis_pit", 0.5), row("mars_jezero", 0.7), row("mars_arcadia", 0.4)]),
    ).toBe("mars_jezero");
  });
  it("breaks ties by percentile, then by target order", () => {
    expect(bestTarget([row("mars_jezero", 0.6, 80), row("mars_arcadia", 0.6, 95)])).toBe("mars_arcadia");
    expect(bestTarget([row("mars_jezero", 0.6, 90), row("mars_arcadia", 0.6, 90)])).toBe("mars_jezero");
    expect(bestTarget([row("mars_jezero", 0.6, null), row("mars_arcadia", 0.6, 10)])).toBe("mars_arcadia");
  });
  it("ignores missing scores and returns null when none is scored", () => {
    expect(bestTarget([row("moon_shackleton", null), row("mars_arcadia", 0.1)])).toBe("mars_arcadia");
    expect(bestTarget([row("moon_shackleton", null), row("mars_jezero", null)])).toBeNull();
    expect(bestTarget([])).toBeNull();
  });
  it("a zero score still counts as scored", () => {
    expect(bestTarget([row("moon_shackleton", null), row("mars_jezero", 0)])).toBe("mars_jezero");
  });
});

describe("targetRows", () => {
  const sample: ScanGridSample = {
    cellLat: 0,
    cellLon: 0,
    land: true,
    features: {},
    targets: {
      moon_shackleton: { total: 0.3, dims: {}, limiting: "polar_day_frac" },
      mars_jezero: { total: null, dims: {}, limiting: null },
    },
  };
  it("returns all four targets, percentiles only where scored", () => {
    const rows = targetRows(sample, () => 42);
    expect(rows.map((r) => r.target)).toEqual(["moon_shackleton", "moon_tranquillitatis_pit", "mars_jezero", "mars_arcadia"]);
    expect(rows[0]).toEqual({ target: "moon_shackleton", total: 0.3, percentile: 42, limiting: "polar_day_frac" });
    expect(rows[2]).toEqual({ target: "mars_jezero", total: null, percentile: null, limiting: null });
    expect(rows[3].total).toBeNull();
  });
});
