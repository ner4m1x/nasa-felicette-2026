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
import { CARD_KINDS, type DeckCard, type DeckFile, type DeckSource } from "./types";

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

export async function loadFixtureDeck(nodeEnv: string | undefined = process.env.NODE_ENV): Promise<DeckFile> {
  assertFixtureAllowed("src/data/fixtures/deck.dev.json", nodeEnv);
  // Direct check on the inlined env var as well, so the bundler can drop the import in production.
  if (process.env.NODE_ENV === "production") {
    throw new FixtureInProductionError("src/data/fixtures/deck.dev.json");
  }
  const mod = await import("@/data/fixtures/deck.dev.json");
  const file = parseDeckFile(mod.default);
  if (file.__fixture !== true) throw new DeckFormatError("fixture file must carry \"__fixture\": true");
  return file;
}

// ---------- Validation ----------

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null;
const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const isNumOrNull = (v: unknown) => v === null || isNum(v);
const isUnit = (v: unknown) => isNum(v) && v >= 0 && v <= 1;

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
  if (!Array.isArray(c.sourceIds)) return `${c.id}: missing sourceIds`;
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

/** Pipeline/fixture cards first; curated cards appended unless a card with the same id exists. */
export function mergeCurated(cards: readonly DeckCard[], curated: readonly DeckCard[] = CURATED_CARDS): DeckCard[] {
  const ids = new Set(cards.map((c) => c.id));
  return [...cards, ...curated.filter((c) => !ids.has(c.id))];
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
