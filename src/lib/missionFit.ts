/**
 * Mission Fit: engineering and operational suitability of a card for the user's mission.
 *
 * Pure functions, computed in the browser from the configurator settings. Mission Fit NEVER reads
 * or modifies the Analog Score (`card.analog`); the two numbers are only combined in ranking.ts.
 *
 * All thresholds below are ENGINEERING ASSUMPTIONS of this app, stated openly — not planetary data.
 * They are documented in docs/MISSION_FIT.md (keep both in sync).
 *
 * fit = mobilityFactor × footprintFactor × resourceFactor, each in 0..1; any hard fail → fit = 0.
 * Missing data (null) never counts as a pass or a fail for terrain: it adds an "unverified" note.
 * The one exception is a permanent crew's resource requirement, which fails when unmeasured.
 */
import { CREW_OPTIONS, FOOTPRINT_OPTIONS, MOBILITY_OPTIONS } from "@/data/missionOptions";
import { TARGETS } from "@/data/targets";
import type { I18nKey } from "@/i18n/types";
import type { Constraint, DeckCard, MissionConfig, MissionFitResult, Note } from "./types";

// ---------- Named constants (see docs/MISSION_FIT.md) ----------

/**
 * Heavy pressurized rovers: trafficable fraction (share of DEM pixels with slope < 5°, from the
 * pipeline) at or above which the site gets full mobility credit. Assumption: a heavy-rover base
 * needs most of its region drivable to plan routes freely.
 */
export const HEAVY_TRAFFICABLE_FULL = 0.6;

/**
 * Heavy rovers: trafficable fraction below which the site is a hard fail. Assumption: below this,
 * drivable ground is too fragmented for route planning at regional scale.
 */
export const HEAVY_TRAFFICABLE_FAIL = 0.2;

/**
 * Credit given to a soft constraint that is barely above its hard-fail threshold; credit rises
 * linearly to 1 at the full-credit threshold. Keeps every passing site above 0 so it stays
 * distinguishable from rejected ones.
 */
export const PARTIAL_CREDIT_FLOOR = 0.25;

/**
 * Climbing rover: mobility factor for flat terrain. Slopes are never penalised; the remaining
 * (1 − base) is a small bonus for rugged relief, which is a useful test challenge.
 */
export const CLIMBER_BASE_FACTOR = 0.9;

/** Climbing rover: relief (std. dev. of elevation, m) at which the full relief bonus is reached. */
export const CLIMBER_RELIEF_FULL_BONUS_M = 200;

/**
 * Permanent crew on an ice target (moon_shackleton, mars_arcadia): minimum ice proxy (0..1,
 * from the pipeline) to count as a usable ISRU resource. Assumption: mid-scale of the proxy.
 */
export const PERMANENT_ICE_PROXY_MIN = 0.5;

/**
 * Permanent crew on a lava-tube target (moon_tranquillitatis_pit): minimum basalt fraction
 * (0..1, from the pipeline) to count as basaltic / lava-tube substrate for natural shielding.
 */
export const PERMANENT_BASALT_FRAC_MIN = 0.5;

/** Shown once in the UI next to every Mission Fit verdict. */
export const HONESTY_NOTE_KEY: I18nKey = "fit.note.honesty";

// ---------- Helpers ----------

/** Linear credit from PARTIAL_CREDIT_FLOOR at `fail` to 1 at `full` (clamped). */
function partialCredit(value: number, fail: number, full: number): number {
  if (value >= full) return 1;
  if (full <= fail) return 1;
  const t = (value - fail) / (full - fail);
  return PARTIAL_CREDIT_FLOOR + (1 - PARTIAL_CREDIT_FLOOR) * Math.min(1, Math.max(0, t));
}

const pct = (frac: number) => Math.round(frac * 100);

interface FactorResult {
  factor: number;
  failed: Constraint[];
  notes: Note[];
}

const PASS: FactorResult = { factor: 1, failed: [], notes: [] };

// ---------- Constraint evaluators ----------

