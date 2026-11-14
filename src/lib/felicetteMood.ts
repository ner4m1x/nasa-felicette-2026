/**
 * Which face Félicette pulls. Display only: it reads her existing recommendation and the card's
 * existing scores; it never changes either.
 */

import { LOW_SCORE } from "./lowScore";
import type { Recommendation } from "./verdict";

export const FELICETTE_MOODS = ["neutral", "happy", "hiss", "thinking", "surprised"] as const;
export type FelicetteMood = (typeof FELICETTE_MOODS)[number];

/** A very low analog score surprises her (same threshold as the low-score note). */
export function isSurprisingScore(analogTotal: number | null | undefined): boolean {
  return typeof analogTotal === "number" && analogTotal < LOW_SCORE;
}

/** Her face in the verdict: PURR → happy, HISS → hiss, abstain → neutral; a very low score → surprised. */
export function moodForVerdict(rec: Recommendation, analogTotal: number | null | undefined): FelicetteMood {
  if (isSurprisingScore(analogTotal)) return "surprised";
  return rec === "purr" ? "happy" : rec === "hiss" ? "hiss" : "neutral";
}

/** Her face next to a card teaser (before any verdict). */
export function moodForTeaser(analogTotal: number | null | undefined): FelicetteMood {
  return isSurprisingScore(analogTotal) ? "surprised" : "neutral";
}
