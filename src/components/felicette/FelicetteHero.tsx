"use client";

/**
 * Félicette as the character who is speaking: a big avatar (--hero-avatar-size: 72 px phones,
 * 104 px desktop) under a comic speech bubble whose tail points at her.
 * - Phone: bubble above the cat, tail pointing straight down; cat centred.
 * - Desktop (≥ lg): bubble above-left of the cat, slanted tail down-right; cat at the right.
 * Same typewriter + a11y as FelicetteSays (give it `key={text}`; screen readers get the sentence once;
 * reduced motion = full text at once). Sizes and colours: --hero-* tokens in tokens.css.
 * Compact places (card teaser, inspector summary line, trap chip, verdict row) keep the small avatar.
 * Under the avatar: a small, always-visible "AI-assisted artwork" caption.
 */

import { useI18n } from "@/i18n/I18nProvider";
import type { FelicetteMood } from "@/lib/felicetteMood";
import { FelicetteAvatar } from "./FelicetteAvatar";
import { useTypewriter } from "./useTypewriter";

interface FelicetteHeroProps {
  text: string;
  mood?: FelicetteMood;
  /** pupils follow the pointer (desktop map) */
  followPointer?: boolean;
  /** accessible name for the avatar; omitted = decorative */
  avatarLabel?: string;
  className?: string;
}

/** Tail geometry in its own viewBox (scaled to --hero-tail-w × --hero-tail-h). */
const TAIL_DOWN = "M1 0 L11 13.5 L21 0"; // phone: centred, straight down
const TAIL_SLANT = "M1 0 L21 13.5 L14 0"; // desktop: leaning right, towards the cat

function Tail({ d, className }: { d: string; className: string }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 22 14"
      preserveAspectRatio="none"
      className={`absolute top-[calc(100%-1px)] h-[var(--hero-tail-h)] w-[var(--hero-tail-w)] overflow-visible ${className}`}
    >
      {/* open path: the fill closes along the top and covers the bubble's border there */}
      <path
        d={d}
        fill="var(--hero-bubble-bg)"
        stroke="var(--hero-bubble-border)"
        strokeWidth={1}
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

export function FelicetteHero({ text, mood = "neutral", followPointer = false, avatarLabel, className = "" }: FelicetteHeroProps) {
  const { t } = useI18n();
  const { shown, done } = useTypewriter(text);

  return (
    <figure className={`flex flex-col items-center lg:items-end ${className}`}>
      <div className="relative w-full rounded-[var(--hero-bubble-radius)] border border-[var(--hero-bubble-border)] bg-[var(--hero-bubble-bg)] px-3.5 py-2.5 lg:w-[calc(100%-var(--hero-avatar-size)/2)] lg:self-start">
        <figcaption className="text-[10px] font-bold uppercase tracking-widest text-amber">{t("felicette.name")}</figcaption>
        <p aria-live="polite" className="sr-only">
          {text}
        </p>
        {/* Invisible full text reserves the final height, so the bubble never jumps while typing. */}
        <p aria-hidden className="grid text-[length:var(--hero-text-size)] leading-relaxed">
          <span className="invisible col-start-1 row-start-1">{text}</span>
          <span className={`col-start-1 row-start-1 ${done ? "" : "cursor-blink"}`}>{text.slice(0, shown)}</span>
        </p>
        <Tail d={TAIL_DOWN} className="left-1/2 -translate-x-1/2 lg:hidden" />
        <Tail d={TAIL_SLANT} className="right-[calc(var(--hero-bubble-radius)+2px)] hidden lg:block" />
      </div>
      <FelicetteAvatar
        mood={mood}
        followPointer={followPointer}
        label={avatarLabel}
        className="mt-[calc(var(--hero-tail-h)-2px)] h-[var(--hero-avatar-size)] w-[var(--hero-avatar-size)] shrink-0"
      />
      {/* persistent AI disclosure for the large mascot artwork (About & credits has the full text) */}
      <p className="mt-0.5 w-[var(--hero-avatar-size)] text-center text-[9px] leading-tight text-dim">{t("about.artCaption")}</p>
    </figure>
  );
}
