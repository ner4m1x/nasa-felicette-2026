"use client";

/**
 * Shown after every swipe: Félicette's verdict vs the user's (with the running agreement score),
 * where the analogy matches / breaks down, what to test here, the mission-fit verdict and sources.
 * Also opened from a map pin: then `record` is the user's earlier swipe (or null if the card has
 * not been judged yet) and only Félicette's recommendation is shown when there is nothing to compare.
 *
 * The breakdown text is per target: the sheet shows the entry for the configured target, or a
 * clear "no breakdown for this target" line.
 *
 * Confetti (sparingly): only when the user PURRed a card Félicette also recommends. The canvas is
 * fixed-positioned inside the modal dialog so it renders above the backdrop (top layer).
 */

import { useEffect, useRef } from "react";
import { Sheet } from "@/components/ui/Sheet";
import { TARGETS } from "@/data/targets";
import { useI18n } from "@/i18n/I18nProvider";
import { breakdownFor } from "@/lib/deck";
import { HONESTY_NOTE_KEY } from "@/lib/missionFit";
import type { RankedCard } from "@/lib/types";
import { shouldCelebrate, verdictHeadlineKey, type Agreement, type FelicetteVerdict, type SwipeRecord } from "@/lib/verdict";
import { useMission } from "@/state/MissionContext";
import { CONFETTI_COLOR_VARS } from "@/theme/tokens";
import { NdviImputedNote } from "./NdviImputedNote";
import { KindBadge, reasonText, SourceList, to100 } from "./parts";

export interface Decision {
  ranked: RankedCard;
  /** null = opened from the map for a card the user has not judged yet */
  record: SwipeRecord | null;
  verdict: FelicetteVerdict;
}

interface BreakdownSheetProps {
  decision: Decision | null;
  agreement: Agreement;
  onClose: () => void;
  /** label of the footer button (default: "Next card") */
  closeActionLabel?: string;
  /** false when re-opening an earlier decision (e.g. from a map pin): no repeat celebration */
  allowConfetti?: boolean;
}

function readColors(): string[] {
  const css = getComputedStyle(document.documentElement);
  return CONFETTI_COLOR_VARS.map((v) => css.getPropertyValue(v).trim()).filter(Boolean);
}

