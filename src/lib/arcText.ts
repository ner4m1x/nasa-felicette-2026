/**
 * Curved labels on the mission patch (MissionPatch): arc geometry and "never clip" text fitting.
 * Display only.
 *
 * Fitting, for a label centred on its arc (startOffset 50 %, text-anchor middle):
 *   1. base font size + base letter spacing, if it fits;
 *   2. else shrink the letter spacing (down to 0);
 *   3. else shrink the font size (down to `minFont`);
 *   4. else (still too long at the minimum size) compress with textLength = arc length and
 *      lengthAdjust="spacingAndGlyphs" — a slight squeeze, never a clip.
 * The width model is linear: width(fs, ls) = naturalWidth × fs / baseFont + chars × ls, where
 * `naturalWidth` is the label's width at the base size with no letter spacing (measured in the
 * browser with getComputedTextLength, or estimated where there is no layout).
 */

export interface Arc {
  /** SVG path data, drawn in reading direction */
  d: string;
  /** length of the path (SVG units) */
  length: number;
}

const rad = (deg: number) => (deg * Math.PI) / 180;
const pt = (cx: number, cy: number, r: number, deg: number) =>
  `${(cx + r * Math.cos(rad(deg))).toFixed(2)} ${(cy + r * Math.sin(rad(deg))).toFixed(2)}`;

/**
 * Arc of radius r centred on the top (-90°) or bottom (90°) of the circle, `sweepDeg` wide.
 * Top arcs run clockwise (text upright on the outside), bottom arcs anticlockwise (text upright,
 * read left to right along the bottom).
 */
export function patchArc(cx: number, cy: number, r: number, side: "top" | "bottom", sweepDeg: number): Arc {
  const mid = side === "top" ? -90 : 90;
  const half = sweepDeg / 2;
  const [from, to] = side === "top" ? [mid - half, mid + half] : [mid + half, mid - half];
  const large = sweepDeg > 180 ? 1 : 0;
  const sweep = side === "top" ? 1 : 0;
  return {
    d: `M ${pt(cx, cy, r, from)} A ${r} ${r} 0 ${large} ${sweep} ${pt(cx, cy, r, to)}`,
    length: r * rad(sweepDeg),
  };
}

export interface ArcFitInput {
  /** label width at baseFont with letter spacing 0 (SVG units) */
  naturalWidth: number;
  /** number of characters (each gets the letter spacing) */
  chars: number;
  baseFont: number;
  baseSpacing: number;
  minFont: number;
  /** usable length along the arc */
  arc: number;
}

export interface ArcFit {
  fontSize: number;
  letterSpacing: number;
  /** set only in the last-resort case: compress to exactly this length */
  textLength?: number;
}

/** Steps, so tiny measurement differences don't flip the result (and the numbers stay tidy). */
const FONT_STEP = 0.25;
const SPACING_STEP = 0.1;
const floorTo = (v: number, step: number) => Math.floor(v / step + 1e-9) * step;

export const fittedWidth = (input: ArcFitInput, fit: ArcFit) =>
  fit.textLength ?? (input.naturalWidth * fit.fontSize) / input.baseFont + input.chars * fit.letterSpacing;

export function fitArcText(input: ArcFitInput): ArcFit {
  const { naturalWidth, chars, baseFont, baseSpacing, minFont, arc } = input;
  if (naturalWidth <= 0 || chars === 0) return { fontSize: baseFont, letterSpacing: baseSpacing };

  // 1–2: base size, as much letter spacing as fits
  if (naturalWidth <= arc) {
    const spare = chars > 0 ? (arc - naturalWidth) / chars : baseSpacing;
    return { fontSize: baseFont, letterSpacing: Math.min(baseSpacing, floorTo(spare, SPACING_STEP)) };
  }
  // 3: smaller font, no spacing
  const fs = floorTo((arc * baseFont) / naturalWidth, FONT_STEP);
  if (fs >= minFont) return { fontSize: fs, letterSpacing: 0 };
  // 4: minimum size, squeezed to the arc
  return { fontSize: minFont, letterSpacing: 0, textLength: arc };
}

/** Width estimate where there is no layout (server render, tests): a generous monospace advance. */
export const ESTIMATED_ADVANCE_EM = 0.62;
export const estimateNaturalWidth = (text: string, baseFont: number) =>
  [...text].length * ESTIMATED_ADVANCE_EM * baseFont;
