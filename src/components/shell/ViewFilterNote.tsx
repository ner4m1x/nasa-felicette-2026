"use client";

/**
 * Shown wherever the display-only "Hide ice-sheet candidates" filter is on (deck and map). When it is
 * on because it is the target's default (lava tube), a second line says so.
 */

import { docUrl } from "@/data/project";
import { useI18n } from "@/i18n/I18nProvider";

export function ViewFilterNote({
  onClear,
  byDefault = false,
  className = "",
}: {
  onClear?: () => void;
  byDefault?: boolean;
  className?: string;
}) {
  const { t } = useI18n();
  return (
    <p role="status" className={`rounded-control border border-sky/50 bg-panel/95 px-3 py-1.5 text-[11px] leading-snug text-sky ${className}`}>
      <a href={docUrl("METHOD_LOG.md")} target="_blank" rel="noreferrer" className="underline decoration-dotted underline-offset-2">
        {t("map.viewFilter.note")}
      </a>
      {byDefault && (
        <>
          <br />
          <a href={docUrl("METHOD_LOG.md")} target="_blank" rel="noreferrer" className="font-bold underline decoration-dotted underline-offset-2">
            {t("map.viewFilter.defaultOn")}
          </a>
        </>
      )}
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
