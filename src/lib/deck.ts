/**
 * Deck loader.
 *
 * 1. Load /data/deck.json (published by the Python pipeline).
 * 2. If it is missing:
 *    - dev: load src/data/fixtures/deck.dev.json and flag `isFixture` (UI shows the FixtureBanner);
 *    - production: only the curated cards, plus the "Global scan not yet published" notice.
 * 3. Always merge in the curated cards (src/data/curatedCards.ts).
 *
 * Production guard (ground rule 2): a production build never uses fixture data. Loading the
 * fixture, or a deck.json marked `__fixture: true`, throws FixtureInProductionError.
 */
import { CURATED_CARDS } from "@/data/curatedCards";
import type { I18nKey } from "@/i18n/types";
import { LANGS } from "@/i18n/types";
import {
  CARD_KINDS,
  TARGET_IDS,
  type DeckCard,
  type DeckFile,
  type DeckSource,
  type TargetBreakdown,
  type TargetId,
} from "./types";

export const DECK_URL = "/data/deck.json";

export class FixtureInProductionError extends Error {
  constructor(what: string) {
    super(`Refusing to use dev fixture data in production (${what}).`);
    this.name = "FixtureInProductionError";
  }
}

export class DeckFormatError extends Error {
  constructor(detail: string) {
    super(`Invalid deck file: ${detail}`);
    this.name = "DeckFormatError";
  }
}

export interface DeckLoadResult {
  cards: DeckCard[];
  source: DeckSource;
  isFixture: boolean;
  notice: I18nKey | null;
}

export interface LoadDeckOptions {
  fetchImpl?: typeof fetch;
  /** defaults to process.env.NODE_ENV */
  nodeEnv?: string;
}

export function assertFixtureAllowed(what: string, nodeEnv: string | undefined = process.env.NODE_ENV): void {
  if (nodeEnv === "production") throw new FixtureInProductionError(what);
}

const FIXTURE_PATH = "src/data/fixtures/deck.dev.json";

export async function loadFixtureDeck(nodeEnv: string | undefined = process.env.NODE_ENV): Promise<DeckFile> {
  assertFixtureAllowed(FIXTURE_PATH, nodeEnv);
  // The dynamic import sits only inside this branch: Next inlines process.env.NODE_ENV, so in a
  // production build the condition is the constant `false` and the fixture chunk is never emitted.
  if (process.env.NODE_ENV !== "production") {
    const mod = await import("@/data/fixtures/deck.dev.json");
    const file = parseDeckFile(mod.default);
    if (file.__fixture !== true) throw new DeckFormatError("fixture file must carry \"__fixture\": true");
    return file;
  }
  throw new FixtureInProductionError(FIXTURE_PATH);
}

// ---------- Validation ----------

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null;
const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const isNumOrNull = (v: unknown) => v === null || isNum(v);
const isUnit = (v: unknown) => isNum(v) && v >= 0 && v <= 1;

const isStringList = (v: unknown) => Array.isArray(v) && v.every((x) => typeof x === "string");

/** { matches, breaksDown, utility }, each with a string list per language (deck.schema.json). */
function isTargetBreakdown(b: unknown): boolean {
  if (!isObj(b)) return false;
  return (["matches", "breaksDown", "utility"] as const).every((section) => {
    const perLang = b[section];
    return isObj(perLang) && LANGS.every((lang) => isStringList(perLang[lang]));
  });
}

function cardProblem(c: unknown): string | null {
  if (!isObj(c)) return "card is not an object";
  if (typeof c.id !== "string" || !c.id) return "missing id";
  if (!(CARD_KINDS as readonly unknown[]).includes(c.kind)) return `${c.id}: bad kind`;
  if (typeof c.name !== "string") return `${c.id}: missing name`;
  if (!isNum(c.lat) || !isNum(c.lon)) return `${c.id}: bad coordinates`;
  if (c.scale !== "regional" && c.scale !== "site") return `${c.id}: bad scale`;
  if (!isNumOrNull(c.regionAreaKm2)) return `${c.id}: bad regionAreaKm2`;
  if (c.analog !== null) {
    if (!isObj(c.analog)) return `${c.id}: bad analog`;
    for (const [target, e] of Object.entries(c.analog)) {
      if (!isObj(e) || !isUnit(e.total) || !isObj(e.dims) || typeof e.limiting !== "string" || !isNum(e.percentile)) {
        return `${c.id}: bad analog entry for ${target}`;
      }
    }
  }
  if (!isObj(c.mission)) return `${c.id}: missing mission`;
  for (const k of ["slopeMeanDeg", "trafficableFrac", "reliefStdM", "iceProxy", "basaltFrac"]) {
    if (!isNumOrNull(c.mission[k])) return `${c.id}: bad mission.${k}`;
  }
  if (!isObj(c.breakdown)) return `${c.id}: missing breakdown`;
  for (const [target, b] of Object.entries(c.breakdown)) {
    if (!(TARGET_IDS as readonly string[]).includes(target)) return `${c.id}: breakdown for unknown target ${target}`;
    if (!isTargetBreakdown(b)) return `${c.id}: bad breakdown for ${target}`;
  }
  if (!Array.isArray(c.sourceIds)) return `${c.id}: missing sourceIds`;
  if (c.ndviImputed !== undefined && typeof c.ndviImputed !== "boolean") return `${c.id}: bad ndviImputed`;
  return null;
}

