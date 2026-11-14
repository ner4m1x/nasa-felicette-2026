import type { en } from "./en";

export const LANGS = ["en", "pl"] as const;
export type Lang = (typeof LANGS)[number];

/** Same shape as `en`, but every leaf widened to `string` (so `pl` can differ in wording, not in keys). */
type Widen<T> = T extends string ? string : { readonly [K in keyof T]: Widen<T[K]> };
export type Dictionary = Widen<typeof en>;

/** Dotted path to every string leaf, e.g. "fit.constraint.trafficabilityFail". */
type Paths<T, P extends string = ""> = {
  [K in keyof T & string]: T[K] extends string ? `${P}${K}` : Paths<T[K], `${P}${K}.`>;
}[keyof T & string];
export type I18nKey = Paths<Dictionary>;

export type I18nParams = Readonly<Record<string, string | number>>;
