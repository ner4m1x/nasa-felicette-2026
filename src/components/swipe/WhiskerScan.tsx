"use client";

/**
 * "Scan with whiskers": fetches the live NASA POWER climatology for the card's coordinates as an
 * independent cross-check. (The per-dimension radar is always on the card front; this no longer
 * gates it.) POWER values use the units read from the response, mapped to display units; the full
 * parameter name stays in a tooltip.
 */

import { Loader2, RotateCcw, ScanSearch } from "lucide-react";
import { useState } from "react";
import { useI18n } from "@/i18n/I18nProvider";
import type { Lang } from "@/i18n/types";
import { fetchPowerClimatology, type PowerClimatology } from "@/lib/power";
import { PowerValueList } from "./PowerValueList";

type ScanState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "done"; data: PowerClimatology }
  | { status: "error" };

interface WhiskerScanProps {
  lat: number;
  lon: number;
  /** only the top card's controls are focusable */
  interactive: boolean;
}

const fmt = (lang: Lang, v: number) => new Intl.NumberFormat(lang, { maximumFractionDigits: 2 }).format(v);

export function WhiskerScan({ lat, lon, interactive }: WhiskerScanProps) {
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
      </div>
    );
  }

  const { data } = state;
  return (
    <div role="status">
      <section className="rounded-control border border-line bg-panel-2 p-3">
        <h4 className="text-[11px] font-bold uppercase tracking-wider text-dim">{t("scan.title")}</h4>
        <div className="mt-2">
          <PowerValueList data={data} />
        </div>
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
    </div>
  );
}
