import { describe, expect, it } from "vitest";
import {
  BASE_LAYERS,
  DEFAULT_BASE,
  DEFAULT_OVERLAY_OPACITY,
  GIBS_LAYERS,
  gibsLayerLabel,
  gibsTileUrl,
  layerAttribution,
  EOX_ATTRIBUTION_TEXT,
  THEMATIC_LAYERS,
} from "@/lib/gibs";

describe("GIBS layers", () => {
  it("defaults to the cloud-free Blue Marble base, VIIRS daily stays optional", () => {
    expect(DEFAULT_BASE).toBe("blueMarble");
    expect(BASE_LAYERS[0]).toBe(DEFAULT_BASE);
    expect(BASE_LAYERS).toContain("trueColor");
    for (const id of BASE_LAYERS) expect(THEMATIC_LAYERS).not.toContain(id);
  });

  it("builds a time-less URL for the static Blue Marble layer (capabilities template)", () => {
    expect(gibsTileUrl(GIBS_LAYERS.blueMarble)).toBe(
      "https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/BlueMarble_ShadedRelief/default/GoogleMapsCompatible_Level8/{z}/{y}/{x}.jpeg",
    );
  });

  it("keeps the pinned date in time-enabled layer URLs", () => {
    expect(gibsTileUrl(GIBS_LAYERS.trueColor)).toBe(
      "https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/VIIRS_SNPP_CorrectedReflectance_TrueColor/default/2026-09-22/GoogleMapsCompatible_Level9/{z}/{y}/{x}.jpeg",
    );
  });

  it("labels attribution per layer: no date / day / month", () => {
    expect(gibsLayerLabel(GIBS_LAYERS.blueMarble)).toBe("Blue Marble Shaded Relief (MODIS)");
    expect(gibsLayerLabel(GIBS_LAYERS.trueColor)).toMatch(/2026-09-22$/);
    expect(gibsLayerLabel(GIBS_LAYERS.ndvi)).toMatch(/ 2026-10$/);
  });

  it("offers Sentinel-2 cloudless (EOX) as a third base with the verified template and attribution", () => {
    expect(BASE_LAYERS).toEqual(["blueMarble", "trueColor", "s2cloudless"]);
    expect(gibsTileUrl(GIBS_LAYERS.s2cloudless)).toBe(
      "https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless-2025_3857/default/g/{z}/{y}/{x}.jpg",
    );
    expect(GIBS_LAYERS.s2cloudless.maxZoom).toBe(14);
    expect(EOX_ATTRIBUTION_TEXT).toContain("Contains modified Copernicus Sentinel data 2025");
    expect(EOX_ATTRIBUTION_TEXT).toContain("EOX IT Services GmbH");
    expect(EOX_ATTRIBUTION_TEXT).toContain("CC BY-NC-SA 4.0");
    expect(layerAttribution(GIBS_LAYERS.s2cloudless)).toContain("https://creativecommons.org/licenses/by-nc-sa/4.0/");
    expect(layerAttribution(GIBS_LAYERS.blueMarble)).toBe("Imagery: NASA GIBS / ESDIS · Blue Marble Shaded Relief (MODIS)");
  });

  it("overlay opacity defaults to 70 %", () => {
    expect(DEFAULT_OVERLAY_OPACITY).toBe(0.7);
  });
});
