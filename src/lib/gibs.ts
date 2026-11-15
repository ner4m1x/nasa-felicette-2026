/**
 * NASA GIBS WMTS layers (source id "nasa-gibs"), EPSG:3857 "best" endpoint.
 *
 * Verified on 2026-11-14 against
 *   https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/1.0.0/WMTSCapabilities.xml
 * (identifier, TileMatrixSet, format and time dimension of each layer), and by fetching sample
 * tiles (HTTP 200, `access-control-allow-origin: *`). Note the JPEG extension is ".jpeg".
 *
 * Valid dates as listed in the capabilities on that day:
 *  - VIIRS_SNPP_CorrectedReflectance_TrueColor: daily (P1D), latest interval 2026-07-16/2026-11-02
 *  - MODIS_Terra_CorrectedReflectance_TrueColor: daily (P1D), latest interval 2025-11-10/2026-11-14
 *  - MODIS_Terra_L3_Land_Surface_Temp_Monthly_Day: monthly (P1M), 2000-03-01/2026-10-01
 *  - MODIS_Terra_L3_NDVI_Monthly: monthly (P1M), 2000-03-01/2025-03-01 and 2025-05-01/2026-10-01
 * The dates below are pinned inside those ranges so the map is reproducible.
 *
 * Cloud-free base (re-checked 2026-11-14 in the same capabilities document): the Blue Marble
 * composites have NO time dimension (static layers, no {Time} in the ResourceURL template):
 *  - BlueMarble_ShadedRelief            "Blue Marble Shaded Relief (MODIS)", JPEG, GoogleMapsCompatible_Level8
 *  - BlueMarble_ShadedRelief_Bathymetry "Blue Marble Shaded Relief and Bathymetry (MODIS)", same set
 *  - BlueMarble_NextGeneration          "Blue Marble (MODIS)", same set
 * Sample tiles (z2 and z8) returned HTTP 200 with `access-control-allow-origin: *`.
 * BlueMarble_ShadedRelief is the default: cloud-free, hill-shaded terrain (useful for reading
 * analog landforms) and a dark ocean that suits the terminal theme and keeps overlays readable.
 *
 * The optional single-day true colour uses VIIRS SNPP: its wide swaths overlap at the equator, while a single MODIS Terra
 * day leaves black wedges between orbits (checked visually). The date is near the September
 * equinox so both polar regions are lit.
 * Daily LST (MODIS_Terra_Land_Surface_Temp_Day, Level7) exists too, but a single day is mostly
 * cloud gaps; the monthly composite is used instead (max native zoom 6).
 *
 * ESA partner imagery — EOX "Sentinel-2 cloudless" (provider "eox"), verified on 2026-11-15 against
 *   https://tiles.maps.eox.at/wmts/1.0.0/WMTSCapabilities.xml (HTTP 200, `access-control-allow-origin: *`):
 *  - layer s2cloudless-2025_3857, image/jpeg, TileMatrixSet "g" (EPSG:900913 = Web Mercator, levels 0–21),
 *    ResourceURL template …/s2cloudless-2025_3857/default/{TileMatrixSet}/{TileMatrix}/{TileRow}/{TileCol}.jpg
 *  - licence and attribution, verbatim from the layer abstract: "EOxCloudless https://cloudless.eox.at by
 *    EOX IT Services GmbH (Contains modified Copernicus Sentinel data 2025) released under Creative Commons
 *    Attribution-NonCommercial-ShareAlike 4.0 International License" (non-commercial use only).
 *  - sample tiles over https at z13–z17 (Poland, Atacama) returned 200 image/jpeg with CORS. Sentinel-2's
 *    finest bands are 10 m; z14 is ≈ 9.6 m/px at the equator, so maxZoom 14 here (tiles above it are
 *    upsampled by the server; we upscale with CSS / Leaflet instead).
 */

export const GIBS_BASE = "https://gibs.earthdata.nasa.gov/wmts/epsg3857/best";

export const EOX_BASE = "https://tiles.maps.eox.at/wmts/1.0.0";

export type GibsLayerId = "blueMarble" | "trueColor" | "lstDay" | "ndvi" | "s2cloudless";

export interface GibsLayer {
  key: GibsLayerId;
  /** tile server: NASA GIBS, or EOX (ESA Copernicus Sentinel-2 cloudless) */
  provider: "gibs" | "eox";
  /** WMTS layer identifier */
  id: string;
  tileMatrixSet: string;
  ext: "jpeg" | "jpg" | "png";
  /** highest TileMatrix in the set (Leaflet maxNativeZoom) */
  maxZoom: number;
  /** pinned date inside the layer's valid range (see header); null = static layer, no time */
  time: string | null;
  /** "P1D" | "P1M" — the layer's time step; null for static layers */
  period: string | null;
  /** source product shown in the attribution line */
  product: string;
}

