"use client";

/**
 * Félicette as an original, flat SVG character: a chibi black-and-white tuxedo cat (solid black
 * head, short rounded ears, big green eyes, white muzzle/cheek patch and chest — the historical
 * Félicette was black-and-white) inside a glass helmet bubble with a suit collar. Terminal palette,
 * thin outlines; legible at 32 px (`compact`) and 96 px. One drawing, five expressions:
 *
 *   neutral · happy (PURR agree) · hiss (ears back, narrowed eyes) · thinking (loading) · surprised (low score)
 *
 * Colours come from the --felicette-* / --cat-* tokens. Open-eyed moods blink now and then (CSS
 * `.felicette-blink`, off under prefers-reduced-motion). With `followPointer` the pupils track the
 * pointer on fine-pointer devices (written straight to the DOM, no re-render per move; still under
 * reduced motion). Renders on the server and in tests (effects don't run there).
 */

import { useEffect, useId, useRef, type RefObject } from "react";
import type { FelicetteMood } from "@/lib/felicetteMood";

export type { FelicetteMood } from "@/lib/felicetteMood";

interface FelicetteAvatarProps {
  mood?: FelicetteMood;
  /** accessible name; omitted = decorative (aria-hidden) */
  label?: string;
  /** small sizes (≲ 48 px): drop whiskers and the small glare dot so the face stays legible */
  compact?: boolean;
  /** pupils follow the pointer (fine pointers only, not under reduced motion) */
  followPointer?: boolean;
  className?: string;
}

const RING: Record<FelicetteMood, string> = {
  neutral: "var(--felicette-ring)",
  happy: "var(--felicette-ring-happy)",
  hiss: "var(--felicette-ring-hiss)",
  thinking: "var(--felicette-ring-thinking)",
  surprised: "var(--felicette-ring-surprised)",
};

const VIEW = 64;
/** helmet bubble */
const HELMET = { cx: 32, cy: 29.5, r: 26.5 };
/** head: rounder and wider than tall */
const HEAD = { cx: 32, cy: 33.5, rx: 16, ry: 12.5 };
/** eye centres (left, right) */
const EYES = [
  { x: 25.4, y: 32.2 },
  { x: 38.6, y: 32.2 },
] as const;
/** the cat (head + body) is drawn at 1× and scaled up about the neck to fill the bubble */
const CAT_SCALE = 1.15;
const CAT_ORIGIN = { x: 32, y: 46 };
const CAT_TRANSFORM = `translate(${CAT_ORIGIN.x} ${CAT_ORIGIN.y}) scale(${CAT_SCALE}) translate(${-CAT_ORIGIN.x} ${-CAT_ORIGIN.y})`;
/** helmet-space position of a point drawn in cat space */
const toHelmet = (p: { x: number; y: number }) => ({
  x: CAT_ORIGIN.x + (p.x - CAT_ORIGIN.x) * CAT_SCALE,
  y: CAT_ORIGIN.y + (p.y - CAT_ORIGIN.y) * CAT_SCALE,
});
/** collar arc along the helmet rim, from 140° to 40° through the bottom */
const arcPoint = (deg: number) => {
  const a = (deg * Math.PI) / 180;
  return `${(HELMET.cx + HELMET.r * Math.cos(a)).toFixed(2)} ${(HELMET.cy + HELMET.r * Math.sin(a)).toFixed(2)}`;
};
const COLLAR_ARC = `M${arcPoint(140)} A${HELMET.r} ${HELMET.r} 0 0 0 ${arcPoint(40)}`;
/** maximum pupil travel when following the pointer (SVG units) */
const PUPIL_TRAVEL = 1.3;

type PupilRefs = RefObject<(SVGGElement | null)[]>;

