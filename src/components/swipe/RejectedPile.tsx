"use client";

/**
 * "Rejected by your mission specs": cards with a hard-failed constraint, grouped by the failing
 * constraint (largest group first). Each group shows the rule that failed, how many sites it rejects,
 * which configurator option would relax it (display only — nothing is changed from here), and the
 * sites with their individual reasons (e.g. "34% trafficable terrain, your heavy rovers need ≥ 20%").
 * The Analog Score is shown unchanged — a mission rejection says nothing about planetary similarity.
 */

import { SlidersHorizontal } from "lucide-react";
import { Sheet } from "@/components/ui/Sheet";
import { useI18n } from "@/i18n/I18nProvider";
import type { I18nKey } from "@/i18n/types";
import { groupRejections, type I18nMessage } from "@/lib/rejections";
import type { RankedCard } from "@/lib/types";
import { useMission } from "@/state/MissionContext";
import { KindBadge, reasonText, to100 } from "./parts";

interface RejectedPileProps {
  open: boolean;
  onClose: () => void;
  rejected: readonly RankedCard[];
}

const PLURAL_KEYS = ["one", "few", "many", "other"] as const;

export function RejectedPile({ open, onClose, rejected }: RejectedPileProps) {
  const { t, dim, lang } = useI18n();
  const { config } = useMission();
  const groups = groupRejections(rejected, config);

  const msg = (m: I18nMessage) => {
    const labels = Object.fromEntries(Object.entries(m.labelParams ?? {}).map(([k, key]) => [k, t(key)]));
    return t(m.key, { ...m.params, ...labels });
  };
  const count = (n: number) => {
    const cat = new Intl.PluralRules(lang).select(n);
    const key = (PLURAL_KEYS as readonly string[]).includes(cat) ? cat : "other";
    return t(`deck.strict.count.${key}` as I18nKey, { n });
  };

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
        <div className="space-y-4">
          <h3 className="text-[11px] font-bold uppercase tracking-wider text-dim">{t("deck.strict.groupedTitle")}</h3>
          {groups.map((g) => (
            <section key={g.id} className="rounded-control border border-hiss/40 bg-panel-2">
              <header className="space-y-1.5 border-b border-line p-3">
                <p className="flex items-baseline gap-2 text-sm font-bold leading-snug">
                  <span className="min-w-0 flex-1">{msg(g.rule)}</span>
                  <span className="shrink-0 rounded-pill border border-hiss/60 px-2 py-0.5 text-[11px] tabular-nums text-hiss">
                    {count(g.cards.length)}
                  </span>
                </p>
                <p className="flex items-start gap-1.5 text-xs leading-snug text-amber">
                  <SlidersHorizontal aria-hidden size={13} className="mt-0.5 shrink-0" />
                  <span>{g.relax ? t("deck.strict.relaxHint", { hint: msg(g.relax) }) : t("deck.strict.noRelax")}</span>
                </p>
              </header>
              <details className="group">
                <summary className="flex min-h-11 cursor-pointer items-center px-3 text-[11px] uppercase tracking-wider text-dim hover:text-fg">
                  {t("deck.strict.sitesTitle")} ({g.cards.length})
                </summary>
                <ul className="space-y-2 px-3 pb-3">
                  {g.cards.map(({ card, analog, missionFit }) => (
                    <li key={card.id} className="rounded-control border border-line bg-panel p-2.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <KindBadge kind={card.kind} label={t(`kinds.${card.kind}`)} />
                        <span className="ml-auto text-[11px] tabular-nums text-dim">
                          {t("card.analog")}:{" "}
                          <span className="font-bold text-score-analog">{analog ? to100(analog.total) : "—"}</span>
                        </span>
                      </div>
                      <h4 className="mt-1 text-sm font-bold">{card.name}</h4>
                      <ul className="mt-1 space-y-0.5">
                        {missionFit.failed
                          .filter((c) => c.hard && c.id === g.id)
                          .map((c) => (
                            <li key={c.id} className="text-xs leading-snug text-hiss">
                              {reasonText(t, dim, { key: c.reasonKey, params: c.params })}
                            </li>
                          ))}
                      </ul>
                    </li>
                  ))}
                </ul>
              </details>
            </section>
          ))}
        </div>
      )}
    </Sheet>
  );
}
