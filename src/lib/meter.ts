/**
 * Segmented terminal meter (display only): how many of `segments` cells a 0..1 score lights up.
 * Rounded to the nearest cell; null / non-finite = none; out-of-range values are clamped.
 * The exact number is always shown next to the meter, so rounding never hides the value.
 */
export function meterSegments(value: number | null | undefined, segments: number): number {
  if (value === null || value === undefined || !Number.isFinite(value) || segments <= 0) return 0;
  const v = Math.min(1, Math.max(0, value));
  return Math.round(v * segments);
}
