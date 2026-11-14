import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import { direction, LOW_SCORE, lowScoreFromSample, lowScoreReason } from "@/lib/lowScore";
import { decodeScanGrid, parseScanGridMeta } from "@/lib/scanGrid";
import { createUserCard, featureValueText } from "@/lib/userCards";
import { TARGET_IDS } from "@/lib/types";

// Synthetic inputs: arbitrary test values, not data.
describe("lowScoreReason", () => {
  const dims = { precip_mm_yr: 0.01, ndvi_max: 0.05, barren_frac: 0.6, lst_diurnal_range_k: 0.9, relief_std_m: 1, dust_aod: 0.8 };
  const features = { precip_mm_yr: 640, ndvi_max: 0.78, barren_frac: 50 };

  it("is null at or above the threshold and when there is no score", () => {
    expect(lowScoreReason("mars_jezero", LOW_SCORE, dims, "precip_mm_yr", features)).toBeNull();
    expect(lowScoreReason("mars_jezero", null, dims, "precip_mm_yr", features)).toBeNull();
  });

  it("lists the limiting dimension first, then the next weak one, with real values and directions", () => {
    const r = lowScoreReason("mars_jezero", 0.05, dims, "precip_mm_yr", features)!;
    expect(r.body).toBe("mars");
    expect(r.items).toEqual([
      { feature: "precip_mm_yr", dir: "high", value: 640 },
      { feature: "ndvi_max", dir: "high", value: 0.78 },
    ]);
  });

  it("keeps only the limiting dimension when no other is weak", () => {
    const r = lowScoreReason("mars_jezero", 0.1, { ...dims, ndvi_max: 0.9 }, "precip_mm_yr", features)!;
    expect(r.items.map((i) => i.feature)).toEqual(["precip_mm_yr"]);
  });

  it("reads the direction from the scoring config (incl. bands)", () => {
    expect(direction({ feature: "x", type: "lower_better" }, 1)).toBe("high");
    expect(direction({ feature: "x", type: "higher_better" }, 1)).toBe("low");
    expect(direction({ feature: "x", type: "band", full_low: 20, full_high: 300 }, 5)).toBe("low");
    expect(direction({ feature: "x", type: "band", full_low: 20, full_high: 300 }, 900)).toBe("high");
  });

  it("formats values with the pipeline's labels and units", () => {
    expect(featureValueText("ndvi_max", 0.78, "en")).toBe("Peak NDVI 0.78");
    expect(featureValueText("precip_mm_yr", 640, "en")).toBe("Precipitation 640 mm/yr");
  });
});

describe("on the published grid", () => {
  const read = (f: string) => readFileSync(new URL(`../public/data/${f}`, import.meta.url));
  const meta = parseScanGridMeta(JSON.parse(read("scan_grid_meta.json").toString("utf8")))!;
  const grid = decodeScanGrid(meta, new Uint8Array(gunzipSync(read("scan_grid.bin.gz"))));

  it("explains a low Mars score in a wet, green place and stores it on user cards", () => {
    const amazon = { lat: -3, lon: -60 };
    const sample = grid.sample(amazon.lat, amazon.lon);
    const total = sample.targets.mars_jezero?.total ?? null;
    expect(total).not.toBeNull();
    expect(total!).toBeLessThan(LOW_SCORE);
    const r = lowScoreFromSample(sample, "mars_jezero")!;
    expect(r.items[0].feature).toBe(sample.targets.mars_jezero!.limiting);
    expect(r.items[0].value).toBe(sample.features[r.items[0].feature].value);
    const card = createUserCard(grid, amazon.lat, amazon.lon, [])!;
    expect(card.lowScore?.mars_jezero).toEqual(r);
  });

  it("gives no reason for a strong analog", () => {
    const sahara = grid.sample(23.4, 25.6);
    for (const t of TARGET_IDS) {
      const s = sahara.targets[t];
      if (s?.total != null && s.total >= LOW_SCORE) expect(lowScoreFromSample(sahara, t)).toBeNull();
    }
  });
});