export function mobilityFactor(card: DeckCard, config: MissionConfig): FactorResult {
  const option = MOBILITY_OPTIONS[config.mobility];
  const { trafficableFrac, reliefStdM } = card.mission;

  if (option.rewardsRelief) {
    const relief = reliefStdM ?? 0;
    const bonus = Math.min(1, Math.max(0, relief / CLIMBER_RELIEF_FULL_BONUS_M));
    const notes: Note[] = bonus >= 1 ? [{ key: "fit.note.reliefBonus" }] : [];
    return { factor: CLIMBER_BASE_FACTOR + (1 - CLIMBER_BASE_FACTOR) * bonus, failed: [], notes };
  }

  if (!option.requiresTrafficability) return PASS;
  if (trafficableFrac === null) {
    return { factor: 1, failed: [], notes: [{ key: "fit.note.trafficabilityUnknown" }] };
  }

  const params = {
    pct: pct(trafficableFrac),
    minPct: pct(HEAVY_TRAFFICABLE_FAIL),
    fullPct: pct(HEAVY_TRAFFICABLE_FULL),
  };
  if (trafficableFrac < HEAVY_TRAFFICABLE_FAIL) {
    return {
      factor: 0,
      failed: [{ id: "trafficability", hard: true, reasonKey: "fit.constraint.trafficabilityFail", params }],
      notes: [],
    };
  }
  const factor = partialCredit(trafficableFrac, HEAVY_TRAFFICABLE_FAIL, HEAVY_TRAFFICABLE_FULL);
  return {
    factor,
    failed:
      factor < 1
        ? [{ id: "trafficability", hard: false, reasonKey: "fit.constraint.trafficabilityLow", params }]
        : [],
    notes: [],
  };
}

export function footprintFactor(card: DeckCard, config: MissionConfig): FactorResult {
  const option = FOOTPRINT_OPTIONS[config.footprint];

  // User scans: a clicked point has no measured area → footprint unverified (site-scale).
  if (card.kind === "user") return { factor: 1, failed: [], notes: [{ key: "fit.note.footprintUserSite" }] };

  // Site-scale cards are already below grid resolution: a compact base gets no penalty.
  if (card.scale === "site" && option.belowGridResolution) return PASS;

  const notes: Note[] = option.belowGridResolution ? [{ key: "fit.note.footprintBelowGrid" }] : [];
  const { trafficableFrac } = card.mission;
  if (trafficableFrac === null || card.regionAreaKm2 === null) {
    return { factor: 1, failed: [], notes: [...notes, { key: "fit.note.areaUnknown" }] };
  }

  const usableKm2 = trafficableFrac * card.regionAreaKm2;
  const params = {
    areaKm2: Math.round(usableKm2),
    minKm2: option.minKm2,
    fullKm2: option.fullCreditKm2,
  };
  if (usableKm2 < option.minKm2) {
    return {
      factor: 0,
      failed: [{ id: "footprint", hard: true, reasonKey: "fit.constraint.footprintFail", params }],
      notes,
    };
  }
  const factor = partialCredit(usableKm2, option.minKm2, option.fullCreditKm2);
  return {
    factor,
    failed:
      factor < 1
        ? [{ id: "footprint", hard: false, reasonKey: "fit.constraint.footprintTight", params }]
        : [],
    notes,
  };
}

export function resourceFactor(card: DeckCard, config: MissionConfig): FactorResult {
  if (!CREW_OPTIONS[config.crew].requiresResource) return PASS;
  const target = TARGETS[config.target];

  if (!target.resourceGloballyCaptured) {
    return { factor: 1, failed: [], notes: [{ key: "fit.note.hydratedMineralsNotCaptured" }] };
  }

  const spec =
    target.resource === "ice"
      ? {
          value: card.mission.iceProxy,
          min: PERMANENT_ICE_PROXY_MIN,
          missingKey: "fit.constraint.iceMissing" as const,
          lowKey: "fit.constraint.iceLow" as const,
        }
      : {
          value: card.mission.basaltFrac,
          min: PERMANENT_BASALT_FRAC_MIN,
          missingKey: "fit.constraint.basaltMissing" as const,
          lowKey: "fit.constraint.basaltLow" as const,
        };

  if (spec.value === null) {
    return {
      factor: 0,
      failed: [{ id: "resource", hard: true, reasonKey: spec.missingKey, params: { min: spec.min } }],
      notes: [],
    };
  }
  if (spec.value < spec.min) {
    return {
      factor: 0,
      failed: [
        { id: "resource", hard: true, reasonKey: spec.lowKey, params: { value: spec.value, min: spec.min } },
      ],
      notes: [],
    };
  }
  return PASS;
}

// ---------- Public API ----------

export function missionFit(card: DeckCard, config: MissionConfig): MissionFitResult {
  // Operational analogs test human operations, not terrain: terrain/resource constraints don't apply.
  if (card.kind === "operational") {
    return { fit: 1, failed: [], notes: [{ key: "fit.note.operationalNotGeology" }] };
  }

  const parts = [mobilityFactor(card, config), footprintFactor(card, config), resourceFactor(card, config)];
  const failed = parts.flatMap((p) => p.failed);
  const notes = parts.flatMap((p) => p.notes);
  const fit = failed.some((c) => c.hard) ? 0 : parts.reduce((acc, p) => acc * p.factor, 1);
  return { fit, failed, notes };
}

export function hasHardFail(result: MissionFitResult): boolean {
  return result.failed.some((c) => c.hard);
}
