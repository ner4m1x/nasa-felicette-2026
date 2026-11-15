"use client";

/**
 * Mission Configurator (landing screen of the Swipe tab).
 * - Phone: one question per screen, progress dots, Back / Next, "Launch scan" on the last question.
 * - Desktop (≥ lg): all four questions as one compact form, with Félicette (FelicetteHero) and the
 *   live preview of the first ranked card (PreviewCard), Launch and the brief beside it.
 *   Phones: FelicetteHero above each question, no preview.
 * The same DOM serves both: on phones, questions other than the current one are hidden by CSS.
 */

import { ChevronLeft, ChevronRight, Rocket } from "lucide-react";
import { useState, type FormEvent } from "react";
import { FelicetteHero } from "@/components/felicette/FelicetteHero";
import { useI18n } from "@/i18n/I18nProvider";
import type { I18nKey } from "@/i18n/types";
import type { MissionConfig } from "@/lib/types";
import { useMission } from "@/state/MissionContext";
import { DESKTOP_QUERY, useMediaQuery } from "@/state/useMediaQuery";
import { MissionBrief } from "./MissionBrief";
import { OptionCard } from "./OptionCard";
import { PreviewCard } from "./PreviewCard";
import { CONFIG_STEPS } from "./steps";

const LAST = CONFIG_STEPS.length - 1;

/** Desktop grid placement and option columns per question. */
const DESKTOP_LAYOUT: Record<keyof MissionConfig, { span: string; cols: string }> = {
  target: { span: "lg:col-span-2", cols: "lg:grid-cols-2" },
  footprint: { span: "", cols: "" },
  mobility: { span: "", cols: "" },
  crew: { span: "lg:col-span-2", cols: "lg:grid-cols-3" },
};

export function MissionConfigurator({ onLaunch }: { onLaunch: () => void }) {
  const { t } = useI18n();
  const { config, update, fromLink } = useMission();
  const desktop = useMediaQuery(DESKTOP_QUERY);
  // A shared link already carries a full mission: start at the last question, ready to launch.
  const [step, setStep] = useState(fromLink ? LAST : 0);
  const [commentKey, setCommentKey] = useState<I18nKey>("felicette.intro");

  const comment = t(commentKey);

  function submit(e: FormEvent) {
    e.preventDefault();
    onLaunch();
  }

  // Distinct keys: React must not reuse the "Next" <button> as the submit button, or the click that
  // reaches the last question would also submit the form (the type flips during the same click).
  const launchButton = (extra = "") => (
    <button
      key="launch"
      type="submit"
      className={`flex min-h-12 items-center justify-center gap-2 whitespace-nowrap rounded-lg bg-amber px-4 text-sm font-bold uppercase tracking-wider lg:tracking-widest text-bg transition-transform hover:brightness-110 active:scale-[0.98] ${extra}`}
    >
      <Rocket aria-hidden size={18} />
      {t("config.launch")}
    </button>
  );

  return (
    <form
      onSubmit={submit}
      aria-labelledby="configurator-title"
      className="flex h-full flex-col lg:mx-auto lg:grid lg:h-auto lg:max-w-6xl lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start lg:gap-8 lg:p-6"
    >
      <div className="flex min-h-0 flex-1 flex-col lg:block">
        <header className="flex items-baseline justify-between gap-3 px-4 pt-4 lg:px-0 lg:pt-0">
          <h2 id="configurator-title" className="text-sm font-bold uppercase tracking-widest text-phosphor">
            {t("config.heading")}
          </h2>
          <p className="text-xs text-dim lg:hidden">
            {t("config.stepOf", { n: step + 1, total: CONFIG_STEPS.length })}
          </p>
        </header>

        <FelicetteHero key={comment} text={comment} className="mt-3 px-4 lg:hidden" />

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 lg:mt-4 lg:grid lg:grid-cols-2 lg:gap-x-6 lg:gap-y-5 lg:overflow-visible lg:p-0">
          {CONFIG_STEPS.map((s, i) => {
            const layout = DESKTOP_LAYOUT[s.field];
            return (
              <fieldset key={s.field} className={`${i === step ? "block" : "hidden"} lg:block ${layout.span}`}>
                <legend className="mb-3 text-lg font-bold text-fg lg:mb-2 lg:text-xs lg:uppercase lg:tracking-widest lg:text-amber">
                  <span aria-hidden className="mr-2 text-amber lg:hidden">
                    {">"}
                  </span>
                  {t(s.titleKey)}
                </legend>
                <div className={`grid gap-2 ${layout.cols}`}>
                  {s.options.map((o) => (
                    <OptionCard
                      key={o.id}
                      name={s.field}
                      value={o.id}
                      checked={config[s.field] === o.id}
                      onSelect={(value) => {
                        update({ [s.field]: value } as Partial<MissionConfig>);
                        setCommentKey(o.commentKey);
                      }}
                      title={t(o.titleKey)}
                      subtitle={t(o.subtitleKey)}
                      Icon={o.Icon}
                    />
                  ))}
                </div>
              </fieldset>
            );
          })}
        </div>

        {/* Phone controls: Back · progress dots · Next / Launch */}
        <div className="flex items-center gap-2 border-t border-line bg-bg px-4 py-3 lg:hidden">
          <button
            type="button"
            onClick={() => setStep((s) => Math.max(0, s - 1))}
            disabled={step === 0}
            aria-label={t("config.back")}
            className="flex min-h-12 min-w-12 items-center justify-center rounded-lg border border-line text-fg disabled:opacity-30"
          >
            <ChevronLeft aria-hidden size={20} />
          </button>

          <ol aria-label={t("config.progressAria")} className="flex flex-1 items-center justify-center">
            {CONFIG_STEPS.map((s, i) => (
              <li key={s.field}>
                <button
                  type="button"
                  onClick={() => setStep(i)}
                  aria-label={t("config.stepOf", { n: i + 1, total: CONFIG_STEPS.length })}
                  aria-current={i === step ? "step" : undefined}
                  className="flex min-h-11 min-w-6 items-center justify-center"
                >
                  <span
                    aria-hidden
                    className={`block h-2 rounded-full transition-all ${
                      i === step ? "w-6 bg-phosphor" : i < step ? "w-2 bg-phosphor/60" : "w-2 bg-line"
                    }`}
                  />
                </button>
              </li>
            ))}
          </ol>

          {step < LAST ? (
            <button
              key="next"
              type="button"
              onClick={() => setStep((s) => Math.min(LAST, s + 1))}
              className="flex min-h-12 items-center gap-1 rounded-lg border border-amber px-4 text-sm font-bold uppercase tracking-wider text-amber hover:bg-amber/10"
            >
              {t("config.next")}
              <ChevronRight aria-hidden size={18} />
            </button>
          ) : (
            launchButton()
          )}
        </div>
      </div>

      {/* Desktop side panel */}
      <aside className="hidden space-y-4 lg:sticky lg:top-6 lg:block">
        <FelicetteHero key={comment} text={comment} />
        {desktop && <PreviewCard />}
        {launchButton("w-full")}
        <MissionBrief />
        <p className="text-[11px] leading-relaxed text-dim">{t("config.shareHint")}</p>
      </aside>
    </form>
  );
}
