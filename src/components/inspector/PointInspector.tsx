"use client";

/**
 * Point inspector: tap/click anywhere on the map.
 * 1. Analog & Mission Fit "from global scan": read from the pipeline grid (src/lib/scanGrid.ts);
 *    "pending" until scan_grid_meta.json + scan_grid.bin.gz are published.
 * 2. Live NASA POWER climatology (src/lib/power.ts): annual values with the units read from the
 *    response (mapped to display units), plus a small monthly chart. Debounced; stale requests are aborted; cached.
 *    All four targets side by side (TargetComparison), best highlighted; Mission Fit and the
 *    detailed breakdown stay for the configured target. PlanetaryComparison follows the best target.
 * 3. Cross-check: "POWER: X mm/yr, our grid: Y mm/yr" — shown side by side, never blended.
 */

import { Loader2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { FelicetteSays } from "@/components/felicette/FelicetteSays";
import { PlanetaryComparison } from "@/components/planetary/PlanetaryComparison";
import { formatCoords, reasonText, ScoreBar } from "@/components/swipe/parts";
import { AddToDeck, type DeckAction } from "./AddToDeck";
import { TargetComparison } from "./TargetComparison";
import { PowerValueList } from "@/components/swipe/PowerValueList";
import { TARGETS } from "@/data/targets";
import { useI18n } from "@/i18n/I18nProvider";
import type { Lang } from "@/i18n/types";
import { LowScoreNote } from "@/components/swipe/LowScoreNote";
import { bestTarget, targetRows } from "@/lib/bestTarget";
import { lowScoreFromSample } from "@/lib/lowScore";
import { precipCrossCheck } from "@/lib/crossCheck";
import { displayUnit } from "@/lib/format";
import { HONESTY_NOTE_KEY, missionFit } from "@/lib/missionFit";
import { analogFromSample, cardFromSample } from "@/lib/pointCard";
import {
  cachedPowerClimatology,
  fetchPowerClimatology,
  type PowerClimatology,
  type PowerParameterId,
} from "@/lib/power";
import type { ScanGridSample, ScanGridState } from "@/lib/scanGrid";
import type { MissionConfig } from "@/lib/types";

/** Wait this long after the last tap before calling POWER (UI tuning, not data). */
const DEBOUNCE_MS = 350;
const CHART_PARAMS: readonly PowerParameterId[] = ["TS", "PRECTOTCORR", "ALLSKY_SFC_SW_DWN"];

type PowerState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "done"; data: PowerClimatology }
  | { status: "error" };

interface PointInspectorProps {
  point: { lat: number; lon: number } | null;
  /** undefined = grid not requested/loading */
  grid: ScanGridState | undefined;
  config: MissionConfig;
  /** shared Add-to-deck state (useDeckAction in MapClient), shown as a sticky action row */
  deckAction: DeckAction;
  /** desktop: Félicette speaks from the panel header (FelicetteHero in MapClient), not in the body */
  heroInHeader?: boolean;
}

const fmt = (lang: Lang, v: number, digits = 2) => new Intl.NumberFormat(lang, { maximumFractionDigits: digits }).format(v);

function usePower(point: { lat: number; lon: number } | null) {
  const [retry, setRetry] = useState(0);
  const [state, setState] = useState<{ key: string | null; power: PowerState }>({ key: null, power: { status: "idle" } });
  const key = point ? `${point.lat},${point.lon},${retry}` : null;

  // Render-time reset for a new point (cached results show instantly).
  if (state.key !== key) {
    const hit = point ? cachedPowerClimatology(point.lat, point.lon) : null;
    setState({
      key,
      power: !point ? { status: "idle" } : hit ? { status: "done", data: hit } : { status: "loading" },
    });
  }

  // Debounced request (external system: network).
  useEffect(() => {
    if (!point || cachedPowerClimatology(point.lat, point.lon)) return;
    const ctrl = new AbortController();
    const timer = setTimeout(() => {
      fetchPowerClimatology(point.lat, point.lon, { signal: ctrl.signal }).then(
        (data) => !ctrl.signal.aborted && setState({ key, power: { status: "done", data } }),
        () => !ctrl.signal.aborted && setState({ key, power: { status: "error" } }),
      );
    }, DEBOUNCE_MS);
    return () => {
      clearTimeout(timer);
      ctrl.abort();
    };
  }, [point, key]);

  return { power: state.key === key ? state.power : ({ status: "loading" } as PowerState), retry: () => setRetry((n) => n + 1) };
}

