"use client";

import { useI18n } from "@/i18n/I18nProvider";
import { useMission } from "@/state/MissionContext";
import { CONFIG_STEPS, selectedOption } from "./steps";

/** Compact read-out of the configured mission (also reused by the Mission Report later). */
export function MissionBrief({ className = "" }: { className?: string }) {
  const { t } = useI18n();
  const { config } = useMission();
  return (
    <section className={`rounded-lg border border-line bg-panel p-3 ${className}`}>
      <h3 className="mb-2 text-[11px] font-bold uppercase tracking-widest text-dim">{t("config.briefTitle")}</h3>
      <dl className="space-y-1.5 text-xs">
        {CONFIG_STEPS.map((step) => {
          const opt = selectedOption(step, config);
          return (
            <div key={step.field} className="flex items-baseline gap-2">
              <dt className="w-2/5 shrink-0 text-dim">{t(step.titleKey)}</dt>
              <dd className="min-w-0 flex-1 font-bold text-fg">{opt ? t(opt.titleKey) : "—"}</dd>
            </div>
          );
        })}
      </dl>
    </section>
  );
}
