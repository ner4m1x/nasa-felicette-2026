"use client";

/**
 * "Rejected by your mission specs": cards with a hard-failed constraint, each with the reason
 * (e.g. "34% trafficable terrain, your heavy rovers need ≥ 60%"). The Analog Score is shown
 * unchanged — a mission rejection says nothing about planetary similarity.
 */

import { Sheet } from "@/components/ui/Sheet";
import { useI18n } from "@/i18n/I18nProvider";
import type { RankedCard } from "@/lib/types";
import { KindBadge, reasonText, to100 } from "./parts";

interface RejectedPileProps {
  open: boolean;
  onClose: () => void;
  rejected: readonly RankedCard[];
}

export function RejectedPile({ open, onClose, rejected }: RejectedPileProps) {
  const { t, dim } = useI18n();
  return (
    <Sheet
      open={open}
      onClose={onClose}
      titleId="rejected-pile-title"
      title={t("deck.rejectedPile")}
      subtitle={t("deck.rejectedIntro")}
      closeLabel={t("breakdown.close")}
    >
      {rejected.length === 0 ? (
        <p className="text-sm text-dim">{t("deck.rejectedEmpty")}</p>
      ) : (
        <ul className="space-y-3">
          {rejected.map(({ card, analog, missionFit }) => (
            <li key={card.id} className="rounded-control border border-line bg-panel-2 p-3">
              <div className="flex flex-wrap items-center gap-2">
                <KindBadge kind={card.kind} label={t(`kinds.${card.kind}`)} />
                <span className="ml-auto text-[11px] tabular-nums text-dim">
                  {t("card.analog")}:{" "}
                  <span className="font-bold text-score-analog">{analog ? to100(analog.total) : "—"}</span>
                </span>
              </div>
              <h3 className="mt-1.5 text-sm font-bold">{card.name}</h3>
              <ul className="mt-1.5 space-y-1">
                {missionFit.failed
                  .filter((c) => c.hard)
                  .map((c) => (
                    <li key={c.id} className="text-xs leading-snug text-hiss">
                      {reasonText(t, dim, { key: c.reasonKey, params: c.params })}
                    </li>
                  ))}
              </ul>
            </li>
          ))}
        </ul>
      )}
    </Sheet>
  );
}
