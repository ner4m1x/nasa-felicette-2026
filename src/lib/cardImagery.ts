/**
 * Card imagery: Web Mercator tile math for the satellite thumbnail on each swipe card
 * (src/components/swipe/CardImagery.tsx). The thumbnail is a mosaic of plain GIBS WMTS tiles
 * (no Leaflet), positioned so the card's lat/lon sits at the centre of the box.
 *
 * Layers, identifiers, TileMatrixSets, dates and max zooms come ONLY from src/lib/gibs.ts.
 * A layer is never requested above its max native zoom: the mosaic is upscaled with CSS instead,
 * so the footprint on screen stays the same when the user switches layers.
 */

import { GIBS_LAYERS, gibsTileUrl, type GibsLayer, type GibsLayerId } from "./gibs";
import type { DeckCard } from "./types";

/** WMTS GoogleMapsCompatible tiles are 256 × 256 px. */
export const TILE_PX = 256;

/** Web Mercator latitude limit (the square world of EPSG:3857). */
export const MAX_MERCATOR_LAT = 85.0511287798;

/** WGS84 equatorial circumference (m), the reference of EPSG:3857 ground resolution. */
const EARTH_CIRCUMFERENCE_M = 2 * Math.PI * 6378137;

/** Layers offered on the card, default first: cloud-free true colour, NDVI, surface temperature. */
export const CARD_LAYERS = ["blueMarble", "ndvi", "lstDay"] as const satisfies readonly GibsLayerId[];
export type CardLayerId = (typeof CARD_LAYERS)[number];
export const DEFAULT_CARD_LAYER: CardLayerId = "blueMarble";

/** Thematic layers are drawn over the (dimmed) true-colour base, as on the map. */
export function isThematic(id: CardLayerId): boolean {
  return id !== "blueMarble";
}

/** Global pixel position of lat/lon at zoom `z` (fractional zoom allowed), 256 px tiles. */
export function lonLatToWorldPx(lat: number, lon: number, z: number): { x: number; y: number } {
  const clampedLat = Math.max(-MAX_MERCATOR_LAT, Math.min(MAX_MERCATOR_LAT, lat));
  const size = TILE_PX * 2 ** z;
  const sin = Math.sin((clampedLat * Math.PI) / 180);
  const x = ((lon + 180) / 360) * size;
  const y = (0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)) * size;
  return { x, y };
}

/** Tile column/row containing lat/lon at integer zoom `z`, and the pixel offset inside that tile. */
export function tileAt(lat: number, lon: number, z: number): { x: number; y: number; px: number; py: number } {
  const n = 2 ** z;
  const w = lonLatToWorldPx(lat, lon, z);
  // lon = 180 lands exactly on the right edge: wrap it back to column 0; y is clamped into the grid.
  const x = ((Math.floor(w.x / TILE_PX) % n) + n) % n;
  const y = Math.min(n - 1, Math.max(0, Math.floor(w.y / TILE_PX)));
  return { x, y, px: w.x - Math.floor(w.x / TILE_PX) * TILE_PX, py: w.y - y * TILE_PX };
}

/** Integer tile zoom actually requested: never above the layer's max native zoom, never below 0. */
export function clampTileZoom(displayZoom: number, layer: GibsLayer): number {
  return Math.max(0, Math.min(layer.maxZoom, Math.round(displayZoom)));
}

/** URL of one tile, from the template in gibs.ts. */
export function gibsTile(layer: GibsLayer, z: number, x: number, y: number): string {
  return gibsTileUrl(layer)
    .replace("{z}", String(z))
    .replace("{y}", String(y))
    .replace("{x}", String(x));
}

/** Ground metres covered by one CSS px at zoom `z` and latitude `lat`. */
export function metresPerPx(lat: number, z: number): number {
  return (EARTH_CIRCUMFERENCE_M * Math.cos((lat * Math.PI) / 180)) / (TILE_PX * 2 ** z);
}

/** Fractional zoom at which `widthPx` CSS px span `spanKm` on the ground at latitude `lat`. */
export function zoomForSpan(lat: number, widthPx: number, spanKm: number): number {
  const cos = Math.cos((Math.min(Math.abs(lat), MAX_MERCATOR_LAT) * Math.PI) / 180);
  return Math.log2((EARTH_CIRCUMFERENCE_M * cos * widthPx) / (TILE_PX * spanKm * 1000));
}

