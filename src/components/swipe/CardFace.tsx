"use client";

/**
 * Card front: name, country, kind badge, both scores as separate labelled bars (Analog Score from
 * the frozen pipeline; Mission Fit from the configurator — never mixed), a one-line teaser from
 * Félicette and the "Scan with whiskers" cross-check.
 */

import { MapPin, Star, Trash2 } from "lucide-react";
import { useI18n } from "@/i18n/I18nProvider";
import { HAMMAGUIR_CARD_ID } from "@/data/curatedCards";
import { formatPercentile } from "@/lib/format";
import type { RankedCard } from "@/lib/types";
import { useMission } from "@/state/MissionContext";
import { useSwipe } from "@/state/SwipeContext";
import { LowScoreNote } from "./LowScoreNote";
import { NdviImputedNote } from "./NdviImputedNote";
import { formatCoords, KindBadge, ScoreBar, to100 } from "./parts";
import { WhiskerScan } from "./WhiskerScan";

interface CardFaceProps {
  ranked: RankedCard;
  /** the top card: its controls are focusable and its body scrolls */
  interactive: boolean;
}

export function CardFace({ ranked, interactive }: CardFaceProps) {
  const { t, lang, dim } = useI18n();
  const { card, analog, missionFit } = ranked;
  const { removeUserCard } = useSwipe();
  const { config } = useMission();

  const pct = analog ? formatPercentile(analog.percentile, lang) : null;
  const pctText =
    pct?.kind === "top" ? t("card.percentileTop") : pct?.kind === "value" ? t("card.percentile", { p: pct.text }) : null;
  const analogDetail = analog
    ? [
        pctText ? t("card.scoreAndPct", { score: to100(analog.total), pct: pctText }) : null,
        t("card.limiting", { dim: dim(analog.limiting).sci }),
      ]
        .filter(Boolean)
        .join(" · ")
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
          {card.kind === "user" && (
            <button
              type="button"
              onClick={() => removeUserCard(card.id)}
              onPointerDown={(e) => e.stopPropagation()}
              tabIndex={interactive ? 0 : -1}
              aria-label={t("map.inspector.add.remove")}
              title={t("map.inspector.add.remove")}
              className="-my-2 flex min-h-11 min-w-11 items-center justify-center text-dim hover:text-hiss"
            >
              <Trash2 aria-hidden size={14} />
            </button>
          )}
        </div>
        <h2 className="mt-2 text-lg font-bold leading-tight text-fg">{card.name}</h2>
        <p className="mt-0.5 flex items-center gap-1 text-xs text-dim">
          <MapPin aria-hidden size={12} />
          <span>{card.country ?? t("card.noCountry")}</span>
          <span aria-hidden>·</span>
          <span className="tabular-nums">{formatCoords(lang, card.lat, card.lon)}</span>
        </p>
      </header>

      {/* The body is its own scroll container, so its touch-action alone decides who owns a touch
          that starts here: pan-y = the browser scrolls vertically, horizontal drags reach the card's
          Framer drag (one finger). Without it ("auto") the browser claims horizontal pans → pointercancel. */}
      <div
        className={`min-h-0 flex-1 space-y-4 px-4 py-3 ${interactive ? "overflow-y-auto overscroll-contain" : "overflow-hidden"}`}
        style={{ touchAction: "pan-y" }}
      >
        <div className="space-y-3">
          <ScoreBar
            label={t("card.analog")}
            hint={t("card.analogHint")}
            value={analog?.total ?? null}
            outOf={t("card.outOf")}
            color="var(--score-analog)"
            detail={analogDetail}
            detailTitle={pctText ? t("card.tieNote") : undefined}
          />
          {pctText && <p className="-mt-2 text-[10px] leading-snug text-dim">* {t("card.tieNote")}</p>}
          <ScoreBar
            label={t("card.fit")}
            hint={t("card.fitHint")}
            value={missionFit.fit}
            outOf={t("card.outOf")}
            color="var(--score-fit)"
          />
        </div>

        {card.kind === "user" && card.lowScore?.[config.target] && <LowScoreNote reason={card.lowScore[config.target]!} />}

        <NdviImputedNote imputed={card.ndviImputed} label={t("card.ndviImputed")} />

        <p className="flex gap-2 text-xs italic leading-relaxed text-fg/90">
          <span aria-hidden className="not-italic text-amber">
            =^.^=
          </span>
          <span>{t(card.id === HAMMAGUIR_CARD_ID ? "card.hammaguir.teaser" : `card.teaser.${card.kind}`)}</span>
        </p>

        {card.id === HAMMAGUIR_CARD_ID && <HammaguirStory ranked={ranked} />}

        <WhiskerScan lat={card.lat} lon={card.lon} entry={analog} interactive={interactive} />
      </div>
    </div>
  );
}

/** Strong-analog wording only at or above this percentile (display only). */
const STRONG_PERCENTILE = 90;

/** Félicette's launch-site story; the Jezero score and percentile are read from the card (scan grid). */
function HammaguirStory({ ranked }: { ranked: RankedCard }) {
  const { t, lang } = useI18n();
  const jezero = ranked.card.analog?.mars_jezero ?? null;
  const pct = jezero ? formatPercentile(jezero.percentile, lang) : null;
  const pctText =
    pct?.kind === "top" ? t("card.percentileTop") : pct?.kind === "value" ? t("card.percentile", { p: pct.text }) : null;
  return (
    <div className="space-y-1.5 rounded-control border border-amber/50 bg-panel-2 p-3 text-xs leading-relaxed">
      <p>{t("card.hammaguir.story1")}</p>
      <p>{t("card.hammaguir.story2")}</p>
      {jezero && pctText && (
        <p className="font-bold">
          {t(jezero.percentile >= STRONG_PERCENTILE ? "card.hammaguir.story3Strong" : "card.hammaguir.story3", {
            score: to100(jezero.total),
            pct: pctText,
          })}
        </p>
      )}
    </div>
  );
}