export function PointInspector({ point, grid, config, deckAction, heroInHeader = false }: PointInspectorProps) {
  const { t, lang } = useI18n();
  const { power, retry } = usePower(point);
  const [chartParam, setChartParam] = useState<PowerParameterId>("TS");

  const sample = useMemo(
    () => (point && grid?.status === "ready" ? grid.grid.sample(point.lat, point.lon) : null),
    [point, grid],
  );

  // All four targets for this cell, and the best one (scores straight from the grid).
  const targets = useMemo(() => {
    if (!point || !sample || sample.land === false || grid?.status !== "ready") return null;
    const rows = targetRows(sample, (tid) => grid.grid.percentile(tid, point.lat, point.lon));
    const best = bestTarget(rows);
    return { rows, best, bestLow: best ? lowScoreFromSample(sample, best) : null };
  }, [point, sample, grid]);

  if (!point) {
    return (
      <div className="space-y-3 p-4">
        {!heroInHeader && <FelicetteSays key="map-intro" text={t("map.inspector.intro")} />}
        <p className="text-xs leading-relaxed text-dim">{t("map.inspector.hint")}</p>
      </div>
    );
  }

  const cross = precipCrossCheck(power.status === "done" ? power.data : null, sample);

  return (
    <div className="space-y-5 p-4">
      {/* Coordinates + Add-to-deck: sticky so the action stays in reach while the panel scrolls. */}
      <div className="sticky top-0 z-10 -mx-4 -mt-4 space-y-2 border-b border-line bg-panel px-4 pb-3 pt-4">
        <header id="inspector-header" tabIndex={-1} className="outline-none">
          <p className="text-[11px] font-bold uppercase tracking-wider text-amber">{t("map.inspector.title")}</p>
          <p className="mt-0.5 text-base font-bold tabular-nums">{formatCoords(lang, point.lat, point.lon)}</p>
        </header>
        {grid?.status !== "pending" && <AddToDeck action={deckAction} />}
      </div>

      {/* ---- 1. From the global scan ---- */}
      <section aria-labelledby="inspector-scan">
        <h3 id="inspector-scan" className="text-xs font-bold uppercase tracking-wider text-phosphor">
          {t("map.inspector.scanTitle")}
          {(!grid || grid.status !== "ready") && <span className="text-amber"> {t("map.inspector.pendingTag")}</span>}
        </h3>
        {targets && (
          <div className="mt-2">
            <TargetComparison rows={targets.rows} best={targets.best} bestLow={targets.bestLow} configured={config.target} showSummary={!heroInHeader} />
          </div>
        )}
        <GridSection
          grid={grid}
          sample={sample}
          point={point}
          config={config}
          lowShownAbove={targets?.best === config.target && targets.bestLow !== null}
        />
        <div className="mt-3">
          <PlanetaryComparison
            target={targets?.best ?? config.target}
            sample={sample && sample.land !== false ? sample : null}
            gridLoading={grid === undefined}
          />
        </div>
      </section>

      {/* ---- 2. Live NASA POWER ---- */}
      <section aria-labelledby="inspector-power" aria-live="polite">
        <h3 id="inspector-power" className="text-xs font-bold uppercase tracking-wider text-phosphor">
          {t("scan.title")}
        </h3>
        {power.status === "loading" && (
          <p className="mt-2 flex items-center gap-2 text-xs text-dim">
            <Loader2 aria-hidden size={14} className="animate-spin" />
            {t("card.scanning")}
          </p>
        )}
        {power.status === "error" && (
          <div className="mt-2 space-y-2">
            <p className="text-xs text-danger">{t("scan.unavailable")}</p>
            <button
              type="button"
              onClick={retry}
              className="flex min-h-11 items-center gap-2 rounded-control border border-amber/60 px-3 text-xs font-bold uppercase tracking-wider text-amber hover:bg-amber/10"
            >
              {t("card.retry")}
            </button>
          </div>
        )}
        {power.status === "done" && (
          <PowerSection data={power.data} chartParam={chartParam} onChartParam={setChartParam} />
        )}
      </section>

      {/* ---- 3. Cross-check ---- */}
      {cross && (
        <section className="rounded-control border border-sky/40 p-3 text-xs">
          <h3 className="text-[11px] font-bold uppercase tracking-wider text-sky">{t("map.inspector.crossTitle")}</h3>
          <p className="mt-1 tabular-nums">
            {t("map.inspector.crossLine", { power: fmt(lang, cross.powerMmYr, 0), grid: fmt(lang, cross.gridMmYr, 0) })}
          </p>
          <p className="mt-1 text-[10px] leading-snug text-dim">{t("map.inspector.crossNote")}</p>
        </section>
      )}

      <p className="text-[10px] italic leading-snug text-dim">
        {t(HONESTY_NOTE_KEY)} {t("map.inspector.targetNote", { target: t(TARGETS[config.target].labelKey) })}
      </p>
    </div>
  );
}

