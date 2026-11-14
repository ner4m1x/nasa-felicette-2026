/**
 * Félicette as an original, flat SVG character: a black-and-white tuxedo cat (black head and ears,
 * white face blaze and chest — the historical Félicette was black-and-white) inside a round space
 * helmet, drawn in the terminal palette with thin outlines. One drawing, five expressions:
 *
 *   neutral · happy (PURR agree) · hiss (ears back, narrowed eyes) · thinking (loading) · surprised (low score)
 *
 * Colours come from the --felicette-* / --cat-* tokens. Open-eyed moods blink now and then (CSS
 * `.felicette-blink`, switched off under prefers-reduced-motion). No hooks besides useId, so it
 * renders on the server and in tests.
 */

import { useId } from "react";
import type { FelicetteMood } from "@/lib/felicetteMood";

export type { FelicetteMood } from "@/lib/felicetteMood";

interface FelicetteAvatarProps {
  mood?: FelicetteMood;
  /** accessible name; omitted = decorative (aria-hidden) */
  label?: string;
  /** small sizes (≲ 48 px): drop whiskers, inner ears and glare so the face stays legible */
  compact?: boolean;
  className?: string;
}

const RING: Record<FelicetteMood, string> = {
  neutral: "var(--felicette-ring)",
  happy: "var(--felicette-ring-happy)",
  hiss: "var(--felicette-ring-hiss)",
  thinking: "var(--felicette-ring-thinking)",
  surprised: "var(--felicette-ring-surprised)",
};

/** eye centres (left, right) */
const EYE_L = { x: 25.5, y: 34 };
const EYE_R = { x: 38.5, y: 34 };