export function FelicetteAvatar({
  mood = "neutral",
  label,
  compact = false,
  followPointer = false,
  className = "",
}: FelicetteAvatarProps) {
  const uid = useId().replace(/:/g, "");
  const clipHelmet = `felicette-helmet-${uid}`;
  const clipHead = `felicette-head-${uid}`;
  const ring = RING[mood];
  const earsBack = mood === "hiss";
  const blinks = mood === "neutral" || mood === "thinking" || mood === "surprised";

  const svg = useRef<SVGSVGElement>(null);
  const pupils = useRef<(SVGGElement | null)[]>([]);
  usePointerPupils(followPointer, svg, pupils);

  return (
    <svg
      ref={svg}
      viewBox={`0 0 ${VIEW} ${VIEW}`}
      className={className}
      data-mood={mood}
      data-compact={compact || undefined}
      {...(label ? { role: "img", "aria-label": label } : { "aria-hidden": true })}
    >
      <defs>
        <clipPath id={clipHelmet}>
          <circle cx={HELMET.cx} cy={HELMET.cy} r={HELMET.r - 0.6} />
        </clipPath>
        <clipPath id={clipHead}>
          <ellipse cx={HEAD.cx} cy={HEAD.cy} rx={HEAD.rx} ry={HEAD.ry} />
        </clipPath>
      </defs>

      {/* glass bubble: faint tint */}
      <circle cx={HELMET.cx} cy={HELMET.cy} r={HELMET.r} fill="var(--felicette-glass)" />

      <g clipPath={`url(#${clipHelmet})`}>
        {/* the cat, scaled up about the neck so she fills the bubble (clip stays in helmet space) */}
        <g data-part="cat" transform={CAT_TRANSFORM}>
          {/* shoulders + white chest */}
          <path
            d="M11 64 Q12.5 47.5 32 46 Q51.5 47.5 53 64 Z"
            fill="var(--cat-fur)"
            stroke="var(--cat-rim)"
            strokeWidth="0.8"
          />
          <path d="M24.5 64 Q25 49.8 32 48.6 Q39 49.8 39.5 64 Z" fill="var(--cat-white)" />

          {/* ears (behind the head): short and rounded, or flattened back when hissing */}
          {earsBack ? (
            <g
              data-part="ears-back"
              fill="var(--cat-fur)"
              stroke="var(--cat-rim)"
              strokeWidth="0.8"
              strokeLinejoin="round"
            >
              <path d="M18.5 30 Q12 25.5 12.8 22.8 Q15.5 21.6 23.5 25.2 Z" />
              <path d="M45.5 30 Q52 25.5 51.2 22.8 Q48.5 21.6 40.5 25.2 Z" />
            </g>
          ) : (
            <g data-part="ears-up">
              <g fill="var(--cat-fur)" stroke="var(--cat-rim)" strokeWidth="0.8" strokeLinejoin="round">
                <path d="M17.5 28 Q16.4 18.5 19.6 16.6 Q22 15.9 28 22.5 Z" />
                <path d="M46.5 28 Q47.6 18.5 44.4 16.6 Q42 15.9 36 22.5 Z" />
              </g>
              <g fill="var(--cat-ear-inner)">
                <path d="M19.4 24.6 Q19 19.6 20.6 18.9 Q21.9 18.7 25.2 22.3 Z" />
                <path d="M44.6 24.6 Q45 19.6 43.4 18.9 Q42.1 18.7 38.8 22.3 Z" />
              </g>
            </g>
          )}

          {/* solid black head with a subtle lighter rim */}
          <ellipse
            cx={HEAD.cx}
            cy={HEAD.cy}
            rx={HEAD.rx}
            ry={HEAD.ry}
            fill="var(--cat-fur)"
            stroke="var(--cat-rim)"
            strokeWidth="0.9"
          />
          {/* white muzzle / cheek patch: rounded, rising to a soft point between the eyes */}
          <path
            clipPath={`url(#${clipHead})`}
            d="M32 26.8 Q33.6 31.6 35 35.4 Q45.5 36.6 46 41.8 Q43 47 32 47 Q21 47 18 41.8 Q18.5 36.6 29 35.4 Q30.4 31.6 32 26.8 Z"
            fill="var(--cat-white)"
          />

          {/* short whiskers */}
          {!compact && (
            <g stroke="var(--cat-whisker)" strokeWidth="0.55" strokeLinecap="round" fill="none">
              <path d="M24.5 39.6 L13.5 38.4 M24.5 41 L14 42.6" />
              <path d="M39.5 39.6 L50.5 38.4 M39.5 41 L50 42.6" />
            </g>
          )}

          {/* eyes */}
          <g data-part="eyes" className={blinks ? "felicette-blink" : undefined}>
            <Eyes mood={mood} pupils={pupils} />
          </g>

          {/* nose + mouth */}
          <path d="M30.5 37.3 Q32 36.8 33.5 37.3 Q32.7 39.1 32 39.3 Q31.3 39.1 30.5 37.3 Z" fill="var(--cat-nose)" />
          <Mouth mood={mood} />
        </g>
      </g>

      {mood === "thinking" && (
        <g data-part="thought" fill="var(--felicette-ring-thinking)">
          <circle cx="55.2" cy="12.4" r="0.9" />
          <circle cx="58.2" cy="8.9" r="1.2" />
          <circle cx="61.6" cy="5" r="1.5" />
        </g>
      )}

      {/* helmet: soft glare, thin rim, suit collar */}
      <path
        d="M11.6 21.5 A21.5 21.5 0 0 1 21.5 9.6"
        fill="none"
        stroke="var(--felicette-glare)"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      {!compact && <circle cx="24.6" cy="8" r="0.9" fill="var(--felicette-glare)" />}
      <circle cx={HELMET.cx} cy={HELMET.cy} r={HELMET.r} fill="none" stroke={ring} strokeWidth="1.3" />
      {/* suit collar: a curved band hugging the bottom of the bubble */}
      <g data-part="collar" fill="none" strokeLinecap="round">
        <path d={COLLAR_ARC} stroke={ring} strokeWidth="4.6" />
        <path d={COLLAR_ARC} stroke="var(--felicette-collar)" strokeWidth="2.2" />
      </g>
    </svg>
  );
}

