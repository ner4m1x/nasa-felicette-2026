"use client";

/**
 * Content of the Leaflet popup at the tapped map point: the best target + score on one line,
 * then "+ Add to deck" (or "In your deck" + Remove) and "Details" (opens the inspector).
 * The primary Add-to-deck entry point on desktop and phone; shares state with the inspector
 * through useDeckAction, so the disabled reasons are the same everywhere.
 */

import { Check, Plus, Trash2 } from "lucide-react";
import { useI18n } from "@/i18n/I18nProvider";
import { DECK_ACTION_REASON_KEY } from "@/lib/deckAction";
import type { DeckAction } from "@/components/inspector/AddToDeck";

const BTN =
  "flex min-h-10 flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-control border px-2 text-[11px] font-bold uppercase tracking-wide disabled:cursor-not-allowed disabled:opacity-50";

export function MapPointPopup({
  summary,
  action,
  onDetails,
}: {
  /** one line: "Best: Arcadia · 4/100", "No analog score…" or the coordinates */
  summary: string;
  action: DeckAction;
  onDetails: () => void;
}) {
  const { t } = useI18n();
  const { state } = action;
  const reasonKey = state.kind === "disabled" ? DECK_ACTION_REASON_KEY[state.reason] : null;

  return (
    <div className="flex w-64 flex-col gap-2 font-mono text-fg">
      <p className="pr-5 text-xs font-bold leading-snug">{summary}</p>
      {state.kind === "inDeck" && (
        <p role="status" className="flex items-start gap-1 text-[11px] leading-snug text-phosphor">
          <Check aria-hidden size={13} className="mt-px shrink-0" />
          {t(state.rejected ? "map.popup.inRejected" : "map.popup.inDeck")}
        </p>
      )}
      <div className="flex gap-2">
        {state.kind === "inDeck" ? (
          <button type="button" onClick={action.remove} className={`${BTN} border-hiss/50 text-hiss hover:bg-hiss/10`}>
            <Trash2 aria-hidden size={13} />
            {t("map.popup.remove")}
          </button>
        ) : (
          <button
            type="button"
            onClick={action.add}
            disabled={state.kind !== "add"}
            aria-describedby={reasonKey ? "map-popup-reason" : undefined}
            className={`${BTN} border-[var(--kind-user)] text-[var(--kind-user)] hover:bg-[var(--kind-user)]/10`}
          >
            <Plus aria-hidden size={14} />
            {t("map.popup.add")}
          </button>
        )}
        <button type="button" onClick={onDetails} className={`${BTN} border-line text-dim hover:text-fg`}>
          {t("map.popup.details")}
        </button>
      </div>
      {reasonKey && (
        <p id="map-popup-reason" className="text-[10px] leading-snug text-dim">
          {t(reasonKey)}
        </p>
      )}
    </div>
  );
}
