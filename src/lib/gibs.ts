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
 * True colour uses VIIRS SNPP: its wide swaths overlap at the equator, while a single MODIS Terra
 * day leaves black wedges between orbits (checked visually). The date is near the September
 * equinox so both polar regions are lit.
 * Daily LST (MODIS_Terra_Land_Surface_Temp_Day, Level7) exists too, but a single day is mostly
 * cloud gaps; the monthly composite is used instead (max native zoom 6).
 */

export const GIBS_BASE = "https://gibs.earthdata.nasa.gov/wmts/epsg3857/best";

export type GibsLayerId = "trueColor" | "lstDay" | "ndvi";

export interface GibsLayer {
  key: GibsLayerId;
  /** WMTS layer identifier */
  id: string;
  tileMatrixSet: string;
  ext: "jpeg" | "png";
  /** highest TileMatrix in the set (Leaflet maxNativeZoom) */
  maxZoom: number;
  /** pinned date inside the layer's valid range (see header) */
  time: string;
  /** "P1D" | "P1M" — the layer's time step */
  period: string;
  /** source product shown in the attribution line */
  product: string;
}

export const GIBS_LAYERS: Record<GibsLayerId, GibsLayer> = {
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

/** Thematic layers the user can put over the true-colour base. */
export const THEMATIC_LAYERS: readonly GibsLayerId[] = ["lstDay", "ndvi"];

/** Leaflet URL template: {z}/{y}/{x} are filled by Leaflet (WMTS TileMatrix/TileRow/TileCol). */
export function gibsTileUrl(layer: GibsLayer): string {
  return `${GIBS_BASE}/${layer.id}/default/${layer.time}/${layer.tileMatrixSet}/{z}/{y}/{x}.${layer.ext}`;
}

export const GIBS_ATTRIBUTION = "Imagery: NASA GIBS / ESDIS";