/**
 * Display zoom of a card's thumbnail (the same for every layer, so the footprint does not jump):
 *  - regional cards: the box spans `regionalSpanKm` across its width;
 *  - site / user / curated cards: the max native zoom of the default true-colour layer.
 */
export function cardDisplayZoom(
  card: Pick<DeckCard, "scale" | "lat">,
  widthPx: number,
  regionalSpanKm: number,
): number {
  if (card.scale === "regional") return zoomForSpan(card.lat, widthPx, regionalSpanKm);
  return GIBS_LAYERS[DEFAULT_CARD_LAYER].maxZoom;
}

export interface MosaicTile {
  key: string;
  url: string;
  /** CSS px relative to the box's top-left corner (integers; neighbours share edges, no seams) */
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface Mosaic {
  tileZoom: number;
  /** CSS upscale factor: 2^(displayZoom − tileZoom) */
  scale: number;
  tiles: MosaicTile[];
}

/**
 * Tiles covering a `width` × `height` box centred on lat/lon at `displayZoom`. Columns wrap around
 * the antimeridian; rows outside the world are skipped (the box background shows through).
 */
export function buildMosaic(opts: {
  layer: GibsLayer;
  lat: number;
  lon: number;
  displayZoom: number;
  width: number;
  height: number;
}): Mosaic {
  const { layer, lat, lon, displayZoom, width, height } = opts;
  const tileZoom = clampTileZoom(displayZoom, layer);
  const scale = 2 ** (displayZoom - tileZoom);
  const n = 2 ** tileZoom;
  const c = lonLatToWorldPx(lat, lon, tileZoom);
  // Box edges in world px at the tile zoom.
  const x0 = c.x - width / 2 / scale;
  const x1 = c.x + width / 2 / scale;
  const y0 = c.y - height / 2 / scale;
  const y1 = c.y + height / 2 / scale;
  // Screen position of a world-px edge, rounded so adjacent tiles share the same edge.
  const sx = (wx: number) => Math.round(width / 2 + (wx - c.x) * scale);
  const sy = (wy: number) => Math.round(height / 2 + (wy - c.y) * scale);

  const tiles: MosaicTile[] = [];
  for (let ty = Math.floor(y0 / TILE_PX); ty <= Math.floor((y1 - 1e-9) / TILE_PX); ty++) {
    if (ty < 0 || ty >= n) continue;
    for (let tx = Math.floor(x0 / TILE_PX); tx <= Math.floor((x1 - 1e-9) / TILE_PX); tx++) {
      const wrapped = ((tx % n) + n) % n;
      const left = sx(tx * TILE_PX);
      const top = sy(ty * TILE_PX);
      tiles.push({
        key: `${layer.key}/${tileZoom}/${tx}/${ty}`,
        url: gibsTile(layer, tileZoom, wrapped, ty),
        left,
        top,
        width: sx((tx + 1) * TILE_PX) - left,
        height: sy((ty + 1) * TILE_PX) - top,
      });
    }
  }
  return { tileZoom, scale, tiles };
}

/** Screen rectangle (CSS px, box-relative) of a `sizeDeg` × `sizeDeg` cell centred on lat/lon. */
export function cellFootprint(opts: {
  lat: number;
  lon: number;
  sizeDeg: number;
  displayZoom: number;
  width: number;
  height: number;
}): { left: number; top: number; width: number; height: number } {
  const { lat, lon, sizeDeg, displayZoom, width, height } = opts;
  const h = sizeDeg / 2;
  const c = lonLatToWorldPx(lat, lon, displayZoom);
  const nw = lonLatToWorldPx(lat + h, lon - h, displayZoom);
  const se = lonLatToWorldPx(lat - h, lon + h, displayZoom);
  return {
    left: width / 2 + (nw.x - c.x),
    top: height / 2 + (nw.y - c.y),
    width: se.x - nw.x,
    height: se.y - nw.y,
  };
}

/** Caption date of a layer: none for static composites, YYYY-MM for monthly, the day otherwise. */
export function layerDate(layer: GibsLayer): string | null {
  if (layer.time === null) return null;
  return layer.period === "P1M" ? layer.time.slice(0, 7) : layer.time;
}