export const GIBS_LAYERS: Record<GibsLayerId, GibsLayer> = {
  blueMarble: {
    key: "blueMarble",
    provider: "gibs",
    id: "BlueMarble_ShadedRelief",
    tileMatrixSet: "GoogleMapsCompatible_Level8",
    ext: "jpeg",
    maxZoom: 8,
    time: null,
    period: null,
    product: "Blue Marble Shaded Relief (MODIS)",
  },
  trueColor: {
    key: "trueColor",
    provider: "gibs",
    id: "VIIRS_SNPP_CorrectedReflectance_TrueColor",
    tileMatrixSet: "GoogleMapsCompatible_Level9",
    ext: "jpeg",
    maxZoom: 9,
    time: "2026-09-22",
    period: "P1D",
    product: "VIIRS SNPP Corrected Reflectance (True Color)",
  },
  lstDay: {
    key: "lstDay",
    provider: "gibs",
    id: "MODIS_Terra_L3_Land_Surface_Temp_Monthly_Day",
    tileMatrixSet: "GoogleMapsCompatible_Level6",
    ext: "png",
    maxZoom: 6,
    time: "2026-10-01",
    period: "P1M",
    product: "MODIS Terra L3 Land Surface Temperature (Day, Monthly)",
  },
  ndvi: {
    key: "ndvi",
    provider: "gibs",
    id: "MODIS_Terra_L3_NDVI_Monthly",
    tileMatrixSet: "GoogleMapsCompatible_Level7",
    ext: "png",
    maxZoom: 7,
    time: "2026-10-01",
    period: "P1M",
    product: "MODIS Terra L3 NDVI (Monthly)",
  },
  s2cloudless: {
    key: "s2cloudless",
    provider: "eox",
    id: "s2cloudless-2025_3857",
    tileMatrixSet: "g",
    ext: "jpg",
    maxZoom: 14,
    time: null,
    period: null,
    product: "Sentinel-2 cloudless 2025",
  },
};

/** Required attribution of the EOX layer (verbatim facts from its capabilities abstract). */
export const EOX_ATTRIBUTION_TEXT =
  "Sentinel-2 cloudless 2025 by EOX IT Services GmbH (Contains modified Copernicus Sentinel data 2025) · CC BY-NC-SA 4.0";
export const EOX_ATTRIBUTION_HTML =
  '<a href="https://cloudless.eox.at" target="_blank" rel="noreferrer">Sentinel-2 cloudless 2025</a> by EOX IT Services GmbH ' +
  "(Contains modified Copernicus Sentinel data 2025) · " +
  '<a href="https://creativecommons.org/licenses/by-nc-sa/4.0/" target="_blank" rel="noreferrer">CC BY-NC-SA 4.0</a>';

/**
 * Base layers, default first: cloud-free composite, the single-day mosaic (may show clouds), and the
 * high-resolution Sentinel-2 cloudless mosaic (ESA Copernicus data via EOX).
 */
export const BASE_LAYERS = ["blueMarble", "trueColor", "s2cloudless"] as const satisfies readonly GibsLayerId[];
export type BaseLayerId = (typeof BASE_LAYERS)[number];
export const DEFAULT_BASE: BaseLayerId = "blueMarble";

/** Thematic layers the user can put over the base. */
export const THEMATIC_LAYERS: readonly GibsLayerId[] = ["lstDay", "ndvi"];

/** Default opacity of the thematic / scan overlays (UI tuning: readable over the dimmed base). */
export const DEFAULT_OVERLAY_OPACITY = 0.7;

/** The analog-score overlay is on when the map first opens, so every scored land cell is visible. */
export const DEFAULT_SHOW_SCAN = true;

/**
 * Leaflet URL template: {z}/{y}/{x} are filled by Leaflet (WMTS TileMatrix/TileRow/TileCol).
 * Static layers (time null) use the capabilities template without the {Time} segment.
 */
export function gibsTileUrl(layer: GibsLayer): string {
  if (layer.provider === "eox") return `${EOX_BASE}/${layer.id}/default/${layer.tileMatrixSet}/{z}/{y}/{x}.${layer.ext}`;
  const time = layer.time === null ? "" : `${layer.time}/`;
  return `${GIBS_BASE}/${layer.id}/default/${time}${layer.tileMatrixSet}/{z}/{y}/{x}.${layer.ext}`;
}

/** Attribution text for one layer: product plus pinned date (day for P1D, month for P1M). */
export function gibsLayerLabel(layer: GibsLayer): string {
  if (layer.time === null) return layer.product;
  return `${layer.product} ${layer.period === "P1M" ? layer.time.slice(0, 7) : layer.time}`;
}

export const GIBS_ATTRIBUTION = "Imagery: NASA GIBS / ESDIS";

/** Leaflet attribution line for a base / thematic layer (HTML; EOX needs its licence link). */
export function layerAttribution(layer: GibsLayer, withProvider = true): string {
  if (layer.provider === "eox") return EOX_ATTRIBUTION_HTML;
  return withProvider ? `${GIBS_ATTRIBUTION} · ${gibsLayerLabel(layer)}` : gibsLayerLabel(layer);
}
