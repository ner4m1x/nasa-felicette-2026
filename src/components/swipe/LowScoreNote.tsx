"use client";

/**
 * One-line reason for a very low Analog Score (< LOW_SCORE), from the weakest dimension(s) with
 * their real values (src/lib/lowScore.ts), plus the "strict by design" footnote.
 */

import { TriangleAlert } from "lucide-react";
import { useI18n } from "@/i18n/I18nProvider";
import type { I18nKey } from "@/i18n/types";
import type { LowScoreReason } from "@/lib/lowScore";
import { featureValueText } from "@/lib/userCards";

export function useLowScoreText() {
  const { t, lang } = useI18n();
  return (reason: LowScoreReason): string => {
    const phrases = reason.items.map((it) => {
      const key = `lowScore.phrase.${it.feature}.${it.dir}` as I18nKey;
      const p = t(key);
      return p === key ? t(it.dir === "high" ? "lowScore.otherHigh" : "lowScore.otherLow", { label: it.feature }) : p;
    });
    const joined = phrases.join(t("lowScore.and"));
    return t("lowScore.sentence", {
      phrases: joined.charAt(0).toUpperCase() + joined.slice(1),
      body: t(`lowScore.body.${reason.body}`),
      values: reason.items.map((it) => featureValueText(it.feature, it.value, lang)).join(", "),
    });
  };
}

export function LowScoreNote({ reason, className = "" }: { reason: LowScoreReason; className?: string }) {
  const { t } = useI18n();
  const text = useLowScoreText();
  return (
    <div className={`rounded-control border border-hiss/40 px-2.5 py-1.5 ${className}`}>
      <p className="flex items-start gap-1.5 text-xs font-bold leading-snug text-hiss">
        <TriangleAlert aria-hidden size={13} className="mt-0.5 shrink-0" />
        <span>{text(reason)}</span>
      </p>
      <p className="mt-0.5 text-[10px] leading-snug text-dim">{t("lowScore.footnote")}</p>
    </div>
  );
}
