"use client";

import { useReducedMotion } from "framer-motion";
import { useEffect, useState } from "react";

/** Typing speed of Félicette's lines (UI timing, not data). */
export const MS_PER_CHAR = 18;

/**
 * Typewriter for one line of text: how many characters are shown, and whether it's finished.
 * The caller gives its component `key={text}` so a new line restarts from 0.
 * prefers-reduced-motion: the full text at once.
 */
export function useTypewriter(text: string): { shown: number; done: boolean } {
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
  return { shown, done: shown >= text.length };
}
