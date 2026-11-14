import { describe, expect, it } from "vitest";
import { CURATED_CARDS, LUNARES_CARD_ID } from "@/data/curatedCards";
import { rankCard } from "@/lib/ranking";
import { TARGET_IDS, type AnalogEntry, type RankedCard } from "@/lib/types";
import {
  agreementScore,
  agrees,
  FELICETTE_MIN_ANALOG,
  FELICETTE_MIN_FIT,
  felicetteVerdict,
  shouldCelebrate,
  type SwipeRecord,
} from "@/lib/verdict";
import { allConfigs, config, deepFreeze, makeCard, type CardOverrides } from "./helpers";

const entry = (total: number): AnalogEntry => ({ total, dims: { a: total }, limiting: "a", percentile: 50 });
const ranked = (overrides: CardOverrides, cfg = config()): RankedCard => {
  const r = rankCard(makeCard(overrides), cfg);
  if (!r) throw new Error("card not ranked");
  return r;
};
const withTotal = (total: number) => Object.fromEntries(TARGET_IDS.map((t) => [t, entry(total)]));
const curated = (id: string) => CURATED_CARDS.find((c) => c.id === id)!;

describe("felicetteVerdict", () => {
  it("PURRs a strong analog with a good mission fit", () => {
    const v = felicetteVerdict(ranked({ analog: withTotal(0.9) }), config());
    expect(v.recommendation).toBe("purr");
    expect(v.reason.key).toBe("verdict.reason.strong");
  });

  it("HISSes a weak analog and names the limiting dimension", () => {
    const v = felicetteVerdict(ranked({ analog: withTotal(FELICETTE_MIN_ANALOG - 0.01) }), config());
    expect(v.recommendation).toBe("hiss");
    expect(v.reason.key).toBe("verdict.reason.weakAnalog");
    expect(v.reason.params?.dim).toBe("a");
  });

  it("HISSes a strong analog whose mission fit is below the bar, citing the soft constraint", () => {
    // heavy rovers + 30% trafficable terrain → soft penalty well below FELICETTE_MIN_FIT
    const r = ranked({ analog: withTotal(0.9), mission: { trafficableFrac: 0.3 } }, config({ mobility: "heavy" }));
    expect(r.missionFit.fit).toBeLessThan(FELICETTE_MIN_FIT);
    const v = felicetteVerdict(r, config({ mobility: "heavy" }));
    expect(v.recommendation).toBe("hiss");
    expect(v.reason.key).toBe("fit.constraint.trafficabilityLow");
  });

  it("HISSes a hard-failed card with the constraint reason", () => {
    const cfg = config({ mobility: "heavy" });
    const v = felicetteVerdict(ranked({ analog: withTotal(0.9), mission: { trafficableFrac: 0.05 } }, cfg), cfg);
    expect(v.recommendation).toBe("hiss");
    expect(v.reason.key).toBe("fit.constraint.trafficabilityFail");
  });

  it("always HISSes traps, even with a high analog score", () => {
    const v = felicetteVerdict(ranked({ kind: "trap", analog: withTotal(0.99) }), config());
    expect(v.recommendation).toBe("hiss");
    expect(v.reason.key).toBe("verdict.reason.trap");
  });

  it("PURRs the operational card for crewed missions and HISSes it for robotic ones", () => {
    const lunares = curated(LUNARES_CARD_ID);
    for (const crew of ["short", "permanent"] as const) {
      const cfg = config({ crew });
      expect(felicetteVerdict(rankCard(lunares, cfg)!, cfg).recommendation).toBe("purr");
    }
    const robotic = config({ crew: "robotic" });
    expect(felicetteVerdict(rankCard(lunares, robotic)!, robotic).recommendation).toBe("hiss");
  });

  it("abstains on unscored curated cards (no data to judge)", () => {
    const cfg = config();
    const v = felicetteVerdict(rankCard(curated("curated-lake-salda"), cfg)!, cfg);
    expect(v.recommendation).toBe("abstain");
  });

  it("never modifies the card, its analog entry or its mission fit", () => {
    for (const cfg of allConfigs()) {
      const r = deepFreeze(ranked({ analog: withTotal(0.7) }, cfg));
      expect(() => felicetteVerdict(r, cfg)).not.toThrow();
    }
  });
});

describe("agreement score", () => {
  const rec = (verdict: SwipeRecord["verdict"], recommendation: SwipeRecord["recommendation"]): SwipeRecord => ({
    cardId: `${verdict}-${recommendation}`,
    verdict,
    recommendation,
  });

  it("is null before any counted swipe", () => {
    expect(agreementScore([])).toEqual({ agreed: 0, counted: 0, ratio: null });
    expect(agreementScore([rec("purr", "abstain")]).ratio).toBeNull();
  });

  it("counts agreements and ignores abstentions", () => {
    const s = agreementScore([rec("purr", "purr"), rec("hiss", "purr"), rec("hiss", "hiss"), rec("purr", "abstain")]);
    expect(s).toEqual({ agreed: 2, counted: 3, ratio: 2 / 3 });
  });

  it("agrees() is null for abstentions", () => {
    expect(agrees(rec("purr", "abstain"))).toBeNull();
    expect(agrees(rec("hiss", "hiss"))).toBe(true);
    expect(agrees(rec("purr", "hiss"))).toBe(false);
  });

  it("celebrates only a PURR that Félicette also recommends", () => {
    expect(shouldCelebrate(rec("purr", "purr"))).toBe(true);
    expect(shouldCelebrate(rec("purr", "hiss"))).toBe(false);
    expect(shouldCelebrate(rec("purr", "abstain"))).toBe(false);
    expect(shouldCelebrate(rec("hiss", "hiss"))).toBe(false);
  });
});
