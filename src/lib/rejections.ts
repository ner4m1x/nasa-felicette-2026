/**
 * "Strict specs" explanation for the rejected pile (display only — it reads the hard-failed
 * constraints that missionFit already produced and never changes a score or a decision).
 *
 * - `strictSpecs`: whether rejected cards are more than half of the deck (then the UI shows a chip).
 * - `groupRejections`: rejected cards grouped by the failing constraint, largest group first, each
 *   with the rule that failed and which configurator option would relax it (null = none would).
 *   A card that fails several constraints is counted in each of its groups.
 */

import { CREW_OPTIONS, FOOTPRINT_OPTIONS, MOBILITY_OPTIONS } from "@/data/missionOptions";
import { TARGETS } from "@/data/targets";
import type { I18nKey } from "@/i18n/types";
import { HEAVY_TRAFFICABLE_FAIL, PERMANENT_BASALT_FRAC_MIN, PERMANENT_ICE_PROXY_MIN } from "./missionFit";
import {
  CREW_IDS,
  FOOTPRINT_IDS,
  MOBILITY_IDS,
  type ConstraintId,
  type MissionConfig,
  type RankedCard,
} from "./types";

/** Show the chip when rejected cards are strictly more than this share of all cards. */
export const STRICT_SHARE = 0.5;

export interface StrictSpecs {
  show: boolean;
  rejected: number;
  total: number;
}

export function strictSpecs(deckCount: number, rejectedCount: number): StrictSpecs {
  const total = deckCount + rejectedCount;
  return { show: total > 0 && rejectedCount / total > STRICT_SHARE, rejected: rejectedCount, total };
}

export interface I18nMessage {
  key: I18nKey;
  params?: Record<string, string | number>;
  /** params whose value is itself an i18n key (an option label), translated by the UI */
  labelParams?: Record<string, I18nKey>;
}

export interface RejectionGroup {
  id: ConstraintId;
  /** cards failing this constraint (hard) */
  cards: RankedCard[];
  /** the rule that failed, e.g. "Heavy rovers need ≥ 20 % trafficable terrain" */
  rule: I18nMessage;
  /** which configurator option would relax it; null when no option does */
  relax: I18nMessage | null;
}

const ORDER: readonly ConstraintId[] = ["trafficability", "footprint", "resource"];

export function groupRejections(rejected: readonly RankedCard[], config: MissionConfig): RejectionGroup[] {
  const byId = new Map<ConstraintId, RankedCard[]>();
  for (const r of rejected) {
    const ids = new Set(r.missionFit.failed.filter((c) => c.hard).map((c) => c.id));
    for (const id of ids) byId.set(id, [...(byId.get(id) ?? []), r]);
  }
  return [...byId.entries()]
    .map(([id, cards]) => ({ id, cards, rule: ruleFor(id, config), relax: relaxFor(id, config) }))
    .sort((a, b) => b.cards.length - a.cards.length || ORDER.indexOf(a.id) - ORDER.indexOf(b.id));
}

const pct = (frac: number) => Math.round(frac * 100);

function ruleFor(id: ConstraintId, config: MissionConfig): I18nMessage {
  switch (id) {
    case "trafficability":
      return { key: "deck.strict.rule.trafficability", params: { minPct: pct(HEAVY_TRAFFICABLE_FAIL) } };
    case "footprint": {
      const opt = FOOTPRINT_OPTIONS[config.footprint];
      return { key: "deck.strict.rule.footprint", params: { minKm2: opt.minKm2 }, labelParams: { base: opt.labelKey } };
    }
    case "resource":
      return TARGETS[config.target].resource === "ice"
        ? { key: "deck.strict.rule.ice", params: { min: PERMANENT_ICE_PROXY_MIN } }
        : { key: "deck.strict.rule.basalt", params: { min: PERMANENT_BASALT_FRAC_MIN } };
  }
}

function relaxFor(id: ConstraintId, config: MissionConfig): I18nMessage | null {
  switch (id) {
    case "trafficability": {
      const free = MOBILITY_IDS.find((m) => !MOBILITY_OPTIONS[m].requiresTrafficability);
      return free ? { key: "deck.strict.relax.mobility", labelParams: { option: MOBILITY_OPTIONS[free].labelKey } } : null;
    }
    case "footprint": {
      // the next smaller footprint (FOOTPRINT_IDS is ordered small → large)
      const minKm2 = FOOTPRINT_OPTIONS[config.footprint].minKm2;
      const smaller = FOOTPRINT_IDS.filter((f) => FOOTPRINT_OPTIONS[f].minKm2 < minKm2).at(-1);
      return smaller
        ? {
            key: "deck.strict.relax.footprint",
            params: { minKm2: FOOTPRINT_OPTIONS[smaller].minKm2 },
            labelParams: { option: FOOTPRINT_OPTIONS[smaller].labelKey },
          }
        : null;
    }
    case "resource": {
      // prefer a crewed option that needs no local resource (keeps the crewed intent), else any
      const free =
        CREW_IDS.find((c) => !CREW_OPTIONS[c].requiresResource && CREW_OPTIONS[c].boostsOperational) ??
        CREW_IDS.find((c) => !CREW_OPTIONS[c].requiresResource);
      return free ? { key: "deck.strict.relax.crew", labelParams: { option: CREW_OPTIONS[free].labelKey } } : null;
    }
  }
}
