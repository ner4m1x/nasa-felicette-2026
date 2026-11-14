/**
 * Motion and interaction tokens that Framer Motion needs as numbers (UI tuning, not data).
 * Colors, radii and shadows are CSS variables in ./tokens.css — restyle there.
 */

/** Seconds, for Framer Motion transitions. Mirrors --duration-* in tokens.css. */
export const DURATION = {
  fast: 0.12,
  base: 0.22,
  slow: 0.45,
} as const;

/** Spring used when a dragged card snaps back or the stack moves up. */
export const SPRING_SNAP = { type: "spring", stiffness: 420, damping: 32 } as const;

/** Card fly-out after a decision. */
export const FLY_OUT = { duration: 0.32, ease: [0.2, 0.8, 0.2, 1] as [number, number, number, number] };

export const SWIPE = {
  /** Commit when the card was dragged at least this fraction of its width… */
  offsetFraction: 0.32,
  /** …or released faster than this (px/s) in the direction of the drag… */
  velocityPxPerS: 550,
  /** …but a fast flick must still travel at least this far (px), to ignore accidental taps. */
  minFlickOffsetPx: 36,
  /** Rotation (deg) reached at ±1 card width of drag. */
  maxRotateDeg: 14,
  /** Drag distance (fraction of width) at which the PURR/HISS stamp is fully opaque. */
  stampFullFraction: 0.28,
  /** Fly-out distance as a multiple of the card width. */
  flyOutWidths: 1.4,
  /** Card width (px) used to scale rotation and stamp opacity (visual only; commits use the real width). */
  referenceWidthPx: 360,
  /** Skip animation: the card drops this far (px) while fading out. */
  skipDropPx: 80,
} as const;

/** Visible stack: the top card plus two behind it. */
export const STACK = {
  visible: 3,
  scaleStep: 0.05,
  yStepPx: 14,
} as const;

/** CSS variable names read at runtime for canvas-confetti (it needs literal colors). */
export const CONFETTI_COLOR_VARS = ["--phosphor", "--amber", "--sky", "--fg"] as const;

/** Map pin diameters (px): rank 1 gets `max`, shrinking by `step` per rank down to `min`. Unranked pins use `base`. */
export const PIN_SIZE = { max: 30, min: 14, step: 1.6, base: 18 } as const;

/** Satellite thumbnail on each card (src/components/swipe/CardImagery.tsx); display tuning only. */
export const IMAGERY = {
  /** Regional cards: ground span (km) across the image width (target 150–300 km). */
  regionalSpanKm: 220,
  /** Footprint outline drawn on regional cards: the pipeline's grid step (degrees). */
  cellSizeDeg: 0.25,
} as const;

/** Terminal-style segmented score meter (ScoreBar): number of segments across the bar. */
export const METER = { segments: 20 } as const;
