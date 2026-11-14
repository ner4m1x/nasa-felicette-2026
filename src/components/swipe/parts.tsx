"use client";

/** Small presentational pieces shared by the swipe components. Colors come from src/theme/tokens.css. */

import { ExternalLink } from "lucide-react";
import type { DimLabel } from "@/i18n/I18nProvider";
import type { I18nKey, I18nParams, Lang } from "@/i18n/types";
import { resolveSource } from "@/lib/manifest";
import type { CardKind } from "@/lib/types";
import type { VerdictReason } from "@/lib/verdict";
import { useManifest } from "@/state/usePipeline";

type T = (key: I18nKey, params?: I18nParams) => string;

/** 0..1 → integer 0..100 (display only; never fed back into scores). */
export const to100 = (x: number) => Math.round(x * 100);

export function formatCoords(lang: Lang, lat: number, lon: number): string {
  const f = new Intl.NumberFormat(lang, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return `${f.format(Math.abs(lat))}°${lat >= 0 ? "N" : "S"} ${f.format(Math.abs(lon))}°${lon >= 0 ? "E" : "W"}`;
}

/** Translate a verdict/constraint reason; a `dim` param (dimension id) becomes its label. */
export function reasonText(t: T, dim: (id: string) => DimLabel, reason: VerdictReason): string {
  const params = reason.params ? { ...reason.params } : undefined;
  if (params && typeof params.dim === "string") params.dim = dim(params.dim).sci;
  return t(reason.key, params);
}

export function KindBadge({ kind, label }: { kind: CardKind; label: string }) {
  return (
    <span
      className="inline-flex items-center rounded-pill border px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest"
      style={{ color: `var(--kind-${kind})`, borderColor: `var(--kind-${kind})` }}
    >
      {label}
    </span>
  );
}

interface ScoreBarProps {
  label: string;
  hint: string;
  /** 0..1, or null = not available ("—") */
  value: number | null;
  outOf: string;
  /** CSS color of the bar fill, e.g. "var(--score-analog)" */
  color: string;
  detail?: string | null;
}

export function ScoreBar({ label, hint, value, outOf, color, detail }: ScoreBarProps) {
  const v = value === null ? null : to100(value);
  return (
    <div>
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-[11px] font-bold uppercase tracking-wider" style={{ color }}>
          {label}
        </span>
        <span className="text-sm font-bold tabular-nums text-fg">
          {v === null ? "—" : v}
          {v !== null && <span className="text-[10px] font-normal text-dim">{outOf}</span>}
        </span>
      </div>
      <div
        role="meter"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={v ?? undefined}
        aria-valuetext={v === null ? "—" : `${v}${outOf}`}
        className="mt-1 h-2 overflow-hidden rounded-pill bg-score-track"
      >
        {v !== null && <div className="h-full rounded-pill" style={{ width: `${v}%`, background: color }} />}
      </div>
      <p className="mt-1 text-[10px] leading-snug text-dim">
        {hint}
        {detail && <span className="text-fg/80"> · {detail}</span>}
      </p>
    </div>
  );
}

interface SourceListProps {
  ids: readonly string[];
  unverifiedLabel: string;
  /** label for dataset entries resolved from /data/manifest.json */
  datasetLabel: string;
  versionLabel: string;
}

const linkClass =
  "inline-flex items-center gap-1 underline decoration-dotted underline-offset-2 hover:text-phosphor";

/**
 * Sources of a card: literature from src/data/sources.ts, pipeline datasets from
 * /data/manifest.json (name, version, DOI link), and unknown ids as plain text (never a crash).
 */
export function SourceList({ ids, unverifiedLabel, datasetLabel, versionLabel }: SourceListProps) {
  const manifest = useManifest() ?? null;
  if (ids.length === 0) return <p className="text-xs text-dim">—</p>;
  return (
    <ul className="space-y-1 text-xs">
      {ids.map((id) => {
        const src = resolveSource(id, manifest);
        if (src.kind === "unknown") {
          return (
            <li key={id} className="break-words text-dim">
              {id}
            </li>
          );
        }
        if (src.kind === "dataset") {
          const d = src.entry;
          const name = d.title ?? d.shortName;
          return (
            <li key={id} className="break-words">
              {d.url ? (
                <a href={d.url} target="_blank" rel="noreferrer" className={linkClass}>
                  {name}
                  <ExternalLink aria-hidden size={10} />
                </a>
              ) : (
                <span>{name}</span>
              )}
              <span className="text-dim">
                {" "}
                · {d.shortName}
                {d.version && ` ${versionLabel} ${d.version}`}
                {d.doi && <> · DOI {d.doi}</>} · {datasetLabel}
              </span>
            </li>
          );
        }
        const lit = src.entry;
        return (
          <li key={id} className="break-words">
            {lit.url ? (
              <a href={lit.url} target="_blank" rel="noreferrer" className={linkClass}>
                {lit.title}
                <ExternalLink aria-hidden size={10} />
              </a>
            ) : (
              <span>{lit.title}</span>
            )}
            <span className="text-dim"> · {lit.publisher}</span>
            {!lit.verified && (
              <sup className="text-dim" title={unverifiedLabel}>
                *
              </sup>
            )}
          </li>
        );
      })}
    </ul>
  );
}