function Eyes({ mood, pupils }: { mood: FelicetteMood; pupils: PupilRefs }) {
  const setPupil = (i: number) => (el: SVGGElement | null) => {
    pupils.current[i] = el;
  };
  switch (mood) {
    case "happy":
      // closed, upturned "^ ^"
      return (
        <g fill="none" stroke="var(--cat-eye)" strokeWidth="1.8" strokeLinecap="round">
          {EYES.map((e) => (
            <path key={e.x} d={`M${e.x - 3.2} ${e.y + 1.2} Q${e.x} ${e.y - 3.2} ${e.x + 3.2} ${e.y + 1.2}`} />
          ))}
        </g>
      );
    case "hiss":
      // narrowed, slanted down towards the nose
      return (
        <g>
          {EYES.map((e, i) => (
            <g key={e.x} transform={`rotate(${i === 0 ? 18 : -18} ${e.x} ${e.y})`}>
              <ellipse cx={e.x} cy={e.y} rx="3.8" ry="1.5" fill="var(--cat-eye)" />
              <ellipse cx={e.x} cy={e.y} rx="0.6" ry="1.3" fill="var(--cat-fur)" />
            </g>
          ))}
        </g>
      );
    case "surprised":
      return (
        <g>
          {EYES.map((e, i) => (
            <g key={e.x}>
              <circle cx={e.x} cy={e.y} r="4.4" fill="var(--cat-eye)" />
              <g data-part="pupil" ref={setPupil(i)}>
                <circle cx={e.x} cy={e.y} r="1.7" fill="var(--cat-fur)" />
                <circle cx={e.x + 1.4} cy={e.y - 1.5} r="0.85" fill="var(--cat-white)" />
              </g>
            </g>
          ))}
        </g>
      );
    default: {
      // neutral; thinking = the same eyes glancing up and aside
      const dx = mood === "thinking" ? 1 : 0;
      const dy = mood === "thinking" ? -1.3 : 0;
      return (
        <g>
          {EYES.map((e, i) => (
            <g key={e.x}>
              <circle cx={e.x} cy={e.y} r="4" fill="var(--cat-eye)" />
              <g data-part="pupil" ref={setPupil(i)}>
                <ellipse cx={e.x + dx} cy={e.y + dy} rx="1.1" ry="3" fill="var(--cat-fur)" />
                <circle cx={e.x + 1.4 + dx} cy={e.y - 1.5 + dy} r="0.85" fill="var(--cat-white)" />
              </g>
            </g>
          ))}
        </g>
      );
    }
  }
}

function Mouth({ mood }: { mood: FelicetteMood }) {
  const stroke = { fill: "none", stroke: "var(--cat-mouth)", strokeWidth: 0.85, strokeLinecap: "round" as const };
  switch (mood) {
    case "happy":
      return <path data-part="mouth" d="M28.6 40 Q30.3 42.8 32 40.3 Q33.7 42.8 35.4 40" {...stroke} />;
    case "hiss":
      return (
        <g data-part="mouth">
          <ellipse cx="32" cy="41.9" rx="2.9" ry="2" fill="var(--cat-mouth)" />
          <path d="M30.1 40.3 L30.7 41.9 L31.3 40.3 Z M32.7 40.3 L33.3 41.9 L33.9 40.3 Z" fill="var(--cat-white)" />
        </g>
      );
    case "surprised":
      return <circle data-part="mouth" cx="32" cy="41.8" r="1.4" fill="var(--cat-mouth)" />;
    case "thinking":
      return <path data-part="mouth" d="M29.8 41.6 Q32 41.2 34.4 40.5" {...stroke} />;
    default:
      return (
        <path
          data-part="mouth"
          d="M32 39.3 L32 40.3 M32 40.3 Q30.7 41.7 29.4 40.8 M32 40.3 Q33.3 41.7 34.6 40.8"
          {...stroke}
        />
      );
  }
}

/** Pupils follow the pointer (external system: window pointer events). */
function usePointerPupils(enabled: boolean, svg: RefObject<SVGSVGElement | null>, pupils: PupilRefs) {
  useEffect(() => {
    if (!enabled) return;
    const fine = window.matchMedia("(pointer: fine)").matches;
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!fine || still) return;
    let frame = 0;
    const onMove = (e: PointerEvent) => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const el = svg.current;
        if (!el) return;
        const box = el.getBoundingClientRect();
        if (box.width === 0) return; // hidden
        const scale = box.width / VIEW;
        EYES.forEach((cat, i) => {
          const eye = toHelmet(cat);
          const dx = e.clientX - (box.left + eye.x * scale);
          const dy = e.clientY - (box.top + eye.y * scale);
          const d = Math.hypot(dx, dy) || 1;
          const k = Math.min(1, d / 200) * PUPIL_TRAVEL;
          pupils.current[i]?.setAttribute(
            "transform",
            `translate(${((dx / d) * k).toFixed(2)} ${((dy / d) * k).toFixed(2)})`,
          );
        });
      });
    };
    window.addEventListener("pointermove", onMove);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("pointermove", onMove);
    };
  }, [enabled, svg, pupils]);
}