function GridSection({
  grid,
  sample,
  point,
  config,
  lowShownAbove,
}: {
  grid: ScanGridState | undefined;
  sample: ScanGridSample | null;
  point: { lat: number; lon: number };
  config: MissionConfig;
  /** the configured target is the best one and its low-score note is already shown above */
  lowShownAbove: boolean;
}) {
  const { t, lang, dim } = useI18n();

  if (!grid) {
    return (
      <p className="mt-2 flex items-center gap-2 text-xs text-dim">
        <Loader2 aria-hidden size={14} className="animate-spin" />
        {t("map.inspector.gridLoading")}
      </p>
    );
  }
  if (grid.status === "pending") return <p className="mt-2 text-xs leading-relaxed text-dim">{t("map.inspector.gridPending")}</p>;
  if (grid.status === "error") return <p className="mt-2 text-xs text-danger">{t("map.inspector.gridError", { error: grid.message })}</p>;
  if (!sample) return null;
  if (sample.land === false) return <p className="mt-2 text-xs text-dim">{t("map.inspector.noLand")}</p>;

  const analog = analogFromSample(sample, config.target);
  const low = lowShownAbove ? null : lowScoreFromSample(sample, config.target);
  const fit = missionFit(cardFromSample(sample, point.lat, point.lon), config);
  const dims = analog ? Object.entries(analog.dims) : [];

  return (
    <div className="mt-2 space-y-3">
      <p className="border-t border-line pt-2 text-[10px] uppercase tracking-wider text-dim">
        {t("map.inspector.fitNote", { target: t(TARGETS[config.target].labelKey) })}
      </p>
      <ScoreBar
        label={t("card.analog")}
        hint={t("card.analogHint")}
        value={analog?.total ?? null}
        outOf={t("card.outOf")}
        color="var(--score-analog)"
        detail={analog && analog.limiting ? t("card.limiting", { dim: dim(analog.limiting).sci }) : t("map.inspector.unscored")}
      />
      {low && <LowScoreNote reason={low} />}
      {dims.length > 0 && (
        <ul className="space-y-1">
          {dims.map(([id, v]) => (
            <li key={id} className="flex items-center gap-2 text-[11px]">
              <span className={`min-w-0 flex-1 truncate ${id === analog?.limiting ? "text-amber" : "text-dim"}`}>
                {dim(id).sci}
              </span>
              <span className="h-1.5 w-20 overflow-hidden rounded-pill bg-score-track" aria-hidden>
                <span className="block h-full rounded-pill bg-score-analog" style={{ width: `${Math.round(v * 100)}%` }} />
              </span>
              <span className="w-7 text-right tabular-nums">{Math.round(v * 100)}</span>
            </li>
          ))}
        </ul>
      )}
      <ScoreBar
        label={t("card.fit")}
        hint={t("card.fitHint")}
        value={fit.fit}
        outOf={t("card.outOf")}
        color="var(--score-fit)"
      />
      {fit.failed.length > 0 && (
        <ul className="space-y-1 text-[11px] leading-snug">
          {fit.failed.map((c) => (
            <li key={c.id} style={{ color: c.hard ? "var(--hiss)" : "var(--amber)" }}>
              {reasonText(t, dim, { key: c.reasonKey, params: c.params })}
            </li>
          ))}
        </ul>
      )}
      {fit.notes.length > 0 && (
        <ul className="space-y-0.5 text-[10px] text-dim">
          {fit.notes.map((n) => (
            <li key={n.key}>• {t(n.key, n.params)}</li>
          ))}
        </ul>
      )}
      <p className="text-[10px] leading-snug text-dim">
        {t("map.inspector.gridCell", {
          lat: fmt(lang, sample.cellLat),
          lon: fmt(lang, sample.cellLon),
          step: fmt(lang, grid.grid.meta.stepDeg),
        })}
      </p>
    </div>
  );
}

