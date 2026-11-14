/**
 * P1 — "Add to Félicette's deck" from the map: user cards built from one scan-grid cell.
 *
 * - Scores, mission features and the NDVI-imputed flag come from the grid via cardFromGridCell
 *   (src/lib/gridCard.ts, the same path as the Hammaguir card). No hand-typed numbers.
 * - The breakdown is generated with the pipeline's own templates (scripts/config/deck_text.json,
 *   imported read-only), mirroring `breakdown()` in scripts/pipeline/export.py: up to 3 strongest
 *   dimensions (≥ match_min_score, at least 2) = matches; limiting + one more weak dimension + the
 *   target's not-captured list = breaks down; the target's utility list = what to test.
 * - Name: the nearest pipeline candidate region within NAME_RADIUS_KM, else "Your scan @ lat, lon".
 * - Persistence: localStorage, per mission config (missionKey), every access in try/catch.
 * Félicette always abstains on user cards (src/lib/verdict.ts), so they never count toward agreement.
 */
import DECK_TEXT from "../../scripts/config/deck_text.json";
import { cardFromGridCell } from "./gridCard";
import { lowScoreFromSample } from "./lowScore";
import type { ScanGrid, ScanGridSample } from "./scanGrid";
import { TARGET_IDS, type DeckCard, type TargetBreakdown, type TargetId } from "./types";

export const USER_CARDS_STORAGE_KEY = "purr.userCards";
export const USER_ID_PREFIX = "user:";
/** "~150 km": same radius the pipeline uses for `known` sites. */
export const NAME_RADIUS_KM = 150;
const EARTH_RADIUS_KM = 6371;

type Lang = "en" | "pl";
const LANGS: readonly Lang[] = ["en", "pl"];

interface FeatureText {
  en: string;
  pl: string;
  unit: { en: string; pl: string };
  decimals: number;
  display_scale?: number;
}

const T = DECK_TEXT as unknown as {
  rules: { match_min_score: number; weak_below_score: number };
  templates: Record<"match" | "limiting" | "weak" | "not_captured_prefix", Record<Lang, string>>;
  features: Record<string, FeatureText>;
  not_captured: Record<TargetId, Record<Lang, string[]>>;
  utility: Record<TargetId, Record<Lang, string[]>>;
};

function fill(tmpl: string, p: Record<string, string>): string {
  return tmpl.replace(/\{(\w+)\}/g, (m, k: string) => (k in p ? p[k] : m));
}

function featureLine(tmpl: string, lang: Lang, feat: string, value: number | null, score: number): string {
  const fm = T.features[feat];
  const label = fm ? fm[lang] : feat;
  const v =
    value === null || !Number.isFinite(value) ? "n/a" : (value * (fm?.display_scale ?? 1)).toFixed(fm?.decimals ?? 2);
  return fill(tmpl, { label, value: v, unit: fm ? fm.unit[lang] : "", score: score.toFixed(2) });
}

/** "{label} {value}{unit}" with the pipeline's labels, units and decimals (e.g. "Peak NDVI 0.78"). */
export function featureValueText(feat: string, value: number | null, lang: Lang): string {
  const fm = T.features[feat];
  const v =
    value === null || !Number.isFinite(value) ? "n/a" : (value * (fm?.display_scale ?? 1)).toFixed(fm?.decimals ?? 2);
  return `${fm ? fm[lang] : feat} ${v}${fm ? fm.unit[lang] : ""}`;
}

/** Breakdown for one target from a grid sample (null when the target is not scored here). */
export function breakdownFromSample(sample: ScanGridSample, target: TargetId): TargetBreakdown | null {
  const s = sample.targets[target];
  if (!s || s.total === null) return null;
  const ids = Object.keys(s.dims).filter((k) => s.dims[k] !== null);
  const score = (k: string) => s.dims[k] as number;
  const order = [...ids].sort((a, b) => score(b) - score(a) || ids.indexOf(a) - ids.indexOf(b));
  let strong = order.slice(0, 3).filter((k) => score(k) >= T.rules.match_min_score);
  if (strong.length < 2) strong = order.slice(0, 2);
  const limiting = s.limiting && ids.includes(s.limiting) ? s.limiting : order[order.length - 1];
  const weak = [
    limiting,
    ...[...order].reverse().filter((k) => k !== limiting && score(k) < T.rules.weak_below_score).slice(0, 1),
  ].filter((k): k is string => Boolean(k));
  const value = (k: string) => sample.features[k]?.value ?? null;

  const out: TargetBreakdown = { matches: { en: [], pl: [] }, breaksDown: { en: [], pl: [] }, utility: { en: [], pl: [] } };
  for (const lang of LANGS) {
    const tm = T.templates;
    out.matches[lang] = strong.map((k) => featureLine(tm.match[lang], lang, k, value(k), score(k)));
    out.breaksDown[lang] = [
      ...weak.map((k) => featureLine(tm[k === limiting ? "limiting" : "weak"][lang], lang, k, value(k), score(k))),
      ...(T.not_captured[target]?.[lang] ?? []).map((x) => tm.not_captured_prefix[lang] + x),
    ];
    out.utility[lang] = [...(T.utility[target]?.[lang] ?? [])];
  }
  return out;
}

