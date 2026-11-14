"use client";

/**
 * Félicette's speech bubble with a typewriter effect.
 * - Give it `key={text}` from the parent so a new line restarts the effect.
 * - Screen readers get the full sentence once (aria-live), not one announcement per character.
 * - prefers-reduced-motion: the full text is shown immediately.
 */

import { useReducedMotion } from "framer-motion";
import { useEffect, useState } from "react";
import { useI18n } from "@/i18n/I18nProvider";

/** Typing speed of the effect (UI timing, not data). */
const MS_PER_CHAR = 18;

interface FelicetteSaysProps {
  text: string;
  className?: string;
}

export function FelicetteSays({ text, className = "" }: FelicetteSaysProps) {
  const { t } = useI18n();
  const reduceMotion = useReducedMotion();
  const [typed, setTyped] = useState(0);

  useEffect(() => {
    if (reduceMotion) return;
    const id = window.setInterval(() => {
      setTyped((n) => {
        if (n >= text.length) {
          window.clearInterval(id);
          return n;
        }
        return n + 1;
      });
    }, MS_PER_CHAR);
    return () => window.clearInterval(id);
  }, [text, reduceMotion]);

  const shown = reduceMotion ? text.length : typed;
  const done = shown >= text.length;

  return (
    <figure className={`flex items-start gap-3 ${className}`}>
      <div
        aria-hidden
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-amber/60 bg-amber/10 text-[10px] font-bold text-amber"
      >
        =^.^=
      </div>
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
