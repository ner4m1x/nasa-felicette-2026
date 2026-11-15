"use client";

/**
 * "Add to Félicette's deck": turns the clicked grid cell into a user card (src/lib/userCards.ts)
 * that becomes the next card of the current deck. Disabled, with the reason, when the cell cannot
 * be scored for the configured target (ocean, no grid, target unscored). An added cell can be removed.
 * Presentational: the state comes from useDeckAction (shared with the map popup and the peek bar).
 */

import { Check, PlusCircle, Trash2 } from "lucide-react";
import { useI18n } from "@/i18n/I18nProvider";
import { DECK_ACTION_REASON_KEY } from "@/lib/deckAction";
import type { useDeckAction } from "./useDeckAction";

export type DeckAction = ReturnType<typeof useDeckAction>;

export function AddToDeck({ action }: { action: DeckAction }) {
  const { t } = useI18n();
  const { state } = action;

  if (state.kind === "inDeck") {
    return (
      <div className="space-y-1.5">
        <p role="status" className="flex items-start gap-1.5 text-xs text-phosphor">
          <Check aria-hidden size={14} className="mt-0.5 shrink-0" />
          {t(state.rejected ? "map.inspector.add.addedRejected" : "map.inspector.add.inDeck")}
        </p>
        <button
          type="button"
          onClick={action.remove}
          className="flex min-h-11 w-full items-center justify-center gap-2 rounded-control border border-hiss/50 text-xs font-bold uppercase tracking-wider text-hiss hover:bg-hiss/10"
        >
          <Trash2 aria-hidden size={14} />
          {t("map.inspector.add.remove")}
        </button>
      </div>
    );
  }

  const reasonKey = state.kind === "disabled" ? DECK_ACTION_REASON_KEY[state.reason] : null;

  return (
    <div className="space-y-1.5">
      <button
        type="button"
        onClick={action.add}
        disabled={state.kind !== "add"}
        aria-describedby={reasonKey ? "add-to-deck-reason" : undefined}
        className="flex min-h-11 w-full items-center justify-center gap-2 rounded-control border border-[var(--kind-user)] bg-panel text-xs font-bold uppercase tracking-wider text-[var(--kind-user)] hover:bg-[var(--kind-user)]/10 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <PlusCircle aria-hidden size={16} />
        {t("map.inspector.add.button")}
      </button>
      {reasonKey && (
        <p id="add-to-deck-reason" className="text-[11px] text-dim">
          {t(reasonKey)}
        </p>
      )}
    </div>
  );
}
