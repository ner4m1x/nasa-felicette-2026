/**
 * Mission Configurator options and the mission-fit parameters each one implies.
 *
 * These are ENGINEERING ASSUMPTIONS of this app, stated openly — not planetary data.
 * Every number is documented in docs/MISSION_FIT.md. None of them affects the Analog Score.
 */
import type { I18nKey } from "@/i18n/types";
import {
  TARGET_IDS,
  type CrewId,
  type FootprintId,
  type MissionConfig,
  type MobilityId,
  type TargetId,
} from "@/lib/types";
import { TARGETS } from "./targets";

// ---------- Footprint area constants (km²) ----------

/** Compact base is defined as "< 2 km²": it needs at most 2 km² of usable ground. */
export const COMPACT_MIN_KM2 = 2;
/** Medium base is defined as "10–50 km²": below 10 km² it cannot fit at all (hard fail). */
export const MEDIUM_MIN_KM2 = 10;
/** …and only at the upper end of its range (50 km²) does it get full footprint credit. */
export const MEDIUM_FULL_KM2 = 50;
/** Mega base is defined as "> 100 km²": below 100 km² of usable ground it cannot fit (hard fail). */
export const MEGA_MIN_KM2 = 100;

// ---------- Option definitions ----------

export interface TargetOption {
  id: TargetId;
  labelKey: I18nKey;
  catKey: I18nKey;
}

export interface FootprintOption {
  id: FootprintId;
  labelKey: I18nKey;
  descKey: I18nKey;
  /** usable (trafficable) area below which the base does not fit: hard fail */
  minKm2: number;
  /** usable area from which the footprint gets full credit (linear between min and full) */
  fullCreditKm2: number;
  /** footprint is below the ~25 km grid resolution: adds a high-res follow-up note */
  belowGridResolution: boolean;
}

export interface MobilityOption {
  id: MobilityId;
  labelKey: I18nKey;
  descKey: I18nKey;
  /** heavy rovers need gentle regional slopes (trafficable terrain) */
  requiresTrafficability: boolean;
  /** climbing rover: rugged relief is a welcome test challenge */
  rewardsRelief: boolean;
}

export interface CrewOption {
  id: CrewId;
  labelKey: I18nKey;
  descKey: I18nKey;
  /** a permanent base needs the target's local resource (ISRU ice or lava-tube shielding) */
  requiresResource: boolean;
  /** operational (human-ops) analogs are pinned early in the deck (ranking.ts OPERATIONAL_POSITION) for crewed missions */
  boostsOperational: boolean;
}

export const TARGET_OPTIONS: readonly TargetOption[] = TARGET_IDS.map((id) => ({
  id,
  labelKey: TARGETS[id].labelKey,
  catKey: TARGETS[id].catKey,
}));

export const FOOTPRINT_OPTIONS: Record<FootprintId, FootprintOption> = {
  compact: {
    id: "compact",
    labelKey: "options.footprint.compact.label",
    descKey: "options.footprint.compact.desc",
    minKm2: COMPACT_MIN_KM2,
    fullCreditKm2: COMPACT_MIN_KM2,
    belowGridResolution: true,
  },
  medium: {
    id: "medium",
    labelKey: "options.footprint.medium.label",
    descKey: "options.footprint.medium.desc",
    minKm2: MEDIUM_MIN_KM2,
    fullCreditKm2: MEDIUM_FULL_KM2,
    belowGridResolution: false,
  },
  mega: {
    id: "mega",
    labelKey: "options.footprint.mega.label",
    descKey: "options.footprint.mega.desc",
    minKm2: MEGA_MIN_KM2,
    fullCreditKm2: MEGA_MIN_KM2,
    belowGridResolution: false,
  },
};

export const MOBILITY_OPTIONS: Record<MobilityId, MobilityOption> = {
  climber: {
    id: "climber",
    labelKey: "options.mobility.climber.label",
    descKey: "options.mobility.climber.desc",
    requiresTrafficability: false,
    rewardsRelief: true,
  },
  heavy: {
    id: "heavy",
    labelKey: "options.mobility.heavy.label",
    descKey: "options.mobility.heavy.desc",
    requiresTrafficability: true,
    rewardsRelief: false,
  },
};

export const CREW_OPTIONS: Record<CrewId, CrewOption> = {
  robotic: {
    id: "robotic",
    labelKey: "options.crew.robotic.label",
    descKey: "options.crew.robotic.desc",
    requiresResource: false,
    boostsOperational: false,
  },
  short: {
    id: "short",
    labelKey: "options.crew.short.label",
    descKey: "options.crew.short.desc",
    requiresResource: false,
    boostsOperational: true,
  },
  permanent: {
    id: "permanent",
    labelKey: "options.crew.permanent.label",
    descKey: "options.crew.permanent.desc",
    requiresResource: true,
    boostsOperational: true,
  },
};

export const DEFAULT_MISSION: MissionConfig = {
  target: "mars_jezero",
  footprint: "medium",
  mobility: "heavy",
  crew: "short",
};
