/**
 * Pure helpers that encode a MissionConfig in the URL query and in localStorage.
 * URL format: `?t=mars_jezero&f=mega&m=heavy&c=permanent` (shareable link).
 * Unknown or invalid values are ignored, never guessed.
 */
import {
  CREW_IDS,
  FOOTPRINT_IDS,
  MOBILITY_IDS,
  TARGET_IDS,
  type MissionConfig,
} from "@/lib/types";

/** Query parameter name for each config field. */
export const MISSION_QUERY_KEYS = {
  target: "t",
  footprint: "f",
  mobility: "m",
  crew: "c",
} as const satisfies Record<keyof MissionConfig, string>;

const ALLOWED: { [K in keyof MissionConfig]: readonly MissionConfig[K][] } = {
  target: TARGET_IDS,
  footprint: FOOTPRINT_IDS,
  mobility: MOBILITY_IDS,
  crew: CREW_IDS,
};

const FIELDS = Object.keys(MISSION_QUERY_KEYS) as (keyof MissionConfig)[];

function pick<K extends keyof MissionConfig>(field: K, raw: unknown): MissionConfig[K] | undefined {
  return (ALLOWED[field] as readonly unknown[]).includes(raw) ? (raw as MissionConfig[K]) : undefined;
}

/** Valid fields found in the query; invalid or missing ones are left out. */
export function parseMissionQuery(params: URLSearchParams): Partial<MissionConfig> {
  const out: Partial<MissionConfig> = {};
  for (const field of FIELDS) {
    const v = pick(field, params.get(MISSION_QUERY_KEYS[field]));
    if (v !== undefined) (out as Record<string, unknown>)[field] = v;
  }
  return out;
}

/** Valid fields of a stored (JSON-parsed) value; anything else is dropped. */
export function parseStoredMission(raw: unknown): Partial<MissionConfig> {
  if (typeof raw !== "object" || raw === null) return {};
  const out: Partial<MissionConfig> = {};
  for (const field of FIELDS) {
    const v = pick(field, (raw as Record<string, unknown>)[field]);
    if (v !== undefined) (out as Record<string, unknown>)[field] = v;
  }
  return out;
}

export function isCompleteMission(partial: Partial<MissionConfig>): partial is MissionConfig {
  return FIELDS.every((f) => partial[f] !== undefined);
}

/**
 * Writes the config into `params` (other parameters are kept) and returns a new URLSearchParams.
 */
export function withMissionQuery(params: URLSearchParams, config: MissionConfig): URLSearchParams {
  const next = new URLSearchParams(params);
  for (const field of FIELDS) next.set(MISSION_QUERY_KEYS[field], config[field]);
  return next;
}

/**
 * Initial config: URL query wins (a shared link), then localStorage, then the default.
 * `fromLink` is true when the URL carried a complete mission.
 */
export function resolveInitialMission(
  query: Partial<MissionConfig>,
  stored: Partial<MissionConfig>,
  fallback: MissionConfig,
): { config: MissionConfig; fromLink: boolean } {
  return {
    config: { ...fallback, ...stored, ...query },
    fromLink: isCompleteMission(query),
  };
}
