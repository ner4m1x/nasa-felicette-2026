import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { PLANETARY_REFERENCE } from "@/data/planetaryReference";
import { getSource } from "@/data/sources";
import { comparisonRows } from "@/lib/planetaryComparison";
import type { ScanGridSample } from "@/lib/scanGrid";
import { TARGET_IDS } from "@/lib/types";

const meta = JSON.parse(readFileSync(new URL("../public/data/scan_grid_meta.json", import.meta.url), "utf8")) as {
  bands: { name: string; kind?: string }[];
};
const bandNames = new Set(meta.bands.map((b) => b.name));

describe("planetary reference data", () => {
  it("every entry has a sourceId that exists in sources.ts", () => {
    for (const r of PLANETARY_REFERENCE) expect(getSource(r.sourceId), r.id).not.toBeNull();
  });
  it("every non-null earthFeature exists in scan_grid_meta bands", () => {
    for (const r of PLANETARY_REFERENCE) if (r.earthFeature !== null) expect(bandNames.has(r.earthFeature), r.id).toBe(true);
  });
  it("ids are unique and every target has entries", () => {
    expect(new Set(PLANETARY_REFERENCE.map((r) => r.id)).size).toBe(PLANETARY_REFERENCE.length);
    for (const t of TARGET_IDS) expect(PLANETARY_REFERENCE.some((r) => r.target === t), t).toBe(true);
  });
  it("qualitative entries carry a qualitativeKey", () => {
    for (const r of PLANETARY_REFERENCE) if (r.value === null) expect(r.qualitativeKey, r.id).toBeDefined();
  });
});

describe("comparisonRows", () => {
  it("renders without grid data: pending/invisible Earth values, no scores", () => {
    for (const t of TARGET_IDS) {
      const rows = comparisonRows(t, null);
      expect(rows.length).toBeGreaterThan(0);
      for (const r of rows) {
        expect(r.earth.kind).toBe(r.ref.earthFeature === null ? "invisible" : "pending");
        expect(r.score).toBeNull();
      }
    }
  });

  // Synthetic sample: arbitrary test inputs, not data.
  const sample: ScanGridSample = {
    cellLat: 0,
    cellLon: 0,
    land: true,
    features: {
      polar_day_frac: { value: 0.1, units: "1" },
      lst_night_min_c: { value: -40, units: "degC" },
      lst_allmonth_mean_c: { value: 5, units: "degC" },
      lst_diurnal_range_k: { value: 20, units: "K" },
    },
    targets: {
      moon_shackleton: { total: 0.3, dims: { polar_day_frac: 0.2, lst_night_min_c: 0.5 }, limiting: "polar_day_frac" },
      mars_jezero: { total: 0.6, dims: { lst_diurnal_range_k: 0.7 }, limiting: "lst_diurnal_range_k" },
    },
  };

  it("transforms polar-day fraction and shows scores only for scored dimensions", () => {
    const rows = comparisonRows("moon_shackleton", sample);
    const days = rows.find((r) => r.ref.id === "rim_continuous_sunlight")!;
    expect(days.earth).toEqual({ kind: "value", value: 36.5, unit: "days" });
    expect(days.score).toBe(0.2);
    const pct = rows.find((r) => r.ref.id === "rim_illumination_pct")!;
    expect(pct.earth).toEqual({ kind: "value", value: 10, unit: "%" });
    const cold = rows.find((r) => r.ref.id === "psr_coldtrap_temp")!;
    expect(cold.earth).toEqual({ kind: "value", value: -40, unit: "°C" });
  });

  it("shows — when the feature is not a scored dimension of the target", () => {
    const rows = comparisonRows("mars_jezero", sample);
    const mean = rows.find((r) => r.ref.id === "air_temp_mean")!;
    expect(mean.earth.kind).toBe("value");
    expect(mean.scored).toBe(false);
    expect(mean.score).toBeNull();
    expect(rows.find((r) => r.ref.id === "air_temp_diurnal_swing")!.score).toBe(0.7);
  });
});
