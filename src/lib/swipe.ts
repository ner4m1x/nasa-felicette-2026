/**
 * Swipe gesture decision (pure). A drag commits to PURR (right) or HISS (left) when it travelled
 * far enough, or when it was released fast enough in the direction of travel; otherwise the card
 * springs back. Tuning values are in src/theme/tokens.ts (UI tuning, not data).
 */
import { SWIPE } from "@/theme/tokens";
import type { Verdict } from "./verdict";

export interface SwipeThresholds {
  offsetFraction: number;
  velocityPxPerS: number;
  minFlickOffsetPx: number;
}

export function swipeDecision(
  offsetX: number,
  velocityX: number,
  cardWidth: number,
  thresholds: SwipeThresholds = SWIPE,
): Verdict | null {
  const dir = Math.sign(offsetX);
  if (dir === 0) return null;
  const farEnough = Math.abs(offsetX) >= thresholds.offsetFraction * cardWidth;
  const flicked =
    Math.abs(offsetX) >= thresholds.minFlickOffsetPx &&
    Math.sign(velocityX) === dir &&
    Math.abs(velocityX) >= thresholds.velocityPxPerS;
  // A fast throw back toward the centre cancels a long drag.
  const thrownBack = Math.sign(velocityX) === -dir && Math.abs(velocityX) >= thresholds.velocityPxPerS;
  if ((farEnough && !thrownBack) || flicked) return dir > 0 ? "purr" : "hiss";
  return null;
}
