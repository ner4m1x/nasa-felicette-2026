// Phase 6 stub: NASA GIBS WMTS layer definitions.
// Layer identifiers, TileMatrixSets, formats and valid dates must be confirmed from
// https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/1.0.0/WMTSCapabilities.xml before being added here.
// TODO_VERIFY: no identifiers are hard-coded yet.

export interface GibsLayer {
  id: string;
  tileMatrixSet: string;
  ext: "jpg" | "png";
  maxZoom: number;
  defaultTime: string;
}

export const GIBS_LAYERS: readonly GibsLayer[] = [];
