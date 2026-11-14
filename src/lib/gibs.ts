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
 */

export const GIBS_BASE = "https://gibs.earthdata.nasa.gov/wmts/epsg3857/best";

export type GibsLayerId = "blueMarble" | "trueColor" | "lstDay" | "ndvi";

export interface GibsLayer {
  key: GibsLayerId;
  /** WMTS layer identifier */
  id: string;
  tileMatrixSet: string;
  ext: "jpeg" | "png";
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
    id: "MODIS_Terra_L3_NDVI_Monthly",
    tileMatrixSet: "GoogleMapsCompatible_Level7",
    ext: "png",
    maxZoom: 7,
    time: "2026-10-01",
    period: "P1M",
    product: "MODIS Terra L3 NDVI (Monthly)",
  },
};

/** Base layers, default first: cloud-free composite, then the single-day mosaic (may show clouds). */
export const BASE_LAYERS = ["blueMarble", "trueColor"] as const satisfies readonly GibsLayerId[];
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
  const time = layer.time === null ? "" : `${layer.time}/`;
  return `${GIBS_BASE}/${layer.id}/default/${time}${layer.tileMatrixSet}/{z}/{y}/{x}.${layer.ext}`;
}

/** Attribution text for one layer: product plus pinned date (day for P1D, month for P1M). */
export function gibsLayerLabel(layer: GibsLayer): string {
  if (layer.time === null) return layer.product;
  return `${layer.product} ${layer.period === "P1M" ? layer.time.slice(0, 7) : layer.time}`;
}

export const GIBS_ATTRIBUTION = "Imagery: NASA GIBS / ESDIS";
