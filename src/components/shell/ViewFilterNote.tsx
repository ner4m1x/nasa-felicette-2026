"use client";

/** Shown wherever the display-only "Hide ice-sheet candidates" filter is on (deck and map). */

import { docUrl } from "@/data/project";
import { useI18n } from "@/i18n/I18nProvider";

export function ViewFilterNote({ onClear, className = "" }: { onClear?: () => void; className?: string }) {
  const { t } = useI18n();
  return (
    <p role="status" className={`rounded-control border border-sky/50 bg-panel/95 px-3 py-1.5 text-[11px] leading-snug text-sky ${className}`}>
      <a href={docUrl("METHOD_LOG.md")} target="_blank" rel="noreferrer" className="underline decoration-dotted underline-offset-2">
        {t("map.viewFilter.note")}
      </a>
      {onClear && (
        <>
          {" "}
          <button type="button" onClick={onClear} className="font-bold underline underline-offset-2 hover:text-fg">
            {t("map.viewFilter.clear")}
          </button>
        </>
      )}
    </p>
  );
}
