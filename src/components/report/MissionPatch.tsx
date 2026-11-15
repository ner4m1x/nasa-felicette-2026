"use client";

/**
 * Mission patch: text and simple SVG shapes only. Body colour from the target (Moon / Mars),
 * crew shown as dots, rover as a simple silhouette, footprint as a ring. Decorative: the patch
 * encodes the configurator choices, not data.
 */

import { useId, useLayoutEffect, useRef, useState } from "react";
import { TARGETS } from "@/data/targets";
import { useI18n } from "@/i18n/I18nProvider";
import { estimateNaturalWidth, fitArcText, patchArc } from "@/lib/arcText";
import type { MissionConfig } from "@/lib/types";

/** number of crew dots drawn per crew option (a pictogram, not a crew size) */
const CREW_DOTS = { robotic: 0, short: 4, permanent: 12 } as const;
/**
 * Curved labels: the top arc gets most of the ring (the target's category name is the long one),
 * with a 7.5° gap to the bottom arc on each side. Labels are centred and auto-fitted (src/lib/arcText.ts),
 * so they never clip in any language.
 */
const TOP_ARC = patchArc(120, 120, 90, "top", 215);
const BOTTOM_ARC = patchArc(120, 120, 98, "bottom", 130);
/** kept free at each end of an arc (SVG units) */
const ARC_MARGIN = 6;
const TOP_STYLE = { baseFont: 11, baseSpacing: 1.5, minFont: 7 };
const BOTTOM_STYLE = { baseFont: 10, baseSpacing: 1.5, minFont: 7 };

/**
 * One curved label. Width is estimated for the first (server) render, then measured with
 * getComputedTextLength on a hidden, straight copy at the base size — after layout and again when
 * web fonts finish loading — and the fit is recomputed from that.
 */
function ArcLabel({
  text,
  pathId,
  arcLength,
  style,
  fill,
  fontWeight,
}: {
  text: string;
  pathId: string;
  arcLength: number;
  style: typeof TOP_STYLE;
  fill: string;
  fontWeight?: number;
}) {
  const probe = useRef<SVGTextElement>(null);
  const [measured, setMeasured] = useState<{ text: string; width: number } | null>(null);

  // Measure (external system: font layout) after render and after web fonts load.
  useLayoutEffect(() => {
    const el = probe.current;
    if (!el || typeof el.getComputedTextLength !== "function") return;
    let live = true;
    const measure = () => {
      const width = el.getComputedTextLength();
      if (live && width > 0) setMeasured((m) => (m?.text === text && m.width === width ? m : { text, width }));
    };
    measure();
    document.fonts?.ready.then(measure, () => {});
    return () => {
      live = false;
    };
  }, [text]);

  const naturalWidth = measured?.text === text ? measured.width : estimateNaturalWidth(text, style.baseFont);
  const fit = fitArcText({ naturalWidth, chars: [...text].length, arc: arcLength - 2 * ARC_MARGIN, ...style });

  return (
    <>
      <text ref={probe} aria-hidden visibility="hidden" fontSize={style.baseFont} fontWeight={fontWeight} letterSpacing={0} x={0} y={-50}>
        {text}
      </text>
      <text fontSize={fit.fontSize} fontWeight={fontWeight} fill={fill} letterSpacing={fit.letterSpacing}>
        <textPath
          href={`#${pathId}`}
          startOffset="50%"
          textAnchor="middle"
          {...(fit.textLength ? { textLength: fit.textLength, lengthAdjust: "spacingAndGlyphs" as const } : {})}
        >
          {text}
        </textPath>
      </text>
    </>
  );
}

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
        <path id={`${id}-top`} d={TOP_ARC.d} />
        <path id={`${id}-bottom`} d={BOTTOM_ARC.d} />
        <clipPath id={`${id}-clip`}>
          <circle cx="120" cy="120" r="74" />
        </clipPath>
      </defs>
      <circle cx="120" cy="120" r="116" fill="var(--panel)" stroke="var(--phosphor)" strokeWidth="3" />
      <circle cx="120" cy="120" r="104" fill="none" stroke="var(--line)" strokeWidth="1.5" />
      <circle cx="120" cy="120" r="76" fill="var(--bg)" stroke="var(--amber)" strokeWidth="2" />
      <ArcLabel text={top} pathId={`${id}-top`} arcLength={TOP_ARC.length} style={TOP_STYLE} fill="var(--phosphor)" fontWeight={700} />
      <ArcLabel text={bottom} pathId={`${id}-bottom`} arcLength={BOTTOM_ARC.length} style={BOTTOM_STYLE} fill="var(--amber)" />

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
