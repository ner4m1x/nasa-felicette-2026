"use client";

/**
 * "Add to Félicette's deck": turns the clicked grid cell into a user card (src/lib/userCards.ts)
 * that becomes the next card of the current deck. Disabled, with the reason, when the cell cannot
 * be scored for the configured target (ocean, no grid, target unscored). An added cell can be removed.
 */

import { Check, PlusCircle, Trash2 } from "lucide-react";
import { useState } from "react";
import { useI18n } from "@/i18n/I18nProvider";
import { hasHardFail, missionFit } from "@/lib/missionFit";
import type { ScanGrid, ScanGridSample } from "@/lib/scanGrid";
import type { MissionConfig } from "@/lib/types";
import { canAddUserCard, createUserCard, userCardId } from "@/lib/userCards";
import { useSwipe } from "@/state/SwipeContext";

interface AddToDeckProps {
  point: { lat: number; lon: number };
  grid: ScanGrid | null;
  sample: ScanGridSample | null;
  config: MissionConfig;
}

export function AddToDeck({ point, grid, sample, config }: AddToDeckProps) {
  const { t } = useI18n();
  const swipe = useSwipe();
  const [justAdded, setJustAdded] = useState<{ id: string; rejected: boolean } | null>(null);

  const existing = new Set(swipe.userCards.map((c) => c.id));
  const check = canAddUserCard(sample, config.target, existing);
  const id = sample ? userCardId(sample) : null;
  const inDeck = id !== null && existing.has(id);

  const add = () => {
    if (!grid || !check.ok) return;
    const regions = [...(swipe.ranked?.deck ?? []), ...(swipe.ranked?.rejected ?? [])].map((r) => r.card);
    const card = createUserCard(grid, point.lat, point.lon, regions);
    if (!card) return;
    swipe.addUserCard(card);
    setJustAdded({ id: card.id, rejected: hasHardFail(missionFit(card, config)) });
  };

  if (inDeck) {
    const rejected = justAdded?.id === id && justAdded.rejected;
    return (
      <div className="space-y-1.5">
        <p role="status" className="flex items-start gap-1.5 text-xs text-phosphor">
          <Check aria-hidden size={14} className="mt-0.5 shrink-0" />
          {t(rejected ? "map.inspector.add.addedRejected" : "map.inspector.add.inDeck")}
        </p>
        <button
          type="button"
          onClick={() => {
            swipe.removeUserCard(id);
            setJustAdded(null);
          }}
          className="flex min-h-11 w-full items-center justify-center gap-2 rounded-control border border-hiss/50 text-xs font-bold uppercase tracking-wider text-hiss hover:bg-hiss/10"
        >
          <Trash2 aria-hidden size={14} />
          {t("map.inspector.add.remove")}
        </button>
      </div>
    );
  }

  const reasonKey = check.ok
    ? null
    : check.reason === "ocean"
      ? "map.inspector.add.ocean"
      : check.reason === "unscored"
        ? "map.inspector.add.unscored"
        : check.reason === "noGrid"
          ? "map.inspector.add.noGrid"
          : null;

  return (
    <div className="space-y-1.5">
      <button
        type="button"
        onClick={add}
        disabled={!check.ok}
        aria-describedby={reasonKey ? "add-to-deck-reason" : undefined}
        className="flex min-h-11 w-full items-center justify-center gap-2 rounded-control border border-[var(--kind-user)] text-xs font-bold uppercase tracking-wider text-[var(--kind-user)] hover:bg-[var(--kind-user)]/10 disabled:cursor-not-allowed disabled:opacity-50"
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
