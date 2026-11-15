"use client";

/**
 * Typed i18n without a library.
 * - `lang` is persisted in localStorage (every access wrapped in try/catch) and mirrored to <html lang>.
 * - The provider reads localStorage during its first render, so it opts into browser-only rendering
 *   with `use(browser())`; it must sit under a <Suspense> boundary (see src/app/page.tsx).
 */

import { createContext, use, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { browser } from "react-dom";
import { en } from "./en";
import { pl } from "./pl";
import { LANGS, type Dictionary, type I18nKey, type I18nParams, type Lang } from "./types";

const DICTIONARIES: Record<Lang, Dictionary> = { en, pl };
export const LANG_STORAGE_KEY = "purr.lang";

/** Resolve a dotted key and fill `{placeholders}`. Falls back to the key itself if missing. */
export function translate(dict: Dictionary, key: I18nKey, params?: I18nParams): string {
  let node: unknown = dict;
  for (const part of key.split(".")) {
    node = (node as Record<string, unknown> | undefined)?.[part];
  }
  if (typeof node !== "string") return key;
  if (!params) return node;
  return node.replace(/\{(\w+)\}/g, (m, name: string) =>
    name in params ? String(params[name]) : m,
  );
}

export interface DimLabel {
  /** scientific label, shown prominently */
  sci: string;
  /** Félicette's cat label, shown as a subtitle (null for unknown dimensions) */
  cat: string | null;
  /** one- or two-word label for tight spaces (the compact radar legend); falls back to `sci` */
  short: string;
}

export interface I18nValue {
  lang: Lang;
  setLang: (lang: Lang) => void;
  t: (key: I18nKey, params?: I18nParams) => string;
  /** Two-layer label for a pipeline dimension id; unknown ids fall back to the raw id. */
  dim: (id: string) => DimLabel;
}

/** exported for server-render tests (a fixed-language value without the provider) */
export const I18nContext = createContext<I18nValue | null>(null);

function readStoredLang(): Lang {
  try {
    const v = window.localStorage.getItem(LANG_STORAGE_KEY);
    if (v && (LANGS as readonly string[]).includes(v)) return v as Lang;
  } catch {
    // storage blocked (private mode, sandbox): fall back to the default
  }
  return "en";
}

export function I18nProvider({ children }: { children: ReactNode }) {
  use(browser("The interface language is stored in localStorage."));
  const [lang, setLangState] = useState<Lang>(readStoredLang);

  const setLang = useCallback((next: Lang) => {
    setLangState(next);
    try {
      window.localStorage.setItem(LANG_STORAGE_KEY, next);
    } catch {
      // ignore: language still switches for this session
    }
  }, []);

  // Sync an external system (the document element) with React state.
  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  const value = useMemo<I18nValue>(() => {
    const dict = DICTIONARIES[lang];
    const dims = dict.dims as Record<string, { sci: string; cat: string; short: string } | undefined>;
    return {
      lang,
      setLang,
      t: (key, params) => translate(dict, key, params),
      dim: (id) => {
        const d = dims[id];
        return d ? { sci: d.sci, cat: d.cat, short: d.short } : { sci: id, cat: null, short: id };
      },
    };
  }, [lang, setLang]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nValue {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used inside <I18nProvider>");
  return ctx;
}
