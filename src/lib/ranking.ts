/**
 * Deck ranking: order = analog.total × missionFit.fit. Both numbers stay available separately on
 * every RankedCard; the analog entry is passed through by reference and never modified.
 *
 * - Cards scored by the pipeline (analog non-null) are sorted by rankScore (desc, ties by id).
 * - Cards with `analog: null` (curated, trap, operational hand-written cards) cannot be ranked by
 *   the Analog Score, so they are interleaved at fixed positions (every INTERLEAVE_EVERY-th slot).
 * - Pipeline cards with no entry for the selected target are not relevant to it and are omitted.
 * - Operational cards are boosted to the top for crewed missions (short / permanent).
 * - Any card with a hard-failed constraint goes to the "Rejected by your mission specs" pile.
 */
import { CREW_OPTIONS } from "@/data/missionOptions";
import { hasHardFail, missionFit } from "./missionFit";
import type { DeckCard, MissionConfig, RankedCard, RankedDeck } from "./types";

/** Unscored cards appear at 1-based positions 3, 6, 9, … so they always show up early. */
export const INTERLEAVE_EVERY = 3;

function byScoreThenId(a: RankedCard, b: RankedCard): number {
  const sa = a.rankScore ?? -1;
  const sb = b.rankScore ?? -1;
  if (sb !== sa) return sb - sa;
  return a.card.id < b.card.id ? -1 : a.card.id > b.card.id ? 1 : 0;
}

export function rankCard(card: DeckCard, config: MissionConfig): RankedCard | null {
  const analog = card.analog === null ? null : (card.analog[config.target] ?? undefined);
  if (analog === undefined) return null; // scored by the pipeline, but not for this target
  const fit = missionFit(card, config);
  return {
    card,
    analog,
    missionFit: fit,
    rankScore: analog === null ? null : analog.total * fit.fit,
  };
}

/** Insert `unscored` at every INTERLEAVE_EVERY-th position of `scored`; leftovers go at the end. */
export function interleave(scored: RankedCard[], unscored: RankedCard[], startPosition = 1): RankedCard[] {
  const out: RankedCard[] = [];
  let s = 0;
  let u = 0;
  let position = startPosition;
  while (s < scored.length || u < unscored.length) {
    const slotForUnscored = position % INTERLEAVE_EVERY === 0;
    if ((slotForUnscored && u < unscored.length) || s >= scored.length) out.push(unscored[u++]);
    else out.push(scored[s++]);
    position++;
  }
  return out;
}

export function rankDeck(cards: readonly DeckCard[], config: MissionConfig): RankedDeck {
  const ranked = cards.map((c) => rankCard(c, config)).filter((r): r is RankedCard => r !== null);

  const rejected = ranked.filter((r) => hasHardFail(r.missionFit)).sort(byScoreThenId);
  const passing = ranked.filter((r) => !hasHardFail(r.missionFit));

  const scored = passing.filter((r) => r.analog !== null).sort(byScoreThenId);
  const unscored = passing.filter((r) => r.analog === null); // keeps input (curated) order

  const boost = CREW_OPTIONS[config.crew].boostsOperational;
  const top = boost ? unscored.filter((r) => r.card.kind === "operational") : [];
  const rest = boost ? unscored.filter((r) => r.card.kind !== "operational") : unscored;

  return { deck: [...top, ...interleave(scored, rest, top.length + 1)], rejected };
}
