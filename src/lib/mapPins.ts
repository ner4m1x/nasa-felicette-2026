/**
 * Map pin selection and the "Hide ice-sheet candidates" view filter. Display only: both functions
 * select/reorder existing RankedCard objects and never touch their scores.
 *
 * - Candidate regions = the pipeline's discovery cards. By default only the top DEFAULT_TOP_N of
 *   them (by Analog Score for the current target) get pins; every other kind (benchmark, trap,
 *   curated, operational, future user cards) is always pinned. "Show all candidates" lifts the cap.
 * - Pin rank = 1-based position by Analog Score among all scored pins (size scales with it);
 *   unscored cards have no rank.
 * - Ice-sheet candidate = a discovery card in Antarctica (centroid south of ANTARCTICA_LAT, the
 *   pipeline's `in_antarctica` rule in scripts/pipeline/candidates.py) or with NDVI imputed.
 *   Benchmarks/traps are never hidden (they are the validation yardsticks).
 */
import { PIN_SIZE } from "@/theme/tokens";
import type { DeckCard, RankedCard, RankedDeck } from "./types";

export const DEFAULT_TOP_N = 10;
/** Mirrors `in_antarctica = clat < -60.0` in scripts/pipeline/candidates.py. */
export const ANTARCTICA_LAT = -60;

export function isIceSheetCandidate(card: DeckCard): boolean {
  return card.kind === "discovery" && (card.lat < ANTARCTICA_LAT || card.ndviImputed === true);
}

/** Remove ice-sheet candidates from both piles when `hide` is on; otherwise return the deck as is. */
export function applyIceFilter(deck: RankedDeck, hide: boolean): RankedDeck {
  if (!hide) return deck;
  const keep = (r: RankedCard) => !isIceSheetCandidate(r.card);
  return { deck: deck.deck.filter(keep), rejected: deck.rejected.filter(keep) };
}

export interface PinCandidate {
  ranked: RankedCard;
}

export type Pinned<T extends PinCandidate> = T & { rank: number | null; size: number };

export function pinSize(rank: number | null): number {
  if (rank === null) return PIN_SIZE.base;
  return Math.round(Math.max(PIN_SIZE.min, PIN_SIZE.max - PIN_SIZE.step * (rank - 1)));
}

const scoreOf = (r: RankedCard) => r.analog?.total ?? null;

export function selectPins<T extends PinCandidate>(items: readonly T[], showAll: boolean, topN = DEFAULT_TOP_N): Pinned<T>[] {
  const byScore = items
    .filter((i) => scoreOf(i.ranked) !== null)
    .sort((a, b) => scoreOf(b.ranked)! - scoreOf(a.ranked)! || (a.ranked.card.id < b.ranked.card.id ? -1 : 1));

  const topDiscovery = new Set(
    byScore
      .filter((i) => i.ranked.card.kind === "discovery")
      .slice(0, showAll ? undefined : topN)
      .map((i) => i.ranked.card.id),
  );
  const shown = items.filter((i) => i.ranked.card.kind !== "discovery" || topDiscovery.has(i.ranked.card.id));
  const shownIds = new Set(shown.map((i) => i.ranked.card.id));
  const rankOf = new Map(
    byScore.filter((i) => shownIds.has(i.ranked.card.id)).map((i, k) => [i.ranked.card.id, k + 1] as const),
  );
  return shown.map((i) => {
    const rank = rankOf.get(i.ranked.card.id) ?? null;
    return { ...i, rank, size: pinSize(rank) };
  });
}
