"use client";

/**
 * "Ask Félicette" scripted chat about the top card of the deck (answers: src/lib/askFelicette.ts).
 * - useAskFelicette: the asked question, reset whenever the top card changes; builds the answer.
 * - AskChips: the five question chips + the "scripted answers" caption.
 * - Desktop: SwipeDeck renders the chips under the big FelicetteHero and shows the answer in her bubble.
 * - Phone: AskFab (small round avatar, above the HISS/SKIP/PURR row) opens AskSheet (shared Sheet).
 */

import { useState } from "react";
import { usePlanetaryFormat } from "@/components/planetary/PlanetaryComparison";
import { Sheet } from "@/components/ui/Sheet";
import { useI18n } from "@/i18n/I18nProvider";
import { ASK_QUESTIONS, askAnswer, currentQuestion, type AskQuestion } from "@/lib/askFelicette";
import { comparisonRows } from "@/lib/planetaryComparison";
import type { RankedCard, TargetId } from "@/lib/types";
import { useManifest, useScanGrid } from "@/state/usePipeline";
import { FelicetteAvatar } from "./FelicetteAvatar";
import { FelicetteHero } from "./FelicetteHero";

export interface AskState {
  /** question asked about the current card; null = none yet (or the card changed) */
  question: AskQuestion | null;
  /** answer text for `question`, from the card's data only */
  answer: string | null;
  ask: (q: AskQuestion) => void;
  hasCard: boolean;
}

export function useAskFelicette(ranked: RankedCard | null, target: TargetId): AskState {
  const { t, dim, lang } = useI18n();
  const { planetValue, earthValue } = usePlanetaryFormat();
  const cardId = ranked?.card.id ?? null;
  // Store the card the question was asked for: a different top card means no answer (reset).
  const [asked, setAsked] = useState<{ cardId: string; q: AskQuestion } | null>(null);
  const question = currentQuestion(asked, cardId);

  // The scan grid is fetched only once a comparison is asked for (then cached app-wide).
  const grid = useScanGrid(question === "compare");
  const manifest = useManifest() ?? null;

  let answer: string | null = null;
  if (ranked && question) {
    let rows = null;
    if (question === "compare" && grid !== undefined) {
      const sample = grid.status === "ready" ? grid.grid.sample(ranked.card.lat, ranked.card.lon) : null;
      rows = comparisonRows(target, sample && sample.land !== false ? sample : null);
    }
    answer = askAnswer(question, { ranked, target, rows, manifest }, { t, dim, lang, planetValue, earthValue: (e) => earthValue(e) });
  }

  return {
    question,
    answer,
    hasCard: ranked !== null,
    ask: (q) => {
      if (cardId) setAsked({ cardId, q });
    },
  };
}

export function AskChips({ state, className = "" }: { state: AskState; className?: string }) {
  const { t } = useI18n();
  return (
    <section aria-label={t("ask.title")} className={className}>
      <ul className="flex flex-wrap gap-1.5">
        {ASK_QUESTIONS.map((q) => {
          const active = state.question === q;
          return (
            <li key={q}>
              <button
                type="button"
                disabled={!state.hasCard}
                aria-pressed={active}
                onClick={() => state.ask(q)}
                className={`min-h-9 rounded-pill border px-3 py-1 text-left text-xs leading-snug transition-colors disabled:opacity-50 ${
                  active ? "border-phosphor bg-phosphor/10 text-fg" : "border-line text-dim hover:border-dim hover:text-fg"
                }`}
              >
                {t(`ask.q.${q}`)}
              </button>
            </li>
          );
        })}
      </ul>
      <p className="mt-2 text-[10px] leading-snug text-dim">{state.hasCard ? t("ask.caption") : t("ask.noCard")}</p>
    </section>
  );
}

/** Phone: small round Félicette button; the parent positions it (never over the swipe controls). */
export function AskFab({ onClick, disabled }: { onClick: () => void; disabled: boolean }) {
  const { t } = useI18n();
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-haspopup="dialog"
      aria-label={t("ask.open")}
      title={t("ask.title")}
      className="pointer-events-auto flex h-11 w-11 items-center justify-center rounded-full border border-amber bg-panel disabled:opacity-50"
    >
      <FelicetteAvatar compact className="h-9 w-9" />
    </button>
  );
}

export function AskSheet({ open, onClose, state }: { open: boolean; onClose: () => void; state: AskState }) {
  const { t } = useI18n();
  const text = state.answer ?? t("ask.prompt");
  return (
    <Sheet open={open} onClose={onClose} titleId="ask-felicette-title" title={t("ask.title")} closeLabel={t("breakdown.close")}>
      <div className="space-y-4">
        <FelicetteHero key={text} text={text} mood={state.answer ? "neutral" : "thinking"} />
        <AskChips state={state} />
      </div>
    </Sheet>
  );
}
