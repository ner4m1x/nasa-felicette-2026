"use client";

/**
 * Card front: name, country, kind badge, both scores as separate labelled bars (Analog Score from
 * the frozen pipeline; Mission Fit from the configurator — never mixed), a one-line teaser from
 * Félicette and the "Scan with whiskers" cross-check.
 */

import { MapPin, Star } from "lucide-react";
import { useI18n } from "@/i18n/I18nProvider";
import type { RankedCard } from "@/lib/types";
import { formatCoords, KindBadge, ScoreBar } from "./parts";
import { WhiskerScan } from "./WhiskerScan";

interface CardFaceProps {
  ranked: RankedCard;
  /** the top card: its controls are focusable and its body scrolls */
  interactive: boolean;
}

export function CardFace({ ranked, interactive }: CardFaceProps) {
  const { t, lang, dim } = useI18n();
  const { card, analog, missionFit } = ranked;

  const analogDetail = analog
    ? `${t("card.percentile", { p: Math.round(analog.percentile) })} · ${t("card.limiting", { dim: dim(analog.limiting).sci })}`
    : t("card.unscored");

  return (
    <div className="flex h-full flex-col">
      <header className="border-b border-line px-4 pb-3 pt-4">
        <div className="flex flex-wrap items-center gap-1.5">
          <KindBadge kind={card.kind} label={t(`kinds.${card.kind}`)} />
          {card.known && (
            <span className="inline-flex items-center gap-1 rounded-pill border border-line px-2 py-0.5 text-[10px] uppercase tracking-wider text-dim">
              <Star aria-hidden size={10} />
              {t("card.known")}
            </span>
          )}
          <span className="ml-auto text-[10px] uppercase tracking-wider text-dim">
            {t(card.scale === "regional" ? "card.regional" : "card.site")}
          </span>
        </div>
        <h2 className="mt-2 text-lg font-bold leading-tight text-fg">{card.name}</h2>
        <p className="mt-0.5 flex items-center gap-1 text-xs text-dim">
          <MapPin aria-hidden size={12} />
          <span>{card.country ?? t("card.noCountry")}</span>
          <span aria-hidden>·</span>
          <span className="tabular-nums">{formatCoords(lang, card.lat, card.lon)}</span>
        </p>
      </header>

      <div
        className={`min-h-0 flex-1 space-y-4 px-4 py-3 ${interactive ? "overflow-y-auto overscroll-contain" : "overflow-hidden"}`}
      >
        <div className="space-y-3">
          <ScoreBar
            label={t("card.analog")}
            hint={t("card.analogHint")}
            value={analog?.total ?? null}
            outOf={t("card.outOf")}
            color="var(--score-analog)"
            detail={analogDetail}
          />
          <ScoreBar
            label={t("card.fit")}
            hint={t("card.fitHint")}
            value={missionFit.fit}
            outOf={t("card.outOf")}
            color="var(--score-fit)"
          />
        </div>

        <p className="flex gap-2 text-xs italic leading-relaxed text-fg/90">
          <span aria-hidden className="not-italic text-amber">
            =^.^=
          </span>
          <span>{t(`card.teaser.${card.kind}`)}</span>
        </p>

        <WhiskerScan lat={card.lat} lon={card.lon} entry={analog} interactive={interactive} />
      </div>
    </div>
  );
}
