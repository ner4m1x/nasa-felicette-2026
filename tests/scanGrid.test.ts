import { gzipSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import { precipCrossCheck } from "@/lib/crossCheck";
import { missionFit } from "@/lib/missionFit";
import { analogFromSample, cardFromSample } from "@/lib/pointCard";
import type { PowerClimatology } from "@/lib/power";
import { cellIndex, decodeScanGrid, fetchScanGrid, parseScanGridMeta, SCAN_GRID_META_URL } from "@/lib/scanGrid";
import { config } from "./helpers";

/*
 * A tiny synthetic grid (2 rows × 4 cols, 90° cells) laid out exactly like
 * scripts/pipeline/export.py build_grid(): band-sequential uint8, value = offset + scale × q,
 * 255 = nodata, "limiting" bands store an index into `categories`. All numbers are test inputs.
 */
const NLAT = 2;
const NLON = 4;
const META = {
  file: "scan_grid.bin.gz",
  encoding: "gzip",
  nlat: NLAT,
  nlon: NLON,
  step_deg: 90,
  origin: { lat_north: 90, lon_west: -180 },
  nodata: 255,
  config_version: 1,
  bands: [
    { index: 0, name: "precip_mm_yr", kind: "feature", units: "mm yr-1", scale: 10, offset: 0 },
    { index: 1, name: "basalt_frac", kind: "feature", units: "%", scale: 1, offset: 0 },
    { index: 2, name: "trafficable_frac", kind: "feature", units: "1", scale: 0.01, offset: 0 },
    { index: 3, name: "mars_jezero.total", kind: "score", target: "mars_jezero", units: "1", scale: 0.01, offset: 0 },
    { index: 4, name: "mars_jezero.dim.a", kind: "dim", target: "mars_jezero", dim: "a", units: "1", scale: 0.01, offset: 0 },
    { index: 5, name: "mars_jezero.dim.b", kind: "dim", target: "mars_jezero", dim: "b", units: "1", scale: 0.01, offset: 0 },
    { index: 6, name: "mars_jezero.limiting", kind: "limiting", target: "mars_jezero", categories: ["a", "b"], scale: 1, offset: 0 },
    { index: 7, name: "land", kind: "mask", scale: 1, offset: 0 },
  ],
};

/** bands[b][row*NLON+col] */
const BANDS = [
  [10, 20, 30, 40, 50, 60, 70, 255], // precip q → ×10 mm/yr
  [50, 0, 0, 0, 0, 0, 0, 255], // basalt %
  [90, 10, 0, 0, 0, 0, 0, 255], // trafficable q → ×0.01
  [80, 30, 0, 0, 0, 0, 0, 255], // total
  [80, 30, 0, 0, 0, 0, 0, 255], // dim a
  [90, 90, 0, 0, 0, 0, 0, 255], // dim b
  [0, 0, 0, 0, 0, 0, 0, 255], // limiting → "a"
  [1, 1, 1, 1, 1, 1, 1, 0], // land
];
const RAW = Uint8Array.from(BANDS.flat());

describe("scan grid meta + decode", () => {
  const meta = parseScanGridMeta(META)!;

  it("parses the meta written by the pipeline", () => {
    expect(meta.encoding).toBe("gzip");
    expect(meta.bands).toHaveLength(8);
    expect(meta.bands[6].categories).toEqual(["a", "b"]);
  });

  it("maps coordinates to cells (row 0 = north) and wraps longitude", () => {
    expect(cellIndex(meta, 45, -135)).toEqual({ row: 0, col: 0 });
    expect(cellIndex(meta, -45, 135)).toEqual({ row: 1, col: 3 });
    expect(cellIndex(meta, 45, 225)).toEqual({ row: 0, col: 0 }); // 225° ≡ -135°
    expect(cellIndex(meta, 90, 180)).toEqual({ row: 0, col: 0 }); // edges clamp / wrap
    expect(cellIndex(meta, -90, 0)).toEqual({ row: 1, col: 2 });
  });

  it("decodes value = offset + scale × q, nodata → null, limiting → category", () => {
    const grid = decodeScanGrid(meta, RAW);
    const s = grid.sample(45, -135);
    expect(s.cellLat).toBe(45);
    expect(s.cellLon).toBe(-135);
    expect(s.land).toBe(true);
    expect(s.features.precip_mm_yr).toEqual({ value: 100, units: "mm yr-1" });
    expect(s.targets.mars_jezero!.total).toBeCloseTo(0.8);
    expect(s.targets.mars_jezero!.dims.b).toBeCloseTo(0.9);
    expect(s.targets.mars_jezero!.limiting).toBe("a");

    const ocean = grid.sample(-45, 135);
    expect(ocean.land).toBe(false);
    expect(ocean.features.precip_mm_yr.value).toBeNull();
    expect(ocean.targets.mars_jezero!.total).toBeNull();
    expect(ocean.targets.mars_jezero!.limiting).toBeNull();
  });

  it("rejects a buffer that is too short for the declared bands", () => {
    expect(() => decodeScanGrid(meta, RAW.slice(0, 10))).toThrow(/expected/);
  });
});

describe("fetchScanGrid", () => {
  const fakeFetch = (files: Record<string, Uint8Array | object>): typeof fetch =>
    (async (input: RequestInfo | URL) => {
      const url = String(input);
      const body = files[url];
      if (body === undefined) return new Response("not found", { status: 404 });
      if (body instanceof Uint8Array) return new Response(body as BodyInit);
      return Response.json(body);
    }) as typeof fetch;

  it("is 'pending' when the meta file is absent", async () => {
    expect(await fetchScanGrid(fakeFetch({}))).toEqual({ status: "pending" });
  });

  it("is 'pending' when the meta exists but the grid file does not", async () => {
    expect(await fetchScanGrid(fakeFetch({ [SCAN_GRID_META_URL]: META }))).toEqual({ status: "pending" });
  });

  it("decompresses scan_grid.bin.gz with DecompressionStream and decodes it", async () => {
    const state = await fetchScanGrid(
      fakeFetch({ [SCAN_GRID_META_URL]: META, "/data/scan_grid.bin.gz": new Uint8Array(gzipSync(RAW)) }),
    );
    expect(state.status).toBe("ready");
    if (state.status !== "ready") return;
    expect(state.grid.sample(45, -45).features.precip_mm_yr.value).toBe(200);
  });

  it("reports an error (not a crash) for a corrupt file", async () => {
    const state = await fetchScanGrid(
      fakeFetch({ [SCAN_GRID_META_URL]: META, "/data/scan_grid.bin.gz": Uint8Array.from([1, 2, 3]) }),
    );
    expect(state.status).toBe("error");
  });
});

describe("point card + cross-check", () => {
  const grid = decodeScanGrid(parseScanGridMeta(META)!, RAW);
  const s = grid.sample(45, -135);

  it("builds a Mission Fit input from grid features (percent → fraction, no area)", () => {
    const card = cardFromSample(s, 45, -135);
    expect(card.mission.basaltFrac).toBeCloseTo(0.5);
    expect(card.mission.trafficableFrac).toBeCloseTo(0.9);
    expect(card.regionAreaKm2).toBeNull();
    expect(analogFromSample(s, "mars_jezero")!.total).toBeCloseTo(0.8);
    expect(analogFromSample(s, "moon_shackleton")).toBeNull();
  });

  it("feeds the same missionFit used by the deck (heavy rovers fail on low trafficability)", () => {
    const steep = grid.sample(45, -45); // trafficable 0.10
    const fit = missionFit(cardFromSample(steep, 45, -45), config({ mobility: "heavy" }));
    expect(fit.fit).toBe(0);
    expect(fit.failed.some((c) => c.id === "trafficability" && c.hard)).toBe(true);
  });

  const power = (units: string, annual: number | null): PowerClimatology => ({
    lat: 0,
    lon: 0,
    range: null,
    apiVersion: null,
    parameters: { PRECTOTCORR: { units, longname: "P", annual, monthly: [] } },
  });

  it("compares POWER mm/day × days/year with the grid's mm/yr", () => {
    const c = precipCrossCheck(power("mm/day", 1), s)!;
    expect(c.powerMmYr).toBeCloseTo(365.25);
    expect(c.gridMmYr).toBe(100);
  });

  it("shows no comparison when units are not the expected ones or data is missing", () => {
    expect(precipCrossCheck(power("in/day", 1), s)).toBeNull();
    expect(precipCrossCheck(power("mm/day", null), s)).toBeNull();
    expect(precipCrossCheck(power("mm/day", 1), null)).toBeNull();
  });
});
