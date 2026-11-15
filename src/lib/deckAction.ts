/**
 * "Add to Félicette's deck" action state for one clicked map point. Shared by the map popup, the
 * phone peek bar and the inspector's sticky action row so all three always agree.
 *
 * - add:      the cell can become a user card for the configured target
 * - disabled: it cannot (ocean / no grid / target unscored); `reason` picks the message
 * - inDeck:   this cell is already a user card; `rejected` = the mission specs put it in the
 *             rejected pile instead of the deck (it is not the next card then)
 */
import type { I18nKey } from "@/i18n/types";
import type { ScanGridSample } from "./scanGrid";
import type { TargetId } from "./types";
import { canAddUserCard, userCardId } from "./userCards";

export type DeckActionState =
  | { kind: "add" }
  | { kind: "disabled"; reason: "noGrid" | "ocean" | "unscored" }
  | { kind: "inDeck"; id: string; rejected: boolean };

export function deckActionState(
  sample: ScanGridSample | null,
  target: TargetId,
  userCardIds: ReadonlySet<string>,
  rejectedIds: ReadonlySet<string>,
): DeckActionState {
  if (sample && sample.land !== false) {
    const id = userCardId(sample);
    if (userCardIds.has(id)) return { kind: "inDeck", id, rejected: rejectedIds.has(id) };
  }
  const check = canAddUserCard(sample, target, userCardIds);
  if (check.ok) return { kind: "add" };
  // "duplicate" is handled above (inDeck); keep the type total anyway
  return { kind: "disabled", reason: check.reason === "duplicate" ? "noGrid" : check.reason };
}

export const DECK_ACTION_REASON_KEY: Record<Extract<DeckActionState, { kind: "disabled" }>["reason"], I18nKey> = {
  ocean: "map.inspector.add.ocean",
  unscored: "map.inspector.add.unscored",
  noGrid: "map.inspector.add.noGrid",
};