export function FelicetteAvatar({ mood = "neutral", label, compact = false, className = "" }: FelicetteAvatarProps) {
  const clip = `felicette-clip-${useId().replace(/:/g, "")}`;
  const ring = RING[mood];
  const earsBack = mood === "hiss";
  const blinks = mood === "neutral" || mood === "thinking" || mood === "surprised";

  return (
    <svg
      viewBox="0 0 64 64"
      className={className}
      data-mood={mood}
      data-compact={compact || undefined}
      {...(label ? { role: "img", "aria-label": label } : { "aria-hidden": true })}
    >
      <defs>
        <clipPath id={clip}>
          <circle cx="32" cy="32" r="28.6" />
        </clipPath>
      </defs>

      {/* helmet glass */}
      <circle cx="32" cy="32" r="29.5" fill="var(--felicette-glass)" />

      <g clipPath={`url(#${clip})`} stroke="var(--cat-outline)" strokeWidth="0.8" strokeLinejoin="round">
        {/* shoulders + white chest bib */}
        <path d="M9 64 Q11 50.5 32 49 Q53 50.5 55 64 Z" fill="var(--cat-fur)" />
        <path d="M25 64 Q25.8 53.5 32 51.6 Q38.2 53.5 39 64 Z" fill="var(--cat-white)" stroke="none" />

        {/* ears (behind the head) */}
        {earsBack ? (
          <g data-part="ears-back" fill="var(--cat-fur)">
            <path d="M17.5 33 L9.5 22.5 L25.5 25 Z" />
            <path d="M46.5 33 L54.5 22.5 L38.5 25 Z" />
          </g>
        ) : (
          <g data-part="ears-up">
            <path d="M17.5 31 L19 13.5 L29 23.5 Z" fill="var(--cat-fur)" />
            <path d="M46.5 31 L45 13.5 L35 23.5 Z" fill="var(--cat-fur)" />
            {!compact && (
              <>
                <path d="M20.3 25.5 L20.8 18 L25.4 22.6" fill="none" stroke="var(--cat-ear-inner)" strokeWidth="0.8" />
                <path d="M43.7 25.5 L43.2 18 L38.6 22.6" fill="none" stroke="var(--cat-ear-inner)" strokeWidth="0.8" />
              </>
            )}
          </g>
        )}

        {/* head + white blaze running down into the muzzle */}
        <ellipse cx="32" cy="36" rx="16" ry="13.5" fill="var(--cat-fur)" />
        <path
          d="M32 24.5 Q30.6 30 29.6 33.8 Q24.2 38.8 25 43.4 Q27.8 48.6 32 48.6 Q36.2 48.6 39 43.4 Q39.8 38.8 34.4 33.8 Q33.4 30 32 24.5 Z"
          fill="var(--cat-white)"
          stroke="none"
        />

        {/* whiskers */}
        {!compact && (
          <g stroke="var(--cat-whisker)" strokeWidth="0.6" strokeLinecap="round" fill="none">
            <path d="M26 41.4 L12 39.2 M26 42.8 L12.5 44.6" />
            <path d="M38 41.4 L52 39.2 M38 42.8 L51.5 44.6" />
          </g>
        )}
      </g>

      {/* eyes */}
      <g data-part="eyes" className={blinks ? "felicette-blink" : undefined}>
        <Eyes mood={mood} />
      </g>

      {/* nose + mouth */}
      <path d="M30.3 39.1 L33.7 39.1 L32 41.1 Z" fill="var(--cat-nose)" />
      <Mouth mood={mood} />

      {mood === "thinking" && (
        <g data-part="thought" fill="var(--felicette-ring-thinking)">
          <circle cx="43.5" cy="18" r="0.9" />
          <circle cx="46.8" cy="15" r="1.2" />
          <circle cx="50.3" cy="12.4" r="1.5" />
        </g>
      )}

      {/* helmet: glare, ring, neck collar */}
      {!compact && (
        <path
          d="M11.5 23 A22 22 0 0 1 22 11.2"
          fill="none"
          stroke="var(--felicette-glare)"
          strokeWidth="1.4"
          strokeLinecap="round"
        />
      )}
      <circle cx="32" cy="32" r="29.5" fill="none" stroke={ring} strokeWidth="1.5" />
      <path d="M11.1 52.9 A29.5 29.5 0 0 0 52.9 52.9" fill="none" stroke={ring} strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

function Eyes({ mood }: { mood: FelicetteMood }) {
  const eyes = [EYE_L, EYE_R];
  switch (mood) {
    case "happy":
      // closed, upturned "^ ^"
      return (
        <g fill="none" stroke="var(--cat-eye)" strokeWidth="1.6" strokeLinecap="round">
          {eyes.map((e) => (
            <path key={e.x} d={`M${e.x - 2.6} ${e.y + 1} Q${e.x} ${e.y - 2.6} ${e.x + 2.6} ${e.y + 1}`} />
          ))}
        </g>
      );
    case "hiss":
      // narrowed, slanted down towards the nose
      return (
        <g>
          {eyes.map((e, i) => (
            <g key={e.x} transform={`rotate(${i === 0 ? 20 : -20} ${e.x} ${e.y})`}>
              <ellipse cx={e.x} cy={e.y} rx="3" ry="1.15" fill="var(--cat-eye)" />
              <ellipse cx={e.x} cy={e.y} rx="0.55" ry="1" fill="var(--cat-fur)" />
            </g>
          ))}
        </g>
      );
    case "surprised":
      return (
        <g>
          {eyes.map((e) => (
            <g key={e.x}>
              <circle cx={e.x} cy={e.y} r="3.6" fill="var(--cat-eye)" />
              <circle cx={e.x} cy={e.y} r="1.3" fill="var(--cat-fur)" />
              <circle cx={e.x + 1.2} cy={e.y - 1.3} r="0.6" fill="var(--cat-white)" />
            </g>
          ))}
        </g>
      );
    default: {
      // neutral; thinking = the same eyes glancing up and aside
      const dx = mood === "thinking" ? 0.8 : 0;
      const dy = mood === "thinking" ? -1.1 : 0;
      return (
        <g>
          {eyes.map((e) => (
            <g key={e.x}>
              <ellipse cx={e.x} cy={e.y} rx="2.8" ry="3.2" fill="var(--cat-eye)" />
              <ellipse cx={e.x + dx} cy={e.y + dy} rx="0.9" ry="2.3" fill="var(--cat-fur)" />
              <circle cx={e.x + 1 + dx} cy={e.y - 1.2 + dy} r="0.55" fill="var(--cat-white)" />
            </g>
          ))}
        </g>
      );
    }
  }
}

function Mouth({ mood }: { mood: FelicetteMood }) {
  const stroke = { fill: "none", stroke: "var(--cat-fur)", strokeWidth: 0.9, strokeLinecap: "round" as const };
  switch (mood) {
    case "happy":
      return <path data-part="mouth" d="M28.4 42.4 Q30.2 45.2 32 42.6 Q33.8 45.2 35.6 42.4" {...stroke} />;
    case "hiss":
      return (
        <g data-part="mouth">
          <ellipse cx="32" cy="44.1" rx="3" ry="2.1" fill="var(--cat-fur)" />
          <path d="M30 42.5 L30.6 44.1 L31.2 42.5 Z M32.8 42.5 L33.4 44.1 L34 42.5 Z" fill="var(--cat-white)" />
        </g>
      );
    case "surprised":
      return <circle data-part="mouth" cx="32" cy="44" r="1.5" fill="var(--cat-fur)" />;
    case "thinking":
      return <path data-part="mouth" d="M29.6 43.6 Q32 43.2 34.6 42.4" {...stroke} />;
    default:
      return (
        <path data-part="mouth" d="M32 41.1 L32 42.5 M32 42.5 Q30.5 44 29 43 M32 42.5 Q33.5 44 35 43" {...stroke} />
      );
  }
}
