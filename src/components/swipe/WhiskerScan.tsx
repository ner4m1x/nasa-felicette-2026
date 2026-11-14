"use client";

/**
 * "Scan with whiskers": fetches the live NASA POWER climatology for the card's coordinates, then
 * reveals the per-dimension DimensionRadar. Every POWER value is shown with the units and long
 * name read from the response itself.
 */

import { Loader2, RotateCcw, ScanSearch } from "lucide-react";
import { useState } from "react";
import { useI18n } from "@/i18n/I18nProvider";
import type { Lang } from "@/i18n/types";
import { fetchPowerClimatology, POWER_PARAMETERS, type PowerClimatology } from "@/lib/power";
import type { AnalogEntry } from "@/lib/types";
import { DimensionRadar } from "./DimensionRadar";

type ScanState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "done"; data: PowerClimatology }
  | { status: "error" };

interface WhiskerScanProps {
  lat: number;
  lon: number;
  entry: AnalogEntry | null;
  /** only the top card's controls are focusable */
  interactive: boolean;
}

const fmt = (lang: Lang, v: number) => new Intl.NumberFormat(lang, { maximumFractionDigits: 2 }).format(v);

export function WhiskerScan({ lat, lon, entry, interactive }: WhiskerScanProps) {
  const { t, lang } = useI18n();
  const [state, setState] = useState<ScanState>({ status: "idle" });

  const scan = () => {
    setState({ status: "loading" });
    fetchPowerClimatology(lat, lon).then(
      (data) => setState({ status: "done", data }),
      () => setState({ status: "error" }),
    );
  };

  if (state.status === "idle" || state.status === "loading") {
    const loading = state.status === "loading";
    return (
      <button
        type="button"
        onClick={scan}
        disabled={loading}
        tabIndex={interactive ? 0 : -1}
        className="flex min-h-11 w-full items-center justify-center gap-2 rounded-control border border-phosphor/60 text-xs font-bold uppercase tracking-wider text-phosphor hover:bg-phosphor/10 disabled:opacity-70"
      >
        {loading ? <Loader2 aria-hidden size={16} className="animate-spin" /> : <ScanSearch aria-hidden size={16} />}
        {loading ? t("card.scanning") : t("card.scan")}
      </button>
    );
  }

  if (state.status === "error") {
    return (
      <div className="space-y-2" role="status">
        <p className="text-xs text-danger">{t("scan.unavailable")}</p>
        <button
          type="button"
          onClick={scan}
          tabIndex={interactive ? 0 : -1}
          className="flex min-h-11 w-full items-center justify-center gap-2 rounded-control border border-amber/60 text-xs font-bold uppercase tracking-wider text-amber hover:bg-amber/10"
        >
          <RotateCcw aria-hidden size={14} />
          {t("card.retry")}
        </button>
        <DimensionRadar entry={entry} />
      </div>
    );
  }

  const { data } = state;
  const params = POWER_PARAMETERS.filter((id) => data.parameters[id]);
  return (
    <div className="space-y-4" role="status">
      <section className="rounded-control border border-line bg-panel-2 p-3">
        <h4 className="text-[11px] font-bold uppercase tracking-wider text-phosphor">{t("scan.title")}</h4>
        <dl className="mt-2 space-y-1.5">
          {params.map((id) => {
            const p = data.parameters[id];
            return (
              <div key={id} className="flex items-baseline justify-between gap-2 text-xs">
                <dt className="min-w-0 text-dim">{p.longname}</dt>
                <dd className="shrink-0 font-bold tabular-nums">
                  {p.annual === null ? "—" : fmt(lang, p.annual)}{" "}
                  <span className="font-normal text-dim">
                    {p.units} · {t("scan.annual")}
                  </span>
                </dd>
              </div>
            );
          })}
        </dl>
        <p className="mt-2 text-[10px] leading-snug text-dim">
          {t("scan.queried", { lat: fmt(lang, data.lat), lon: fmt(lang, data.lon) })}
          {data.range && (
            <>
              <br />
              {t("scan.period", { range: data.range })}
            </>
          )}
          <br />
          {t("scan.source")}
        </p>
      </section>
      <DimensionRadar entry={entry} />
    </div>
  );
}