export function BreakdownSheet({
  decision,
  agreement,
  onClose,
  closeActionLabel,
  allowConfetti = true,
}: BreakdownSheetProps) {
  const { t, lang, dim } = useI18n();
  const { config } = useMission();
  const canvas = useRef<HTMLCanvasElement>(null);
  const celebrate =
    allowConfetti && decision !== null && decision.record !== null && shouldCelebrate(decision.record);

  // Fire confetti once per celebrated decision (external system: canvas).
  useEffect(() => {
    if (!celebrate || !canvas.current) return;
    const target = canvas.current;
    let reset: (() => void) | undefined;
    import("canvas-confetti").then(({ default: confetti }) => {
      const fire = confetti.create(target, { resize: true, disableForReducedMotion: true });
      reset = fire.reset;
      fire({ particleCount: 90, spread: 75, startVelocity: 38, origin: { y: 0.55 }, colors: readColors() });
    });
    return () => reset?.();
  }, [celebrate, decision]);

  // Unmounting the dialog closes it; the parent clears `decision` on close.
  if (!decision) return null;

  const { ranked, record, verdict } = decision;
  const { card, analog, missionFit } = ranked;
  const rec = verdict.recommendation;
  const headline = t(verdictHeadlineKey(rec, record));
  const tone = record ? record.verdict : rec === "abstain" ? null : rec;
  const toneColor = tone === "purr" ? "var(--purr)" : tone === "hiss" ? "var(--hiss)" : "var(--line)";

  const breakdown = breakdownFor(card, config.target);
  const sections = breakdown
    ? [
        { id: "matches", icon: "✅", title: t("breakdown.matches"), items: breakdown.matches[lang] ?? [] },
        { id: "breaksDown", icon: "⚠️", title: t("breakdown.breaksDown"), items: breakdown.breaksDown[lang] ?? [] },
        { id: "utility", icon: "🚀", title: t("breakdown.utility"), items: breakdown.utility[lang] ?? [] },
      ]
    : [];

  return (
    <Sheet
      open
      onClose={onClose}
      titleId="breakdown-title"
      title={card.name}
      subtitle={
        <span className="flex flex-wrap items-center gap-2">
          <KindBadge kind={card.kind} label={t(`kinds.${card.kind}`)} />
          <span className="tabular-nums">
            {t("card.analog")} <b className="text-score-analog">{analog ? to100(analog.total) : "—"}</b> ·{" "}
            {t("card.fit")} <b className="text-score-fit">{to100(missionFit.fit)}</b>
          </span>
        </span>
      }
      closeLabel={t("breakdown.close")}
      overlay={
        celebrate ? (
          <canvas ref={canvas} aria-hidden className="pointer-events-none fixed inset-0 z-10 h-dvh w-screen" />
        ) : null
      }
      footer={
        <button
          type="button"
          onClick={onClose}
          autoFocus
          className="flex min-h-12 w-full items-center justify-center rounded-control border-2 border-phosphor text-sm font-bold uppercase tracking-widest text-phosphor hover:bg-phosphor/10"
        >
          {closeActionLabel ?? t("breakdown.next")}
        </button>
      }
    >
      <div className="space-y-5">
        <section className="rounded-control border p-3" style={{ borderColor: toneColor }}>
          <h3 className="text-[11px] font-bold uppercase tracking-wider text-amber">{t("breakdown.verdictTitle")}</h3>
          <p
            className="mt-1 text-xs font-black uppercase tracking-widest"
            style={{ color: record ? toneColor : "var(--dim)" }}
          >
            {record
              ? t(record.verdict === "purr" ? "breakdown.youPurred" : "breakdown.youHissed")
              : t("breakdown.notJudged")}
          </p>
          <p className="mt-2 flex gap-2 text-sm leading-relaxed">
            <span aria-hidden className="text-amber">
              =^.^=
            </span>
            <span>
              <b>{headline}</b> {reasonText(t, dim, verdict.reason)}
            </span>
          </p>
          <p className="mt-2 text-[11px] tabular-nums text-dim">
            {agreement.ratio === null
              ? t("breakdown.agreementNone")
              : t("breakdown.agreement", {
                  agreed: agreement.agreed,
                  counted: agreement.counted,
                  pct: Math.round(agreement.ratio * 100),
                })}
          </p>
        </section>

        <NdviImputedNote imputed={card.ndviImputed} label={t("card.ndviImputed")} />

        {!breakdown && (
          <p className="rounded-control border border-dashed border-line px-3 py-2 text-sm text-dim">
            {t("breakdown.noTarget", { target: t(TARGETS[config.target].labelKey) })}
          </p>
        )}

        {sections.map((s) => (
          <section key={s.id}>
            <h3 className="text-xs font-bold uppercase tracking-wider text-phosphor">
              <span aria-hidden>{s.icon}</span> {s.title}
            </h3>
            {s.items.length === 0 ? (
              <p className="mt-1 text-sm text-dim">{t("breakdown.empty")}</p>
            ) : (
              <ul className="mt-1 list-disc space-y-1 pl-5 text-sm leading-relaxed marker:text-line">
                {s.items.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            )}
          </section>
        ))}

        <section>
          <h3 className="text-xs font-bold uppercase tracking-wider text-phosphor">
            <span aria-hidden>🛰️</span> {t("breakdown.fit")}
          </h3>
          {missionFit.failed.length === 0 ? (
            <p className="mt-1 text-sm">{t("breakdown.allPassed")}</p>
          ) : (
            <ul className="mt-1 space-y-1.5">
              {missionFit.failed.map((c) => (
                <li key={c.id} className="flex items-start gap-2 text-sm leading-snug">
                  <span
                    className="mt-0.5 shrink-0 rounded-pill border px-1.5 text-[9px] uppercase tracking-wider"
                    style={{ color: c.hard ? "var(--hiss)" : "var(--amber)", borderColor: "currentColor" }}
                  >
                    {t(c.hard ? "breakdown.hard" : "breakdown.soft")}
                  </span>
                  <span>{reasonText(t, dim, { key: c.reasonKey, params: c.params })}</span>
                </li>
              ))}
            </ul>
          )}
          {missionFit.notes.length > 0 && (
            <ul className="mt-2 space-y-1 text-xs text-dim">
              {missionFit.notes.map((n) => (
                <li key={n.key}>• {t(n.key, n.params)}</li>
              ))}
            </ul>
          )}
          <p className="mt-2 text-[11px] italic text-dim">{t(HONESTY_NOTE_KEY)}</p>
        </section>

        <section>
          <h3 className="text-xs font-bold uppercase tracking-wider text-phosphor">
            <span aria-hidden>📚</span> {t("breakdown.sources")}
          </h3>
          <div className="mt-1">
            <SourceList
              ids={card.sourceIds}
              unverifiedLabel={t("breakdown.unverified")}
              datasetLabel={t("sources.dataset")}
              versionLabel={t("sources.version")}
            />
          </div>
        </section>
      </div>
    </Sheet>
  );
}
