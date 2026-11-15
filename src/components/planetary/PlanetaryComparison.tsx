"use client";

/**
 * Planet vs this place: peer-reviewed planetary reference values (src/data/planetaryReference.ts)
 * next to the scan_grid value of the same property on Earth, and the target's frozen dimension
 * score for that property ("how far Earth gets"). Display only; works without grid data.
 */

import { getSource } from "@/data/sources";
import type { PlanetaryRef } from "@/data/planetaryReference";
import { useI18n } from "@/i18n/I18nProvider";
import { comparisonRows, type EarthCell } from "@/lib/planetaryComparison";
import type { ScanGridSample } from "@/lib/scanGrid";
import type { TargetId } from "@/lib/types";
import { formatCoords, to100 } from "@/components/swipe/parts";
import { useScanGrid } from "@/state/usePipeline";

interface PlanetaryComparisonProps {
  target: TargetId;
  /** grid sample at the place; null = no grid data (yet) */
  sample: ScanGridSample | null;
  /** true while the scan grid is still being fetched */
  gridLoading?: boolean;
}

export function usePlanetaryFormat() {
  const { t, lang } = useI18n();
  const nf = (v: number) => new Intl.NumberFormat(lang, { maximumFractionDigits: 2 }).format(v);
  const withUnit = (txt: string, unit: string) => (unit ? `${txt} ${unit}` : txt);

  const planetValue = (ref: PlanetaryRef): string => {
    if (ref.value === null) return ref.qualitativeKey ? t(ref.qualitativeKey) : "—";
    if (Array.isArray(ref.value)) {
      if (ref.display === "coords") return formatCoords(lang, ref.value[0], ref.value[1]);
      return withUnit(`${nf(ref.value[0])} … ${nf(ref.value[1])}`, ref.unit);
    }
    const v = withUnit(nf(ref.value), ref.unit);
    if (ref.qualifier === "upTo") return t("planetary.upTo", { v });
    if (ref.qualifier === "approx") return t("planetary.approx", { v });
    return v;
  };

  const earthValue = (e: EarthCell, gridLoading = false): string => {
    if (e.kind === "invisible") return t("planetary.invisible");
    if (e.kind === "pending") return t(gridLoading ? "planetary.loading" : "planetary.pending");
    return withUnit(new Intl.NumberFormat(lang, { maximumFractionDigits: 1 }).format(e.value), e.unit);
  };

  return { planetValue, earthValue };
}

export function PlanetaryComparison({ target, sample, gridLoading = false }: PlanetaryComparisonProps) {
  const { t } = useI18n();
  const { planetValue, earthValue } = usePlanetaryFormat();
  const rows = comparisonRows(target, sample);
  if (rows.length === 0) return null;

  return (
    <section className="space-y-2">
      <h4 className="text-[11px] font-bold uppercase tracking-wider text-dim">{t("planetary.title")}</h4>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-left text-[11px]">
          <thead>
            <tr className="border-b border-line text-[10px] uppercase tracking-wider text-dim">
              <th scope="col" className="py-1 pr-2 font-normal">{t("planetary.colPlanet")}</th>
              <th scope="col" className="py-1 pr-2 font-normal">{t("planetary.colEarth")}</th>
              <th scope="col" className="w-20 py-1 font-normal">{t("planetary.colScore")}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ ref, earth, score, scored }) => {
              const src = getSource(ref.sourceId);
              return (
                <tr key={ref.id} className="border-b border-line/60 align-top">
                  <td className="py-1.5 pr-2">
                    <div className="text-dim">{t(ref.labelKey)}</div>
                    <div className="font-bold tabular-nums text-fg">{planetValue(ref)}</div>
                    <div className="mt-0.5 flex flex-wrap items-center gap-1">
                      <span
                        className="rounded-pill border border-phosphor/60 px-1.5 text-[9px] uppercase tracking-wider text-phosphor"
                        title={src ? `${src.title} · ${src.publisher}${src.doi ? ` · DOI ${src.doi}` : ""}` : ref.sourceId}
                      >
                        {ref.instrument}
                      </span>
                    </div>
                    {ref.noteKey && <div className="mt-0.5 text-[10px] leading-snug text-dim">{t(ref.noteKey)}</div>}
                  </td>
                  <td className={`py-1.5 pr-2 tabular-nums ${earth.kind === "value" ? "text-fg" : "text-[10px] italic text-dim"}`}>
                    {earthValue(earth, gridLoading)}
                  </td>
                  <td className="py-1.5">
                    {scored && score !== null ? (
                      <div className="flex items-center gap-1.5" title={`${to100(score)}/100`}>
                        <span className="h-1.5 w-10 overflow-hidden rounded-pill bg-score-track" aria-hidden>
                          <span className="block h-full rounded-pill bg-score-analog" style={{ width: `${to100(score)}%` }} />
                        </span>
                        <span className="tabular-nums">{to100(score)}</span>
                      </div>
                    ) : (
                      <span className="text-dim" title={t("planetary.scoreNA")}>
                        —
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="text-[10px] leading-snug text-dim">{t("planetary.footer")}</p>
    </section>
  );
}

/** Same table for a card: loads the (memoised) scan grid and samples it at the card's coordinates. */
export function PlanetaryComparisonAt({ target, lat, lon }: { target: TargetId; lat: number; lon: number }) {
  const grid = useScanGrid(true);
  const sample = grid?.status === "ready" ? grid.grid.sample(lat, lon) : null;
  return (
    <PlanetaryComparison
      target={target}
      sample={sample && sample.land !== false ? sample : null}
      gridLoading={grid === undefined}
    />
  );
}
