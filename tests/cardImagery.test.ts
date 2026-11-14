import { describe, expect, it } from "vitest";
import {
  buildMosaic,
  cardDisplayZoom,
  CARD_LAYERS,
  cellFootprint,
  clampTileZoom,
  DEFAULT_CARD_LAYER,
  gibsTile,
  layerDate,
  lonLatToWorldPx,
  metresPerPx,
  TILE_PX,
  tileAt,
  zoomForSpan,
} from "@/lib/cardImagery";
import { GIBS_LAYERS } from "@/lib/gibs";

describe("Web Mercator tile math", () => {
  it("puts 0°,0° at the world centre", () => {
    for (const z of [0, 3, 8]) {
      const w = lonLatToWorldPx(0, 0, z);
      expect(w.x).toBeCloseTo((TILE_PX * 2 ** z) / 2, 6);
      expect(w.y).toBeCloseTo((TILE_PX * 2 ** z) / 2, 6);
    }
    expect(tileAt(0, 0, 1)).toEqual({ x: 1, y: 1, px: 0, py: 0 });
  });

  it("matches the standard slippy-map tile index (Paris, z10 → 518/352)", () => {
    const t = tileAt(48.8566, 2.3522, 10);
    expect(t.x).toBe(518);
    expect(t.y).toBe(352);
    expect(t.px).toBeGreaterThanOrEqual(0);
    expect(t.px).toBeLessThan(TILE_PX);
    expect(t.py).toBeGreaterThanOrEqual(0);
    expect(t.py).toBeLessThan(TILE_PX);
  });

  it("returns the pixel offset inside the tile", () => {
    // lon −90 at z0 = a quarter of the 256 px world; lat 0 = half.
    expect(tileAt(0, -90, 0)).toEqual({ x: 0, y: 0, px: 64, py: 128 });
    // Southern/western hemisphere, z2: tile 1 / 2.
    const t = tileAt(-10, -60, 2);
    expect(t.x).toBe(1);
    expect(t.y).toBe(2);
  });

  it("clamps the poles and wraps lon 180 into column 0", () => {
    expect(tileAt(89.9, 0, 3).y).toBe(0);
    expect(tileAt(-89.9, 0, 3).y).toBe(7);
    expect(tileAt(0, 180, 3).x).toBe(0);
  });

  it("ground resolution halves per zoom and is ~156 km/px at z0 on the equator", () => {
    expect(metresPerPx(0, 0)).toBeCloseTo(156543.03, 1);
    expect(metresPerPx(0, 5) / metresPerPx(0, 6)).toBeCloseTo(2, 9);
    expect(metresPerPx(60, 3)).toBeCloseTo(metresPerPx(0, 3) / 2, 6);
  });

  it("zoomForSpan inverts the ground resolution", () => {
    const z = zoomForSpan(30, 360, 220);
    expect((360 * metresPerPx(30, z)) / 1000).toBeCloseTo(220, 6);
  });
});

describe("max-zoom clamping", () => {
  it("never requests above a layer's max native zoom", () => {
    expect(clampTileZoom(9.4, GIBS_LAYERS.blueMarble)).toBe(8);
    expect(clampTileZoom(9.4, GIBS_LAYERS.ndvi)).toBe(7);
    expect(clampTileZoom(9.4, GIBS_LAYERS.lstDay)).toBe(6);
    expect(clampTileZoom(5.4, GIBS_LAYERS.lstDay)).toBe(5);
    expect(clampTileZoom(-1, GIBS_LAYERS.ndvi)).toBe(0);
  });

  it("upscales with CSS instead (scale = 2^(display − tile zoom))", () => {
    const m = buildMosaic({ layer: GIBS_LAYERS.lstDay, lat: 20, lon: 10, displayZoom: 8, width: 360, height: 220 });
    expect(m.tileZoom).toBe(6);
    expect(m.scale).toBe(4);
    for (const t of m.tiles) expect(t.url).toContain("/GoogleMapsCompatible_Level6/6/");
  });

  it("site cards use the true-colour max native zoom; regional cards span the configured km", () => {
    expect(cardDisplayZoom({ scale: "site", lat: 40 }, 360, 220)).toBe(GIBS_LAYERS[DEFAULT_CARD_LAYER].maxZoom);
    const z = cardDisplayZoom({ scale: "regional", lat: 40 }, 360, 220);
    expect((360 * metresPerPx(40, z)) / 1000).toBeCloseTo(220, 6);
  });
});

