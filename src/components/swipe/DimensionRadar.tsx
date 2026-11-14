"use client";

/**
 * Per-dimension analog scores (0..1 from the frozen pipeline, shown 0–100) as a Recharts radar.
 * Axes are numbered so the chart fits a phone; the legend below names every axis (scientific
 * label + Félicette's label) with its value and marks the limiting dimension. Never one
 * unexplained number. Radars need ≥ 3 axes: with fewer, only the legend is shown.
 */

import { useReducedMotion } from "framer-motion";
import { PolarAngleAxis, PolarGrid, PolarRadiusAxis, Radar, RadarChart, ResponsiveContainer } from "recharts";
import { useI18n } from "@/i18n/I18nProvider";
import type { AnalogEntry } from "@/lib/types";
import { to100 } from "./parts";

const MIN_RADAR_AXES = 3;

export function DimensionRadar({ entry }: { entry: AnalogEntry | null }) {
  const { t, dim } = useI18n();
  const reduceMotion = useReducedMotion();

  if (!entry || Object.keys(entry.dims).length === 0) {
    return <p className="text-xs text-dim">{t("scan.radarNone")}</p>;
  }

  const rows = Object.entries(entry.dims).map(([id, value], i) => ({
    id,
    axis: String(i + 1),
    value: to100(value),
    label: dim(id),
    limiting: id === entry.limiting,
  }));

  return (
    <div>
      <h4 className="text-[11px] font-bold uppercase tracking-wider text-score-analog">{t("scan.radarTitle")}</h4>
      <p className="mt-0.5 text-[10px] leading-snug text-dim">{t("scan.radarHint")}</p>

      {rows.length >= MIN_RADAR_AXES ? (
        <div className="purr-radar mx-auto mt-1 h-52 w-full max-w-[260px] text-score-analog" aria-hidden>
          <ResponsiveContainer width="100%" height="100%">
            <RadarChart data={rows} outerRadius="72%">
              <PolarGrid />
              <PolarAngleAxis dataKey="axis" tick={{ fontSize: 11 }} />
              <PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} />
              <Radar
                dataKey="value"
                stroke="currentColor"
                fill="currentColor"
                fillOpacity={0.25}
                isAnimationActive={!reduceMotion}
              />
            </RadarChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <p className="mt-1 text-[10px] text-dim">{t("scan.radarFew")}</p>
      )}

      <ol className="mt-2 space-y-1.5">
        {rows.map((r) => (
          <li key={r.id} className="flex items-start gap-2 text-xs">
            <span className="w-4 shrink-0 text-right font-bold tabular-nums text-score-analog">{r.axis}</span>
            <span className="min-w-0 flex-1">
              <span className="block leading-snug">
                {r.label.sci}
                {r.limiting && (
                  <span className="ml-1 rounded-pill border border-amber/60 px-1.5 text-[9px] uppercase tracking-wider text-amber">
                    {t("scan.limitingTag")}
                  </span>
                )}
              </span>
              {r.label.cat && <span className="block text-[10px] italic text-dim">{r.label.cat}</span>}
            </span>
            <span className="shrink-0 font-bold tabular-nums">{r.value}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}
