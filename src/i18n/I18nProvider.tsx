"use client";

// Phase 1 stub: in-memory language state + typed t().
// Phase 2 adds localStorage persistence and <html lang> sync.

import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import { en } from "./en";
import { pl } from "./pl";
import type { Dictionary, I18nKey, I18nParams, Lang } from "./types";

const DICTIONARIES: Record<Lang, Dictionary> = { en, pl };

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

interface I18nValue {
  lang: Lang;
  setLang: (lang: Lang) => void;
  t: (key: I18nKey, params?: I18nParams) => string;
}

const I18nContext = createContext<I18nValue | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLang] = useState<Lang>("en");
  const value = useMemo<I18nValue>(
    () => ({ lang, setLang, t: (key, params) => translate(DICTIONARIES[lang], key, params) }),
    [lang],
  );
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nValue {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used inside <I18nProvider>");
  return ctx;
}
