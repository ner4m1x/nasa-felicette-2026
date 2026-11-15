"use client";

/** Report → Methods & data: every planetary reference value with its instrument and citation. */

import { ExternalLink } from "lucide-react";
import { usePlanetaryFormat } from "@/components/planetary/PlanetaryComparison";
import { PLANETARY_REFERENCE } from "@/data/planetaryReference";
import { getSource } from "@/data/sources";
import { TARGETS } from "@/data/targets";
import { useI18n } from "@/i18n/I18nProvider";

export function PlanetaryReferenceList() {
  const { t } = useI18n();
  const { planetValue } = usePlanetaryFormat();
  return (
    <section>
      <h4 className="text-[11px] font-bold uppercase tracking-wider text-dim">{t("planetary.methodsTitle")}</h4>
      <ul className="mt-1.5 space-y-1 text-xs">
        {PLANETARY_REFERENCE.map((ref) => {
          const src = getSource(ref.sourceId);
          return (
            <li key={ref.id} className="break-words">
              <span className="text-dim">{t(TARGETS[ref.target].labelKey)} · </span>
              {t(ref.labelKey)}: <b className="tabular-nums">{planetValue(ref)}</b>
              <span className="text-dim"> · {ref.instrument} · </span>
              {src?.url ? (
                <a
                  href={src.url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 underline decoration-dotted underline-offset-2 hover:text-phosphor"
                >
                  {src.publisher}
                  <ExternalLink aria-hidden size={10} />
                </a>
              ) : (
                <span>{src?.publisher ?? ref.sourceId}</span>
              )}
              {src && !src.verified && (
                <sup className="text-dim" title={t("breakdown.unverified")}>
                  *
                </sup>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
