"use client";

/**
 * All four targets for the clicked cell, side by side (scores straight from the scan grid), with
 * the best target highlighted and a one-line Félicette summary. Display only.
 */

import { FelicetteSays } from "@/components/felicette/FelicetteSays";
import { LowScoreNote } from "@/components/swipe/LowScoreNote";
import { to100 } from "@/components/swipe/parts";
import { TARGETS } from "@/data/targets";
import { useI18n } from "@/i18n/I18nProvider";
import type { TargetRow } from "@/lib/bestTarget";
import { formatPercentile } from "@/lib/format";
import type { LowScoreReason } from "@/lib/lowScore";
import type { TargetId } from "@/lib/types";

interface TargetComparisonProps {
  rows: readonly TargetRow[];
  best: TargetId | null;
  /** why the best target's score is very low (null when it isn't) */
  bestLow?: LowScoreReason | null;
  configured: TargetId;
}

export function TargetComparison({ rows, best, bestLow = null, configured }: TargetComparisonProps) {
  const { t, lang, dim } = useI18n();
  const bestRow = rows.find((r) => r.target === best) ?? null;
  const summary = bestRow
    ? bestRow.limiting
      ? t("map.inspector.summary", { target: t(TARGETS[bestRow.target].shortKey), dim: dim(bestRow.limiting).sci })
      : t("map.inspector.summaryNoLimit", { target: t(TARGETS[bestRow.target].shortKey) })
    : t("map.inspector.noneScored");

  const pctText = (p: number | null) => {
    const d = formatPercentile(p, lang);
    return d.kind === "top" ? "≥ 99.9" : d.kind === "value" ? d.text : "—";
  };

  return (
    <div className="space-y-2">
      <h4 className="text-[11px] font-bold uppercase tracking-wider text-amber">{t("map.inspector.allTitle")}</h4>
      <FelicetteSays key={summary} text={summary} mood={bestLow ? "surprised" : "neutral"} />
      {bestLow && <LowScoreNote reason={bestLow} />}
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-left text-[11px]">
          <thead>
            <tr className="border-b border-line text-[10px] uppercase tracking-wider text-dim">
              <th scope="col" className="py-1 pr-2 font-normal">{t("map.inspector.colTarget")}</th>
              <th scope="col" className="py-1 pr-2 text-right font-normal">{t("map.inspector.colScore")}</th>
              <th scope="col" className="py-1 pr-2 text-right font-normal" title={t("card.tieNote")}>
                {t("map.inspector.colPct")}*
              </th>
              <th scope="col" className="py-1 font-normal">{t("map.inspector.colLimiting")}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const isBest = r.target === best;
              return (
                <tr
                  key={r.target}
                  className={`border-b border-line/60 align-top ${isBest ? "bg-phosphor/10" : ""}`}
                  aria-current={isBest ? "true" : undefined}
                >
                  <td className={`py-1.5 pr-2 ${isBest ? "border-l-2 border-phosphor pl-1.5" : "pl-2"}`}>
                    <div className={isBest ? "font-bold text-fg" : "text-fg/90"}>{t(TARGETS[r.target].labelKey)}</div>
                    <div className="text-[10px] italic text-dim">{t(TARGETS[r.target].catKey)}</div>
                    <div className="mt-0.5 flex flex-wrap gap-1">
                      {isBest && (
                        <span className="rounded-pill border border-phosphor px-1.5 text-[9px] font-bold uppercase tracking-wider text-phosphor">
                          {t("map.inspector.best")}
                        </span>
                      )}
                      {r.target === configured && (
                        <span className="rounded-pill border border-line px-1.5 text-[9px] uppercase tracking-wider text-dim">
                          {t("map.inspector.configured")}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="py-1.5 pr-2 text-right font-bold tabular-nums">{r.total === null ? "—" : to100(r.total)}</td>
                  <td className="py-1.5 pr-2 text-right tabular-nums" title={t("card.tieNote")}>
                    {pctText(r.percentile)}
                  </td>
                  <td className="py-1.5 text-dim">{r.limiting ? dim(r.limiting).sci : "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="text-[10px] leading-snug text-dim">* {t("card.tieNote")}</p>
    </div>
  );
}