function PowerSection({
  data,
  chartParam,
  onChartParam,
}: {
  data: PowerClimatology;
  chartParam: PowerParameterId;
  onChartParam: (p: PowerParameterId) => void;
}) {
  const { t, lang } = useI18n();
  const chartable = CHART_PARAMS.filter((id) => data.parameters[id]);
  const active = data.parameters[chartParam] ? chartParam : chartable[0];
  const series = active ? data.parameters[active] : null;
  const monthFmt = new Intl.DateTimeFormat(lang, { month: "narrow" });
  const rows = series
    ? series.monthly.map((v, i) => ({ m: monthFmt.format(new Date(Date.UTC(2001, i, 15))), v }))
    : [];

  return (
    <div className="mt-2 space-y-3">
      <PowerValueList data={data} />

      {series && (
        <div className="rounded-control border border-line bg-panel-2 p-2">
          <div role="radiogroup" aria-label={t("map.inspector.chartAria")} className="flex flex-wrap gap-1">
            {chartable.map((id) => (
              <button
                key={id}
                type="button"
                role="radio"
                aria-checked={id === active}
                onClick={() => onChartParam(id)}
                className={`min-h-9 rounded-control border px-2 text-[10px] uppercase tracking-wider ${
                  id === active ? "border-phosphor text-phosphor" : "border-line text-dim hover:text-fg"
                }`}
              >
                {t(`map.inspector.chart.${id as "TS" | "PRECTOTCORR" | "ALLSKY_SFC_SW_DWN"}`)}
              </button>
            ))}
          </div>
          <p className="mt-1 text-[10px] text-dim">
            {t(`scan.param.${active}`)} ({displayUnit(series.units)}) · {t("map.inspector.monthly")}
          </p>
          <div className="purr-radar mt-1 h-28">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={rows} margin={{ top: 4, right: 4, bottom: 0, left: -18 }}>
                <XAxis dataKey="m" tick={{ fill: "var(--dim)", fontSize: 10 }} tickLine={false} axisLine={{ stroke: "var(--line)" }} interval={0} />
                <YAxis tick={{ fill: "var(--dim)", fontSize: 10 }} tickLine={false} axisLine={false} width={44} />
                <Tooltip
                  cursor={{ fill: "rgb(77 255 154 / 0.08)" }}
                  contentStyle={{ background: "var(--panel)", border: "1px solid var(--line)", fontSize: 11 }}
                  labelStyle={{ color: "var(--dim)" }}
                  formatter={(v) => [typeof v === "number" ? `${fmt(lang, v)} ${displayUnit(series.units)}` : "—", t(`scan.param.${active}`)]}
                />
                <Bar dataKey="v" fill="var(--phosphor)" radius={[2, 2, 0, 0]} isAnimationActive={false} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      <p className="text-[10px] leading-snug text-dim">
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
    </div>
  );
}
