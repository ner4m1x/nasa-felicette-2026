"use client";

/**
 * Mission patch: text and simple SVG shapes only. Body colour from the target (Moon / Mars),
 * crew shown as dots, rover as a simple silhouette, footprint as a ring. Decorative: the patch
 * encodes the configurator choices, not data.
 */

import { useId } from "react";
import { TARGETS } from "@/data/targets";
import { useI18n } from "@/i18n/I18nProvider";
import type { MissionConfig } from "@/lib/types";

/** number of crew dots drawn per crew option (a pictogram, not a crew size) */
const CREW_DOTS = { robotic: 0, short: 4, permanent: 12 } as const;
/**
 * Usable arc length (SVG units) for the curved labels: just under the half-circle of each path
 * (π × 90 ≈ 283 top, π × 98 ≈ 308 bottom). Longer labels are compressed to fit instead of clipping.
 */
const TOP_ARC = 262;
const BOTTOM_ARC = 280;
/** monospace advance ≈ 0.6 em, plus letter spacing (estimate, used only to decide compression) */
const estWidth = (text: string, fontSize: number, spacing: number) => text.length * (0.6 * fontSize + spacing);
const fit = (text: string, fontSize: number, spacing: number, max: number) =>
  estWidth(text, fontSize, spacing) > max ? { textLength: max, lengthAdjust: "spacingAndGlyphs" as const } : {};

/** footprint ring radius per option (pictogram) */
const FOOTPRINT_R = { compact: 16, medium: 24, mega: 32 } as const;

export function MissionPatch({ config, className = "" }: { config: MissionConfig; className?: string }) {
  const { t } = useI18n();
  const id = useId().replace(/:/g, "");
  const target = TARGETS[config.target];
  const body = target.body === "moon" ? "var(--body-moon)" : "var(--body-mars)";
  const dots = CREW_DOTS[config.crew];
  const top = `${t("app.short")} · ${t(target.catKey)}`.toUpperCase();
  const bottom = [
    t(`options.footprint.${config.footprint}.label`),
    t(`options.mobility.${config.mobility}.label`),
    t(`options.crew.${config.crew}.label`),
  ]
    .join(" · ")
    .toUpperCase();

  return (
    <svg viewBox="0 0 240 240" role="img" aria-label={t("report.patchAria", { top, bottom })} className={`purr-patch ${className}`}>
      <defs>
        <path id={`${id}-top`} d="M 30 120 A 90 90 0 0 1 210 120" />
        <path id={`${id}-bottom`} d="M 22 120 A 98 98 0 0 0 218 120" />
        <clipPath id={`${id}-clip`}>
          <circle cx="120" cy="120" r="74" />
        </clipPath>
      </defs>
      <circle cx="120" cy="120" r="116" fill="var(--panel)" stroke="var(--phosphor)" strokeWidth="3" />
      <circle cx="120" cy="120" r="104" fill="none" stroke="var(--line)" strokeWidth="1.5" />
      <circle cx="120" cy="120" r="76" fill="var(--bg)" stroke="var(--amber)" strokeWidth="2" />
      <text fontSize="11" fontWeight="700" fill="var(--phosphor)" letterSpacing="1.5">
        <textPath href={`#${id}-top`} startOffset="50%" textAnchor="middle" {...fit(top, 11, 1.5, TOP_ARC)}>
          {top}
        </textPath>
      </text>
      <text fontSize="10" fill="var(--amber)" letterSpacing="1.5">
        <textPath href={`#${id}-bottom`} startOffset="50%" textAnchor="middle" {...fit(bottom, 10, 1.5, BOTTOM_ARC)}>
          {bottom}
        </textPath>
      </text>

      <g clipPath={`url(#${id}-clip)`}>
        {/* stars */}
        {[
          [70, 80],
          [160, 70],
          [150, 100],
          [88, 62],
          [176, 128],
        ].map(([x, y]) => (
          <circle key={`${x}-${y}`} cx={x} cy={y} r="1.2" fill="var(--fg)" />
        ))}
        {/* the target body, rising over the horizon */}
        <circle cx="120" cy="196" r="78" fill={body} />
        <circle cx="96" cy="150" r="7" fill="rgb(0 0 0 / 0.18)" />
        <circle cx="146" cy="162" r="10" fill="rgb(0 0 0 / 0.15)" />
        {/* footprint ring + base */}
        <ellipse cx="120" cy="150" rx={FOOTPRINT_R[config.footprint]} ry={FOOTPRINT_R[config.footprint] / 3} fill="none" stroke="var(--phosphor)" strokeDasharray="3 3" strokeWidth="1.5" />
        <path d="M110 150 a10 10 0 0 1 20 0 z" fill="var(--fg)" />
        {/* rover */}
        {config.mobility === "heavy" ? (
          <g transform="translate(140 158)">
            <rect x="0" y="0" width="22" height="9" rx="2" fill="var(--amber)" />
            <circle cx="5" cy="11" r="3" fill="var(--bg)" />
            <circle cx="17" cy="11" r="3" fill="var(--bg)" />
          </g>
        ) : (
          <g transform="translate(78 160) rotate(-18)">
            <rect x="0" y="0" width="12" height="6" rx="1.5" fill="var(--amber)" />
            <circle cx="2" cy="8" r="2.2" fill="var(--bg)" />
            <circle cx="10" cy="8" r="2.2" fill="var(--bg)" />
          </g>
        )}
      </g>

      {/* crew dots: a row in the sky above the horizon */}
      {Array.from({ length: dots }, (_, i) => (
        <circle key={i} cx={120 + (i - (dots - 1) / 2) * 9} cy="104" r="2.6" fill="var(--sky)" />
      ))}

      {/* Félicette's ears on top */}
      <path d="M96 10 L104 -2 L112 8" transform="translate(0 6)" fill="var(--panel)" stroke="var(--amber)" strokeWidth="2" strokeLinejoin="round" />
      <path d="M128 8 L136 -2 L144 10" transform="translate(0 6)" fill="var(--panel)" stroke="var(--amber)" strokeWidth="2" strokeLinejoin="round" />
    </svg>
  );
}
