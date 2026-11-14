"use client";

/**
 * Earth's fundamental limits: the same for every Earth site, so kept out of all scores.
 * Every number is read from src/data/sources.ts (NASA fact sheets, verified: false).
 * Bottom sheet on phones, centered modal on desktop (native <dialog>: focus trap + Esc for free).
 */

import { ExternalLink, X } from "lucide-react";
import { useEffect, useRef } from "react";
import { getSource, SOURCES, type SourceId } from "@/data/sources";
import { useI18n } from "@/i18n/I18nProvider";
import type { I18nKey, I18nParams, Lang } from "@/i18n/types";

/** 1 mb = 0.1 kPa (unit conversion, not data). */
const KPA_PER_MB = 0.1;

const moon = SOURCES["nssdc-moon-factsheet"].values;
const mars = SOURCES["nssdc-mars-factsheet"].values;

function fmt(lang: Lang, value: number, maxFractionDigits = 2, minFractionDigits = 0): string {
  return new Intl.NumberFormat(lang, {
    minimumFractionDigits: minFractionDigits,
    maximumFractionDigits: maxFractionDigits,
  }).format(value);
}

/** 3e-15 → "3 × 10⁻¹⁵" */
function fmtSci(lang: Lang, value: number): string {
  const exp = Math.floor(Math.log10(Math.abs(value)));
  const mantissa = value / 10 ** exp;
  const sup = String(exp).replace(/[-0-9]/g, (c) => "⁻⁰¹²³⁴⁵⁶⁷⁸⁹"["-0123456789".indexOf(c)]);
  return `${fmt(lang, mantissa)} × 10${sup}`;
}

interface LimitItem {
  id: string;
  titleKey: I18nKey;
  bodyKey: I18nKey;
  params?: (lang: Lang) => I18nParams;
  sourceIds: SourceId[];
}

const ITEMS: LimitItem[] = [
  {
    id: "gravity",
    titleKey: "limits.gravity.title",
    bodyKey: "limits.gravity.body",
    params: (lang) => ({
      moon: fmt(lang, moon.surfaceGravity.value),
      moonRatio: fmt(lang, moon.surfaceGravityRatioToEarth.value, 3),
      mars: fmt(lang, mars.surfaceGravityMean.value),
      marsRatio: fmt(lang, mars.surfaceGravityRatioToEarth.value),
    }),
    sourceIds: ["nssdc-moon-factsheet", "nssdc-mars-factsheet"],
  },
  {
    id: "atmosphere",
    titleKey: "limits.atmosphere.title",
    bodyKey: "limits.atmosphere.body",
    params: (lang) => ({
      marsKpa: fmt(lang, mars.surfacePressureMean.value * KPA_PER_MB),
      marsMb: fmt(lang, mars.surfacePressureMean.value),
      minMb: fmt(lang, mars.surfacePressureSeasonalMin.value, 1, 1), // source prints "4.0"
      maxMb: fmt(lang, mars.surfacePressureSeasonalMax.value, 1, 1),
      moonBar: fmtSci(lang, moon.surfacePressureNight.value),
    }),
    sourceIds: ["nssdc-mars-factsheet", "nssdc-moon-factsheet", "nasa-science-moon-facts"],
  },
  {
    id: "radiation",
    titleKey: "limits.radiation.title",
    bodyKey: "limits.radiation.body",
    sourceIds: ["nasa-science-mars-facts", "nasa-science-moon-facts", "nasa-space-radiation"],
  },
  {
    id: "dust",
    titleKey: "limits.dust.title",
    bodyKey: "limits.dust.body",
    sourceIds: ["nasa-science-moon-dust"],
  },
];

interface EarthLimitsSheetProps {
  open: boolean;
  onClose: () => void;
}

export function EarthLimitsSheet({ open, onClose }: EarthLimitsSheetProps) {
  const { t, lang } = useI18n();
  const ref = useRef<HTMLDialogElement>(null);

  // Sync the native dialog (external system) with the `open` prop.
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-labelledby="earth-limits-title"
      onClose={onClose}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose(); // click on the backdrop
      }}
      className="purr-sheet mb-0 mt-auto max-h-[85dvh] w-full max-w-full rounded-t-2xl border border-b-0 border-line bg-panel p-0 text-fg lg:m-auto lg:max-h-[80dvh] lg:max-w-xl lg:rounded-2xl lg:border-b"
    >
      <div className="flex max-h-[inherit] flex-col">
        <div className="flex items-start gap-3 border-b border-line px-4 pb-3 pt-2 lg:pt-4">
          <div className="min-w-0 flex-1">
            <span aria-hidden className="mx-auto mb-2 block h-1 w-10 rounded-full bg-line lg:hidden" />
            <h2 id="earth-limits-title" className="text-glow text-base font-bold uppercase tracking-wider text-amber">
              {t("limits.title")}
            </h2>
            <p className="mt-1 text-xs text-dim">{t("limits.intro")}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t("limits.close")}
            className="flex min-h-11 min-w-11 items-center justify-center rounded-md text-dim hover:text-fg"
          >
            <X aria-hidden size={20} />
          </button>
        </div>

        <ul className="flex-1 space-y-4 overflow-y-auto px-4 py-4 pb-[calc(env(safe-area-inset-bottom)+1rem)]">
          {ITEMS.map((item) => (
            <li key={item.id} className="rounded-lg border border-line bg-panel-2 p-3">
              <h3 className="text-sm font-bold uppercase tracking-wider text-phosphor">{t(item.titleKey)}</h3>
              <p className="mt-1 text-sm leading-relaxed">{t(item.bodyKey, item.params?.(lang))}</p>
              <p className="mt-2 text-[11px] text-dim">
                {t("limits.sources")}:{" "}
                {item.sourceIds.map((id, i) => {
                  const src = getSource(id);
                  if (!src) return null;
                  return (
                    <span key={id}>
                      {i > 0 && " · "}
                      {src.url ? (
                        <a
                          href={src.url}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-0.5 underline decoration-dotted underline-offset-2 hover:text-fg"
                        >
                          {src.title}
                          <ExternalLink aria-hidden size={10} />
                        </a>
                      ) : (
                        src.title
                      )}
                      {!src.verified && <sup title={t("limits.unverified")}>*</sup>}
                    </span>
                  );
                })}
              </p>
            </li>
          ))}
          <li className="text-[11px] text-dim">* {t("limits.unverified")}</li>
          <li className="text-center text-xs italic text-dim">
            =^.^= {t("felicette.name")}: {t("limits.cat")}
          </li>
        </ul>
      </div>
    </dialog>
  );
}
