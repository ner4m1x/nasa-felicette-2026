/**
 * Geometry for the compact per-dimension radar on the card front (display only — the values are the
 * frozen pipeline's per-dimension desirabilities, 0..1, never recomputed here).
 *
 * Axis 0 points straight up; axes go clockwise. Coordinates are in a square viewBox of side
 * `size` with the centre at (size/2, size/2).
 */

export interface RadarAxis {
  id: string;
  /** 1-based axis number shown on the chart and in the legend */
  n: number;
  /** 0..1 as delivered by the pipeline (clamped for drawing only) */
  value: number;
  limiting: boolean;
  /** vertex of the value polygon */
  x: number;
  y: number;
  /** end of the axis spoke (value = 1) */
  ax: number;
  ay: number;
  /** position of the axis number label, just outside the spoke */
  lx: number;
  ly: number;
}

export interface RadarGeometry {
  axes: RadarAxis[];
  /** SVG `points` of the value polygon */
  polygon: string;
  /** SVG `points` of each grid ring (25 / 50 / 75 / 100 %) */
  rings: string[];
}

export const RADAR_RINGS = [0.25, 0.5, 0.75, 1] as const;

const clamp01 = (v: number) => (Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : 0);
const r2 = (v: number) => Math.round(v * 100) / 100;

/**
 * @param dims    dimension id → 0..1 (insertion order = axis order, as in the pipeline output)
 * @param limiting id of the limiting (weakest) dimension, or null
 * @param size    viewBox side
 * @param pad     space reserved around the spokes for the axis numbers
 */
export function radarGeometry(
  dims: Record<string, number>,
  limiting: string | null,
  size: number,
  pad: number,
): RadarGeometry {
  const ids = Object.keys(dims);
  const c = size / 2;
  const radius = c - pad;
  const angle = (i: number) => -Math.PI / 2 + (2 * Math.PI * i) / ids.length;
  const at = (i: number, f: number) => ({ x: r2(c + Math.cos(angle(i)) * radius * f), y: r2(c + Math.sin(angle(i)) * radius * f) });
  const labelR = 1 + (pad * 0.55) / Math.max(radius, 1);

  const axes = ids.map((id, i) => {
    const value = dims[id];
    const v = at(i, clamp01(value));
    const a = at(i, 1);
    const l = at(i, labelR);
    return { id, n: i + 1, value, limiting: id === limiting, x: v.x, y: v.y, ax: a.x, ay: a.y, lx: l.x, ly: l.y };
  });

  const pts = (f: (i: number) => { x: number; y: number }) =>
    ids.map((_, i) => {
      const p = f(i);
      return `${p.x},${p.y}`;
    }).join(" ");

  return {
    axes,
    polygon: pts((i) => axes[i]),
    rings: RADAR_RINGS.map((ring) => pts((i) => at(i, ring))),
  };
}
