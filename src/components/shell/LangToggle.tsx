"use client";

import { useI18n } from "@/i18n/I18nProvider";
import { LANGS, type Lang } from "@/i18n/types";
import type { I18nKey } from "@/i18n/types";

const SHORT: Record<Lang, I18nKey> = { en: "lang.en", pl: "lang.pl" };
const NAME: Record<Lang, I18nKey> = { en: "lang.enName", pl: "lang.plName" };

/** `[EN | PL]` segmented toggle. */
export function LangToggle() {
  const { lang, setLang, t } = useI18n();
  return (
    <div
      role="group"
      aria-label={t("lang.groupAria")}
      className="flex items-center rounded-md border border-line text-xs"
    >
      <span aria-hidden className="pl-2 text-dim">
        [
      </span>
      {LANGS.map((l, i) => (
        <span key={l} className="flex items-center">
          {i > 0 && (
            <span aria-hidden className="text-dim">
              |
            </span>
          )}
          <button
            type="button"
            lang={l}
            aria-pressed={lang === l}
            aria-label={t(NAME[l])}
            onClick={() => setLang(l)}
            className={`min-h-11 min-w-10 px-1.5 font-bold tracking-wider ${
              lang === l ? "text-amber" : "text-dim hover:text-fg"
            }`}
          >
            {t(SHORT[l])}
          </button>
        </span>
      ))}
      <span aria-hidden className="pr-2 text-dim">
        ]
      </span>
    </div>
  );
}