export function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const r = Math.PI / 180;
  const a =
    Math.sin(((lat2 - lat1) * r) / 2) ** 2 +
    Math.cos(lat1 * r) * Math.cos(lat2 * r) * Math.sin(((lon2 - lon1) * r) / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(a)));
}

const fmtCoord = (v: number, pos: string, neg: string) => `${Math.abs(v).toFixed(2)}°${v >= 0 ? pos : neg}`;

/** Nearest pipeline candidate region (regional card) within the radius, else "Your scan @ lat, lon". */
export function userCardName(lat: number, lon: number, regions: readonly DeckCard[]): string {
  let best: { name: string; km: number } | null = null;
  for (const c of regions) {
    if (c.scale !== "regional" || !c.name) continue;
    const km = haversineKm(lat, lon, c.lat, c.lon);
    if (km <= NAME_RADIUS_KM && (!best || km < best.km)) best = { name: c.name, km };
  }
  return best?.name ?? `Your scan @ ${fmtCoord(lat, "N", "S")}, ${fmtCoord(lon, "E", "W")}`;
}

export type AddCheck =
  | { ok: true }
  | { ok: false; reason: "noGrid" | "ocean" | "unscored" | "duplicate" };

export const userCardId = (sample: Pick<ScanGridSample, "cellLat" | "cellLon">) =>
  `${USER_ID_PREFIX}${sample.cellLat.toFixed(2)},${sample.cellLon.toFixed(2)}`;

/** Can the clicked cell become a user card for this target? (drives the button state + message) */
export function canAddUserCard(
  sample: ScanGridSample | null,
  target: TargetId,
  existingIds: ReadonlySet<string>,
): AddCheck {
  if (!sample) return { ok: false, reason: "noGrid" };
  if (sample.land === false) return { ok: false, reason: "ocean" };
  const s = sample.targets[target];
  if (!s || s.total === null) return { ok: false, reason: "unscored" };
  if (existingIds.has(userCardId(sample))) return { ok: false, reason: "duplicate" };
  return { ok: true };
}

/** Build a user card for the clicked point; null when the cell is ocean or has no scores. */
export function createUserCard(grid: ScanGrid, lat: number, lon: number, regions: readonly DeckCard[]): DeckCard | null {
  const sample = grid.sample(lat, lon);
  if (sample.land === false) return null;
  const breakdown: DeckCard["breakdown"] = {};
  const lowScore: NonNullable<DeckCard["lowScore"]> = {};
  for (const t of TARGET_IDS) {
    const b = breakdownFromSample(sample, t);
    if (b) breakdown[t] = b;
    const low = lowScoreFromSample(sample, t);
    if (low) lowScore[t] = low;
  }
  const card = cardFromGridCell(grid, {
    id: userCardId(sample),
    kind: "user",
    name: userCardName(lat, lon, regions),
    country: null,
    lat,
    lon,
    scale: "site",
    known: false,
    breakdown,
    sourceIds: [],
  });
  return card && Object.keys(lowScore).length ? { ...card, lowScore } : card;
}

// ---------- Persistence (per mission config) ----------

export type UserCardsByMission = Record<string, DeckCard[]>;

const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

function isUserCard(v: unknown): v is DeckCard {
  if (typeof v !== "object" || v === null) return false;
  const c = v as Record<string, unknown>;
  return (
    c.kind === "user" &&
    typeof c.id === "string" &&
    c.id.startsWith(USER_ID_PREFIX) &&
    typeof c.name === "string" &&
    isNum(c.lat) &&
    isNum(c.lon) &&
    typeof c.mission === "object" &&
    c.mission !== null &&
    typeof c.breakdown === "object" &&
    c.breakdown !== null &&
    (c.analog === null || typeof c.analog === "object")
  );
}

export function readUserCards(storage: Pick<Storage, "getItem"> | null): UserCardsByMission {
  try {
    const raw = storage?.getItem(USER_CARDS_STORAGE_KEY);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) return {};
    const out: UserCardsByMission = {};
    for (const [key, list] of Object.entries(parsed)) {
      if (Array.isArray(list)) out[key] = list.filter(isUserCard);
    }
    return out;
  } catch {
    return {};
  }
}

export function writeUserCards(storage: Pick<Storage, "setItem"> | null, cards: UserCardsByMission): void {
  try {
    storage?.setItem(USER_CARDS_STORAGE_KEY, JSON.stringify(cards));
  } catch {
    // storage blocked or full: user cards still live for this session
  }
}

export function addUserCard(all: UserCardsByMission, key: string, card: DeckCard): UserCardsByMission {
  const list = (all[key] ?? []).filter((c) => c.id !== card.id);
  return { ...all, [key]: [...list, card] };
}

export function removeUserCard(all: UserCardsByMission, key: string, id: string): UserCardsByMission {
  return { ...all, [key]: (all[key] ?? []).filter((c) => c.id !== id) };
}

export const isUserCardId = (id: string) => id.startsWith(USER_ID_PREFIX);