export function parseDeckFile(json: unknown): DeckFile {
  if (!isObj(json) || !Array.isArray(json.cards)) throw new DeckFormatError("expected { cards: [...] }");
  for (const card of json.cards) {
    const problem = cardProblem(card);
    if (problem) throw new DeckFormatError(problem);
  }
  return json as unknown as DeckFile;
}

/** The breakdown of `card` for `target`, or null when the card has none for that target. */
export function breakdownFor(card: Pick<DeckCard, "breakdown">, target: TargetId): TargetBreakdown | null {
  return card.breakdown[target] ?? null;
}

const BREAKDOWN_SECTIONS = ["matches", "breaksDown", "utility"] as const;

/** Curated text first, then the pipeline's generated lines, per target, section and language. */
function mergeBreakdowns(curated: DeckCard["breakdown"], pipeline: DeckCard["breakdown"]): DeckCard["breakdown"] {
  const out: DeckCard["breakdown"] = {};
  for (const target of TARGET_IDS) {
    const c = curated[target];
    const p = pipeline[target];
    if (!c && !p) continue;
    out[target] = Object.fromEntries(
      BREAKDOWN_SECTIONS.map((s) => [
        s,
        Object.fromEntries(LANGS.map((lang) => [lang, [...(c?.[s][lang] ?? []), ...(p?.[s][lang] ?? [])]])),
      ]),
    ) as unknown as TargetBreakdown;
  }
  return out;
}

/**
 * One card for a site that is both curated and scanned by the pipeline: the curated id, kind, name,
 * coordinates and narrative; the pipeline's measured numbers (analog, mission, stability, area,
 * ndviImputed).
 * Sources are the union, so the pipeline's numeric lines stay cited.
 */
export function mergeCuratedWithPipeline(curated: DeckCard, pipeline: DeckCard): DeckCard {
  return {
    ...curated,
    analog: pipeline.analog,
    mission: pipeline.mission,
    stability: pipeline.stability,
    regionAreaKm2: pipeline.regionAreaKm2,
    breakdown: mergeBreakdowns(curated.breakdown, pipeline.breakdown),
    sourceIds: [...new Set([...curated.sourceIds, ...pipeline.sourceIds])],
    // a property of the pipeline's measured cells, like analog/mission
    ...(pipeline.ndviImputed !== undefined && { ndviImputed: pipeline.ndviImputed }),
  };
}

/**
 * Pipeline/fixture cards first; curated cards appended unless a card with the same id exists.
 * A curated card whose `pipelineSiteId` matches a loaded pipeline card replaces that card in place
 * (merged via mergeCuratedWithPipeline), so the site appears once.
 */
export function mergeCurated(cards: readonly DeckCard[], curated: readonly DeckCard[] = CURATED_CARDS): DeckCard[] {
  const ids = new Set(cards.map((c) => c.id));
  const toAdd = curated.filter((c) => !ids.has(c.id));
  const linked = new Map(toAdd.filter((c) => c.pipelineSiteId).map((c) => [c.pipelineSiteId!, c]));
  const merged = cards.map((card) => {
    const cur = linked.get(card.id);
    return cur ? mergeCuratedWithPipeline(cur, card) : card;
  });
  const used = new Set(cards.filter((c) => linked.has(c.id)).map((c) => linked.get(c.id)!.id));
  return [...merged, ...toAdd.filter((c) => !used.has(c.id))];
}

// ---------- Loader ----------

async function fetchPipelineDeck(fetchImpl: typeof fetch): Promise<unknown | null> {
  let res: Response;
  try {
    res = await fetchImpl(DECK_URL, { cache: "no-store" });
  } catch {
    return null; // network error = not published (yet)
  }
  if (!res.ok) return null;
  return res.json();
}

export async function loadDeck(options: LoadDeckOptions = {}): Promise<DeckLoadResult> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const nodeEnv = options.nodeEnv ?? process.env.NODE_ENV;

  const json = await fetchPipelineDeck(fetchImpl);
  if (json !== null) {
    const file = parseDeckFile(json);
    if (file.__fixture === true) {
      assertFixtureAllowed(DECK_URL, nodeEnv);
      return { cards: mergeCurated(file.cards), source: "fixture", isFixture: true, notice: null };
    }
    return { cards: mergeCurated(file.cards), source: "pipeline", isFixture: false, notice: null };
  }

  if (nodeEnv !== "production") {
    const fixture = await loadFixtureDeck(nodeEnv);
    return { cards: mergeCurated(fixture.cards), source: "fixture", isFixture: true, notice: null };
  }

  return {
    cards: mergeCurated([]),
    source: "curated-only",
    isFixture: false,
    notice: "deck.scanNotPublished",
  };
}
