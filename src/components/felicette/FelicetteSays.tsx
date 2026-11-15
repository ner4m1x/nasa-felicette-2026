"use client";

/**
 * Félicette's compact speech bubble (small avatar beside it) and a typewriter effect. For the big
 * "character speaking" presentation use FelicetteHero.
 * - Give it `key={text}` from the parent so a new line restarts the effect.
 * - Screen readers get the full sentence once (aria-live), not one announcement per character.
 * - prefers-reduced-motion: the full text is shown immediately.
 */

import { useI18n } from "@/i18n/I18nProvider";
import type { FelicetteMood } from "@/lib/felicetteMood";
import { FelicetteAvatar } from "./FelicetteAvatar";
import { useTypewriter } from "./useTypewriter";

interface FelicetteSaysProps {
  text: string;
  /** her expression next to the bubble (default neutral) */
  mood?: FelicetteMood;
  className?: string;
}

export function FelicetteSays({ text, mood = "neutral", className = "" }: FelicetteSaysProps) {
  const { t } = useI18n();
  const { shown, done } = useTypewriter(text);

  return (
    <figure className={`flex items-start gap-3 ${className}`}>
      <FelicetteAvatar mood={mood} compact className="h-11 w-11 shrink-0" />
      <div className="relative min-w-0 flex-1 rounded-lg rounded-tl-none border border-line bg-panel-2 px-3 py-2">
        <figcaption className="text-[10px] font-bold uppercase tracking-widest text-amber">
          {t("felicette.name")}
        </figcaption>
        <p aria-live="polite" className="sr-only">
          {text}
        </p>
        {/* Invisible full text reserves the final height, so the bubble never jumps while typing. */}
        <p aria-hidden className="grid text-sm leading-relaxed">
          <span className="invisible col-start-1 row-start-1">{text}</span>
          <span className={`col-start-1 row-start-1 ${done ? "" : "cursor-blink"}`}>{text.slice(0, shown)}</span>
        </p>
      </div>
    </figure>
  );
}
