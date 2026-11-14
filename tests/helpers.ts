import {
  CREW_IDS,
  FOOTPRINT_IDS,
  MOBILITY_IDS,
  TARGET_IDS,
  type AnalogEntry,
  type DeckCard,
  type MissionConfig,
} from "@/lib/types";

/** Synthetic test card. Values are arbitrary test inputs, not data. */
export type CardOverrides = Partial<Omit<DeckCard, "mission">> & { mission?: Partial<DeckCard["mission"]> };

export function makeCard(overrides: CardOverrides = {}): DeckCard {
  const { mission, ...rest } = overrides;
  const entry: AnalogEntry = { total: 0.8, dims: { a: 0.8 }, limiting: "a", percentile: 90 };
  return {
    id: "test-card",
    kind: "discovery",
    name: "TEST CARD",
    country: null,
    lat: 0,
    lon: 0,
    scale: "regional",
    regionAreaKm2: 1000,
    analog: Object.fromEntries(TARGET_IDS.map((t) => [t, entry])),
    stability: null,
    known: false,
    breakdown: { matches: { en: [], pl: [] }, breaksDown: { en: [], pl: [] }, utility: { en: [], pl: [] } },
    sourceIds: [],
    ...rest,
    mission: {
      slopeMeanDeg: 2,
      trafficableFrac: 0.9,
      reliefStdM: 20,
      iceProxy: 0.9,
      basaltFrac: 0.9,
      ...mission,
    },
  };
}

export function config(overrides: Partial<MissionConfig> = {}): MissionConfig {
  return { target: "mars_jezero", footprint: "medium", mobility: "heavy", crew: "robotic", ...overrides };
}

export function allConfigs(): MissionConfig[] {
  return TARGET_IDS.flatMap((target) =>
    FOOTPRINT_IDS.flatMap((footprint) =>
      MOBILITY_IDS.flatMap((mobility) => CREW_IDS.map((crew) => ({ target, footprint, mobility, crew }))),
    ),
  );
}

export function deepFreeze<T>(obj: T): T {
  if (obj && typeof obj === "object" && !Object.isFrozen(obj)) {
    Object.freeze(obj);
    for (const v of Object.values(obj)) deepFreeze(v);
  }
  return obj;
}
