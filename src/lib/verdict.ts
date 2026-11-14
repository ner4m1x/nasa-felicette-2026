/**
 * Félicette's verdict: the engine's recommendation for a ranked card, compared with the user's
 * swipe to keep a running agreement score.
 *
 * Pure functions. Reads the Analog Score and the Mission Fit of a RankedCard but never changes
 * either. The thresholds below are UX/ENGINEERING ASSUMPTIONS of this app, stated openly — not
 * planetary data, and not part of the frozen Analog Score method. Documented in docs/MISSION_FIT.md
 * ("Félicette's verdict — UI assumptions").
 */
import { CREW_OPTIONS } from "@/data/missionOptions";
import type { I18nKey } from "@/i18n/types";
import type { MissionConfig, RankedCard } from "./types";

/**
 * Minimum Analog Score (0..1, weighted geometric mean of per-dimension desirabilities from the
 * frozen pipeline config) for Félicette to recommend a site. Assumption: a site should be clearly
 * better than "half-desirable" on balance before she vouches for it.
 */
export const FELICETTE_MIN_ANALOG = 0.6;

/**
 * Minimum Mission Fit (0..1) for Félicette to recommend a site. Assumption: at most a mild soft
 * penalty (e.g. slightly tight footprint) is acceptable.
 */
export const FELICETTE_MIN_FIT = 0.75;

export type Verdict = "purr" | "hiss";
/** "abstain" = Félicette has no data to judge (e.g. a curated, mineralogy-only card). */
export type Recommendation = Verdict | "abstain";

export interface VerdictReason {
  key: I18nKey;
  /** `dim` holds a dimension id: the UI replaces it with its translated label */
  params?: Record<string, string | number>;
}

export interface FelicetteVerdict {
  recommendation: Recommendation;
  reason: VerdictReason;
}

const pct = (x: number) => Math.round(x * 100);

export function felicetteVerdict(ranked: RankedCard, config: MissionConfig): FelicetteVerdict {
  const { card, analog, missionFit } = ranked;

  // User scans: Félicette abstains, so they never count toward the agreement score.
  if (card.kind === "user") return { recommendation: "abstain", reason: { key: "verdict.reason.userScan" } };

  const hard = missionFit.failed.find((c) => c.hard);
  if (hard) return { recommendation: "hiss", reason: { key: hard.reasonKey, params: hard.params } };

  if (card.kind === "trap") return { recommendation: "hiss", reason: { key: "verdict.reason.trap" } };

  if (card.kind === "operational") {
    return CREW_OPTIONS[config.crew].boostsOperational
      ? { recommendation: "purr", reason: { key: "verdict.reason.operationalCrew" } }
      : { recommendation: "hiss", reason: { key: "verdict.reason.operationalRobotic" } };
  }

  if (analog === null) return { recommendation: "abstain", reason: { key: "verdict.reason.unscored" } };

  if (analog.total < FELICETTE_MIN_ANALOG) {
    return {
      recommendation: "hiss",
      reason: {
        key: "verdict.reason.weakAnalog",
        params: { analog: pct(analog.total), min: pct(FELICETTE_MIN_ANALOG), dim: analog.limiting },
      },
    };
  }

  if (missionFit.fit < FELICETTE_MIN_FIT) {
    const soft = missionFit.failed.find((c) => !c.hard);
    return {
      recommendation: "hiss",
      reason: soft
        ? { key: soft.reasonKey, params: soft.params }
        : { key: "verdict.reason.weakFit", params: { fit: pct(missionFit.fit), min: pct(FELICETTE_MIN_FIT) } },
    };
  }

  return {
    recommendation: "purr",
    reason: { key: "verdict.reason.strong", params: { analog: pct(analog.total), fit: pct(missionFit.fit) } },
  };
}

// ---------- Agreement ----------

export interface SwipeRecord {
  cardId: string;
  verdict: Verdict;
  /** Félicette's recommendation at the time of the swipe */
  recommendation: Recommendation;
}

export interface Agreement {
  agreed: number;
  /** swipes where Félicette had an opinion (abstentions are not counted) */
  counted: number;
  /** agreed / counted, or null before the first counted swipe */
  ratio: number | null;
}

export function agrees(record: Pick<SwipeRecord, "verdict" | "recommendation">): boolean | null {
  if (record.recommendation === "abstain") return null;
  return record.verdict === record.recommendation;
}

export function agreementScore(records: readonly SwipeRecord[]): Agreement {
  let agreed = 0;
  let counted = 0;
  for (const r of records) {
    const a = agrees(r);
    if (a === null) continue;
    counted++;
    if (a) agreed++;
  }
  return { agreed, counted, ratio: counted === 0 ? null : agreed / counted };
}

/** Confetti rule: the user PURRed a card that Félicette also recommends. */
export function shouldCelebrate(record: Pick<SwipeRecord, "verdict" | "recommendation">): boolean {
  return record.verdict === "purr" && record.recommendation === "purr";
}

/**
 * i18n key of the bold headline in front of Félicette's reason ("I recommend HISS:",
 * "We agree: HISS.", …). The headline carries the PURR/HISS word; reason texts never do.
 */
export function verdictHeadlineKey(
  recommendation: Recommendation,
  record: Pick<SwipeRecord, "verdict" | "recommendation"> | null,
): I18nKey {
  if (!record) {
    return recommendation === "purr"
      ? "verdict.recommendPurr"
      : recommendation === "hiss"
        ? "verdict.recommendHiss"
        : "verdict.abstain";
  }
  const agreed = agrees(record);
  if (agreed === null) return "verdict.abstain";
  if (agreed) return record.verdict === "purr" ? "verdict.agreePurr" : "verdict.agreeHiss";
  return record.verdict === "purr" ? "verdict.purrVsHiss" : "verdict.hissVsPurr";
}