describe("mosaic", () => {
  it("covers the whole box with seamless integer tiles and centres lat/lon", () => {
    const width = 390;
    const height = 230;
    const m = buildMosaic({ layer: GIBS_LAYERS.blueMarble, lat: 18.4, lon: 77.5, displayZoom: 7.6, width, height });
    expect(m.tileZoom).toBe(8);
    const minLeft = Math.min(...m.tiles.map((t) => t.left));
    const minTop = Math.min(...m.tiles.map((t) => t.top));
    const maxRight = Math.max(...m.tiles.map((t) => t.left + t.width));
    const maxBottom = Math.max(...m.tiles.map((t) => t.top + t.height));
    expect(minLeft).toBeLessThanOrEqual(0);
    expect(minTop).toBeLessThanOrEqual(0);
    expect(maxRight).toBeGreaterThanOrEqual(width);
    expect(maxBottom).toBeGreaterThanOrEqual(height);
    // Neighbouring tiles share edges exactly (no seams, no overlap).
    for (const a of m.tiles) {
      expect(Number.isInteger(a.left) && Number.isInteger(a.width)).toBe(true);
      const right = m.tiles.find((b) => b.top === a.top && b.left === a.left + a.width);
      if (a.left + a.width < width) expect(right).toBeDefined();
    }
    // The centre pixel of the box is the card's location.
    const c = tileAt(18.4, 77.5, 8);
    const centreTile = m.tiles.find((t) => t.url.endsWith(`/8/${c.y}/${c.x}.jpeg`))!;
    expect(centreTile).toBeDefined();
    expect(centreTile.left + c.px * m.scale).toBeCloseTo(width / 2, 0);
    expect(centreTile.top + c.py * m.scale).toBeCloseTo(height / 2, 0);
  });

  it("wraps columns across the antimeridian and skips rows outside the world", () => {
    const m = buildMosaic({ layer: GIBS_LAYERS.ndvi, lat: 84, lon: 179.9, displayZoom: 2, width: 400, height: 300 });
    const n = 2 ** m.tileZoom;
    for (const t of m.tiles) {
      const [, , y, x] = t.url.match(/\/(\d+)\/(\d+)\/(\d+)\.png$/)!.map(Number);
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThan(n);
      expect(y).toBeGreaterThanOrEqual(0);
      expect(y).toBeLessThan(n);
    }
    expect(m.tiles.some((t) => /\/2\/\d+\/0\.png$/.test(t.url))).toBe(true);
  });
});

describe("layer URLs from gibs.ts", () => {
  it("offers true colour (Blue Marble, default), NDVI and LST day", () => {
    expect(CARD_LAYERS).toEqual(["blueMarble", "ndvi", "lstDay"]);
    expect(DEFAULT_CARD_LAYER).toBe("blueMarble");
  });

  it("fills {z}/{y}/{x} in the verified templates", () => {
    expect(gibsTile(GIBS_LAYERS.blueMarble, 8, 183, 115)).toBe(
      "https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/BlueMarble_ShadedRelief/default/GoogleMapsCompatible_Level8/8/115/183.jpeg",
    );
    expect(gibsTile(GIBS_LAYERS.ndvi, 7, 1, 2)).toBe(
      "https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/MODIS_Terra_L3_NDVI_Monthly/default/2026-10-01/GoogleMapsCompatible_Level7/7/2/1.png",
    );
    expect(gibsTile(GIBS_LAYERS.lstDay, 6, 3, 4)).toBe(
      "https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/MODIS_Terra_L3_Land_Surface_Temp_Monthly_Day/default/2026-10-01/GoogleMapsCompatible_Level6/6/4/3.png",
    );
  });

  it("captions: no date for the static composite, month for monthly layers", () => {
    expect(layerDate(GIBS_LAYERS.blueMarble)).toBeNull();
    expect(layerDate(GIBS_LAYERS.ndvi)).toBe("2026-10");
    expect(layerDate(GIBS_LAYERS.lstDay)).toBe("2026-10");
  });
});

describe("cell footprint", () => {
  it("is centred on the card and ~28 km wide for 0.25° at the equator", () => {
    const z = 8;
    const r = cellFootprint({ lat: 0, lon: 0, sizeDeg: 0.25, displayZoom: z, width: 400, height: 240 });
    expect(r.left + r.width / 2).toBeCloseTo(200, 6);
    expect(r.top + r.height / 2).toBeCloseTo(120, 3);
    expect((r.width * metresPerPx(0, z)) / 1000).toBeCloseTo(27.8, 0);
  });
});
