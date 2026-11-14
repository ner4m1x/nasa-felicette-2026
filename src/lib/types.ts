/**
 * Core domain types. `DeckCard` must match what the Python pipeline exports to /public/data/deck.json.
 *
 * Two scores, never mixed:
 *  - Analog Score (`DeckCard.analog`): planetary similarity from the frozen pipeline config.
 *    Read-only in the browser; configurator settings never change it.
 *  - Mission Fit (`MissionFitResult.fit`): engineering suitability, computed in the browser
 *    from the configurator settings (src/lib/missionFit.ts).
 */
import type { LowScoreReason } from "./lowScore";
import type { I18nKey, Lang } from "@/i18n/types";

export type { Lang } from "@/i18n/types";

// ---------- Targets ----------

export const TARGET_IDS = [
  "moon_shackleton",
  "moon_tranquillitatis_pit",
  "mars_jezero",
  "mars_arcadia",
] as const;
export type TargetId = (typeof TARGET_IDS)[number];

// ---------- Deck cards ----------

/** "user" = added by the user from the map (src/lib/userCards.ts); never in deck.json. */
export const CARD_KINDS = ["benchmark", "discovery", "trap", "curated", "operational", "user"] as const;
export type CardKind = (typeof CARD_KINDS)[number];

export interface AnalogEntry {
  /** 0..1, from the frozen pipeline config */
  total: number;
  /** per-dimension 0..1 */
  dims: Record<string, number>;
  /** dimension id that limits the total */
  limiting: string;
  /** percentile among land cells, 0..100 */
  percentile: number;
}

export interface MissionFeatures {
  slopeMeanDeg: number | null;
  /** fraction of DEM pixels with slope < 5° */
  trafficableFrac: number | null;
  reliefStdM: number | null;
  /** 0..1 */
  iceProxy: number | null;
  /** 0..1 */
  basaltFrac: number | null;
}

/** Generated (pipeline) or hand-written (curated) text for one target, per language. */
export interface TargetBreakdown {
  matches: Record<Lang, string[]>;
  breaksDown: Record<Lang, string[]>;
  /** what to test here: instruments, rovers, ISRU, ops */
  utility: Record<Lang, string[]>;
}

export interface DeckCard {
  id: string;
  kind: CardKind;
  name: string;
  country: string | null;
  lat: number;
  lon: number;
  /** regional = from the 0.25° grid; site = curated, below grid resolution */
  scale: "regional" | "site";
  regionAreaKm2: number | null;
  /** null = not scorable by the global grid (e.g. mineralogy-only analog) */
  analog: Partial<Record<TargetId, AnalogEntry>> | null;
  /** raw mission-relevant features, with units in the pipeline meta */
  mission: MissionFeatures;
  /** from the pipeline's sensitivity analysis */
  stability: number | null;
  /** near an established analog site */
  known: boolean;
  /**
   * Breakdown text per target (the pipeline generates it per target from the frozen config, in EN
   * and PL). A target without an entry has no breakdown: the UI says so instead of guessing.
   * Mirrors `breakdown` in scripts/config/deck.schema.json.
   */
  breakdown: Partial<Record<TargetId, TargetBreakdown>>;
  sourceIds: string[];
  /**
   * true if any grid cell behind this card had NDVI imputed (targets.json rule
   * `ndvi_no_modis_coverage`: no MODIS coverage, land cover shows a non-vegetated surface).
   * Optional; mirrors `ndviImputed` in scripts/config/deck.schema.json.
   */
  ndviImputed?: boolean;
  /**
   * Curated cards only: id of the pipeline card for the same site (`site-<known_sites id>`). When
   * both are in the deck they are merged into one card (src/lib/deck.ts `mergeCurated`).
   */
  pipelineSiteId?: string;
  /**
   * User scans only: why the Analog Score is very low, per target (src/lib/lowScore.ts), built
   * from the grid cell when the card was created.
   */
  lowScore?: Partial<Record<TargetId, LowScoreReason>>;
}

/** Shape of /public/data/deck.json and of src/data/fixtures/deck.dev.json. */
export interface DeckFile {
  /** true only for dev fixtures; a production build refuses to load such a file */
  __fixture?: boolean;
  generatedAt?: string | null;
  configId?: string | null;
  cards: DeckCard[];
}

// ---------- Mission configurator ----------

export const FOOTPRINT_IDS = ["compact", "medium", "mega"] as const;
export type FootprintId = (typeof FOOTPRINT_IDS)[number];

export const MOBILITY_IDS = ["climber", "heavy"] as const;
export type MobilityId = (typeof MOBILITY_IDS)[number];

export const CREW_IDS = ["robotic", "short", "permanent"] as const;
export type CrewId = (typeof CREW_IDS)[number];

export interface MissionConfig {
  target: TargetId;
  footprint: FootprintId;
  mobility: MobilityId;
  crew: CrewId;
}

// ---------- Mission fit ----------

export type ConstraintId = "trafficability" | "footprint" | "resource";

export interface Constraint {
  id: ConstraintId;
  /** hard = the card is moved to the "Rejected by your mission specs" pile */
  hard: boolean;
  /** i18n key of the human-readable reason ("34% trafficable terrain, …"); no PURR/HISS prefix, the UI adds the verdict */
  reasonKey: I18nKey;
  params: Record<string, number | string>;
}

export interface Note {
  key: I18nKey;
  params?: Record<string, number | string>;
}

export interface MissionFitResult {
  /** 0..1; 0 whenever a hard constraint failed */
  fit: number;
  /** every constraint that did not fully pass (hard fails and soft penalties) */
  failed: Constraint[];
  notes: Note[];
}

// ---------- Ranking ----------

export interface RankedCard {
  card: DeckCard;
  /** Analog entry for the configured target, passed through unchanged (null = unscored). */
  analog: AnalogEntry | null;
  missionFit: MissionFitResult;
  /** analog.total × fit; null for unscored (curated / trap / operational) cards */
  rankScore: number | null;
}

export interface RankedDeck {
  deck: RankedCard[];
  /** cards with at least one hard-failed constraint */
  rejected: RankedCard[];
}

// ---------- Loader ----------

export type DeckSource = "pipeline" | "fixture" | "curated-only";
