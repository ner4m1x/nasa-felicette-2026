"use client";

/**
 * Compact per-dimension analog radar for the card front (0..1 from the frozen pipeline, shown 0–100).
 * Hand-drawn SVG (no chart library) so it renders at a fixed, tiny size inside a swiping card.
 * Axes are numbered; `DimensionLegend` names every axis with its value (limiting dimension in full,
 * in amber; the rest as short labels) — never one unexplained number. Radars need ≥ 3 axes: with fewer,
 * only the legend is shown. Cards without dims get `DimensionNone` instead of an empty chart.
 */

import { useI18n } from "@/i18n/I18nProvider";
import { radarGeometry } from "@/lib/radar";
import type { AnalogEntry } from "@/lib/types";
import { to100 } from "./parts";

export const MIN_RADAR_AXES = 3;
/** viewBox side and the margin kept for the axis numbers (the rendered size is --radar-size) */
const VIEW = 120;
const PAD = 15;

export function hasDims(entry: AnalogEntry | null | undefined): entry is AnalogEntry {
  return !!entry && Object.keys(entry.dims).length > 0;
}

/** The radar itself (decorative: the legend carries the data for assistive tech). */
export function DimensionRadar({ entry, className = "" }: { entry: AnalogEntry; className?: string }) {
  const keys = Object.keys(entry.dims);
  if (keys.length < MIN_RADAR_AXES) return null;
  const g = radarGeometry(entry.dims, entry.limiting, VIEW, PAD);
  const lim = g.axes.find((a) => a.limiting);

  return (
    <svg viewBox={`0 0 ${VIEW} ${VIEW}`} aria-hidden className={`block w-(--radar-size) shrink-0 ${className}`}>
      {g.rings.map((pts, i) => (
        <polygon key={i} points={pts} fill="none" stroke="var(--radar-grid)" strokeWidth={1} />
      ))}
      {g.axes.map((a) => (
        <line
          key={a.id}
          x1={VIEW / 2}
          y1={VIEW / 2}
          x2={a.ax}
          y2={a.ay}
          stroke={a.limiting ? "var(--radar-limiting)" : "var(--radar-grid)"}
          strokeWidth={a.limiting ? 1.25 : 1}
          strokeDasharray={a.limiting ? "2 2" : undefined}
        />
      ))}
      <polygon
        points={g.polygon}
        fill="var(--radar-line)"
        stroke="var(--radar-line)"
        strokeWidth={1.25}
        strokeLinejoin="round"
        style={{ fillOpacity: "var(--radar-fill-opacity)" }}
      />
      {g.axes.map((a) =>
        a.limiting ? null : <circle key={a.id} cx={a.x} cy={a.y} r={1.6} fill="var(--radar-line)" />,
      )}
      {lim && <circle cx={lim.x} cy={lim.y} r={3} fill="var(--radar-limiting)" stroke="var(--panel)" strokeWidth={1} />}
      {g.axes.map((a) => (
        <text
          key={a.id}
          x={a.lx}
          y={a.ly}
          textAnchor="middle"
          dominantBaseline="central"
          fontSize={9}
          fontWeight={a.limiting ? 700 : 400}
          fill={a.limiting ? "var(--radar-limiting)" : "var(--dim)"}
        >
          {a.n}
        </text>
      ))}
    </svg>
  );
}

/**
 * Compact numbered legend: the limiting dimension in full (amber, with its tag), every other axis as
 * a numbered short label + value. Full scientific and Félicette labels are in each row's tooltip.
 */
export function DimensionLegend({ entry, className = "" }: { entry: AnalogEntry; className?: string }) {
  const { t, dim } = useI18n();
  const rows = Object.keys(entry.dims).map((id, i) => ({ id, n: i + 1, label: dim(id), value: to100(entry.dims[id]) }));
  const lim = rows.find((r) => r.id === entry.limiting) ?? null;
  const rest = rows.filter((r) => r !== lim);
  const tip = (r: (typeof rows)[number]) => (r.label.cat ? `${r.label.sci} — ${r.label.cat}` : r.label.sci);

  return (
    <div className={`min-w-0 ${className}`}>
      <p className="text-[10px] font-bold uppercase tracking-wider text-score-analog">
        {t("scan.radarTitle")} <span className="font-normal text-dim">· 0–100</span>
      </p>
      {rows.length < MIN_RADAR_AXES && <p className="mt-0.5 text-[10px] text-dim">{t("scan.radarFew")}</p>}
      {lim && (
        <p title={tip(lim)} className="mt-1 flex items-baseline gap-1.5 text-[10px] font-bold leading-tight text-amber">
          <span className="w-2.5 shrink-0 text-right tabular-nums">{lim.n}</span>
          <span className="min-w-0 flex-1">
            {lim.label.sci}{" "}
            <span className="whitespace-nowrap rounded-pill border border-amber/60 px-1 text-[8px] uppercase tracking-wider">
              {t("scan.limitingTag")}
            </span>
          </span>
          <span className="shrink-0 tabular-nums">{lim.value}</span>
        </p>
      )}
      <ol className="mt-1 grid gap-x-3 gap-y-0.5 lg:grid-cols-2">
        {rest.map((r) => (
          <li key={r.id} title={tip(r)} className="flex min-w-0 items-baseline gap-1.5 text-[10px] leading-tight text-fg/90">
            <span className="w-2.5 shrink-0 text-right tabular-nums text-score-analog">{r.n}</span>
            <span className="min-w-0 flex-1 truncate">{r.label.short}</span>
            <span className="shrink-0 font-bold tabular-nums">{r.value}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}

/** Curated / operational cards (or any card without per-dimension scores). */
export function DimensionNone() {
  const { t } = useI18n();
  return (
    <p className="rounded-control border border-dashed border-line px-3 py-2 text-[10px] leading-snug text-dim">
      {t("scan.radarNone")}
    </p>
  );
}
