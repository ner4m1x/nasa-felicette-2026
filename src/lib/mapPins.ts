/**
 * Map pin selection and the "Hide ice-sheet candidates" view filter. Display only: scores are never
 * touched. The filter drops ice-sheet cards BEFORE ranking (rankIceFiltered), so the deck's fixed
 * positions still hold afterwards — position 1 = best Analog × Fit, pins (LunAres 3rd, Hammaguir 2nd)
 * land in the filtered deck instead of sliding up into freed slots.
 *
 * - Candidate regions = the pipeline's discovery cards. By default only the top DEFAULT_TOP_N of
 *   them (by Analog Score for the current target) get pins; every other kind (benchmark, trap,
 *   curated, operational, future user cards) is always pinned. "Show all candidates" lifts the cap.
 * - Pin rank = 1-based position by Analog Score among all scored pins (size scales with it);
 *   unscored cards have no rank.
 * - Ice-sheet candidate = a discovery card in Antarctica (centroid south of ANTARCTICA_LAT, the
 *   pipeline's `in_antarctica` rule in scripts/pipeline/candidates.py) or with NDVI imputed.
 *   Benchmarks/traps are never hidden (they are the validation yardsticks).
 * - The filter starts ON for the targets in ICE_FILTER_DEFAULT_ON (the user can still toggle it):
 *   for the lava-tube target, imputed-NDVI ice-sheet cells otherwise dominate the top of the deck
 *   (known limitation, docs/METHOD_LOG.md). Display only — scores are never changed.
 */
import { PIN_SIZE } from "@/theme/tokens";
import { rankDeck } from "./ranking";
import type { DeckCard, MissionConfig, RankedCard, RankedDeck, TargetId } from "./types";

export const DEFAULT_TOP_N = 10;
/** Mirrors `in_antarctica = clat < -60.0` in scripts/pipeline/candidates.py. */
export const ANTARCTICA_LAT = -60;

/** Targets whose deck and map hide ice-sheet candidates by default. */
export const ICE_FILTER_DEFAULT_ON: readonly TargetId[] = ["moon_tranquillitatis_pit"];

export const iceFilterDefault = (target: TargetId): boolean => ICE_FILTER_DEFAULT_ON.includes(target);

/** Effective filter state: the user's choice for this target if they made one, else the target default. */
export function iceFilterState(target: TargetId, choices: Partial<Record<TargetId, boolean>>): { hide: boolean; byDefault: boolean } {
  const choice = choices[target];
  const hide = choice ?? iceFilterDefault(target);
  return { hide, byDefault: choice === undefined && hide };
}

export function isIceSheetCandidate(card: DeckCard): boolean {
  return card.kind === "discovery" && (card.lat < ANTARCTICA_LAT || card.ndviImputed === true);
}

/**
 * The deck as shown: `ranked` itself when the filter is off; otherwise the same cards minus the
 * ice-sheet candidates, ranked again (same scores — ranking only reads them) so pins and position 1
 * are computed on what is actually shown.
 */
export function rankIceFiltered(
  cards: readonly DeckCard[],
  config: MissionConfig,
  ranked: RankedDeck,
  hide: boolean,
): RankedDeck {
  if (!hide) return ranked;
  return rankDeck(
    cards.filter((c) => !isIceSheetCandidate(c)),
    config,
  );
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
