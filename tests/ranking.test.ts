import { describe, expect, it } from "vitest";
import { CURATED_CARDS, HAMMAGUIR_CARD_ID, LUNARES_CARD_ID } from "@/data/curatedCards";
import { INTERLEAVE_EVERY, OPERATIONAL_POSITION, rankDeck } from "@/lib/ranking";
import { TARGET_IDS, type AnalogEntry, type DeckCard } from "@/lib/types";
import { allConfigs, config, deepFreeze, makeCard } from "./helpers";

const entry = (total: number): AnalogEntry => ({ total, dims: { a: total }, limiting: "a", percentile: 50 });
const scoredCard = (id: string, total: number, trafficableFrac = 0.9) =>
  makeCard({
    id,
    analog: Object.fromEntries(TARGET_IDS.map((t) => [t, entry(total)])),
    mission: { trafficableFrac },
  });

describe("rankDeck — order", () => {
  it("orders scored cards by analog.total × fit", () => {
    // fit for heavy: 0.9 traffic → 1; 0.4 traffic → partial credit < 1
    const cards = [scoredCard("a", 0.9, 0.4), scoredCard("b", 0.7, 0.9), scoredCard("c", 0.95, 0.9)];
    const { deck } = rankDeck(cards, config());
    expect(deck.map((r) => r.card.id)).toEqual(["c", "b", "a"]);
    for (const r of deck) expect(r.rankScore).toBeCloseTo(r.analog!.total * r.missionFit.fit);
  });

  it("breaks ties deterministically by id", () => {
    const { deck } = rankDeck([scoredCard("z", 0.5), scoredCard("m", 0.5)], config());
    expect(deck.map((r) => r.card.id)).toEqual(["m", "z"]);
  });

  it("interleaves unscored (curated/trap) cards at fixed positions 3, 6, …", () => {
    const scored = Array.from({ length: 8 }, (_, i) => scoredCard(`s${i}`, 0.9 - i * 0.05));
    const unscored = [makeCard({ id: "u1", kind: "curated", analog: null }), makeCard({ id: "u2", kind: "trap", analog: null })];
    const { deck } = rankDeck([...unscored, ...scored], config());
    const ids = deck.map((r) => r.card.id);
    expect(ids.indexOf("u1")).toBe(INTERLEAVE_EVERY - 1);
    expect(ids.indexOf("u2")).toBe(2 * INTERLEAVE_EVERY - 1);
    expect(ids).toHaveLength(10);
  });

  it("appends unscored cards when there are too few scored ones", () => {
    const { deck } = rankDeck([makeCard({ id: "u1", analog: null, kind: "curated" }), scoredCard("s0", 0.9)], config());
    expect(deck.map((r) => r.card.id)).toEqual(["s0", "u1"]);
  });

  it("omits pipeline cards that have no score for the selected target", () => {
    const marsOnly = makeCard({ id: "mars-only", analog: { mars_jezero: entry(0.9) } });
    expect(rankDeck([marsOnly], config({ target: "moon_shackleton" })).deck).toEqual([]);
    expect(rankDeck([marsOnly], config({ target: "mars_jezero" })).deck).toHaveLength(1);
  });
});

describe("rankDeck — pins (LunAres for crews, Hammaguir for Jezero)", () => {
  const cards = [...Array.from({ length: 6 }, (_, i) => scoredCard(`s${i}`, 0.9 - i * 0.1)), ...CURATED_CARDS];
  const ids = (cfg: Parameters<typeof config>[0]) => rankDeck(cards, config(cfg)).deck.map((r) => r.card.id);

  it.each(["short", "permanent"] as const)("pins LunAres at position 3 for %s crews", (crew) => {
    for (const target of TARGET_IDS) {
      const deck = ids({ crew, target, footprint: "compact", mobility: "climber" });
      if (deck.includes(LUNARES_CARD_ID)) expect(deck.indexOf(LUNARES_CARD_ID), `${target}`).toBe(OPERATIONAL_POSITION - 1);
    }
  });

  it("position 1 is always the best Analog × Fit card, for every configuration", () => {
    for (const cfg of allConfigs()) {
      const { deck } = rankDeck(cards, cfg);
      const best = deck.filter((r) => r.rankScore !== null).sort((a, b) => b.rankScore! - a.rankScore!)[0];
      if (best) expect(deck[0].card.id, JSON.stringify(cfg)).toBe(best.card.id);
      expect(deck[0].card.kind).not.toBe("operational");
    }
  });

  it("keeps Hammaguir 2nd and LunAres 3rd in the crewed Jezero deck", () => {
    // Hammaguir is grid-built at runtime; a low-scored stand-in with its id shows the pin works
    const hammaguir = makeCard({ id: HAMMAGUIR_CARD_ID, kind: "curated", analog: { mars_jezero: entry(0.05) } });
    const deck = rankDeck([...cards, hammaguir], config({ target: "mars_jezero", crew: "short", footprint: "compact", mobility: "climber" }));
    const order = deck.deck.map((r) => r.card.id);
    expect(order[0]).toBe("s0");
    expect(order.indexOf(HAMMAGUIR_CARD_ID)).toBe(1);
    expect(order.indexOf(LUNARES_CARD_ID)).toBe(2);
  });

  it("appends LunAres when the deck is shorter than its position", () => {
    const lunares = CURATED_CARDS.find((c) => c.id === LUNARES_CARD_ID)!;
    expect(rankDeck([scoredCard("only", 0.8), lunares], config({ crew: "short" })).deck.map((r) => r.card.id)).toEqual([
      "only",
      LUNARES_CARD_ID,
    ]);
  });

  it("does not pin LunAres for robotic missions", () => {
    const deck = ids({ crew: "robotic" });
    expect(deck[0]).not.toBe(LUNARES_CARD_ID);
  });
});

describe("rankDeck — rejected pile", () => {
  it("moves hard-failed cards to the rejected pile, each with a reason", () => {
    const cards = [scoredCard("ok", 0.8, 0.9), scoredCard("steep", 0.99, 0.1)];
    const { deck, rejected } = rankDeck(cards, config({ mobility: "heavy" }));
    expect(deck.map((r) => r.card.id)).toEqual(["ok"]);
    expect(rejected.map((r) => r.card.id)).toEqual(["steep"]);
    const reason = rejected[0].missionFit.failed.find((c) => c.hard)!;
    expect(reason.reasonKey).toBe("fit.constraint.trafficabilityFail");
    expect(reason.params.pct).toBe(10);
  });

  it("re-ranks when the configurator changes (same card can pass or fail)", () => {
    const card = scoredCard("steep", 0.9, 0.1);
    expect(rankDeck([card], config({ mobility: "heavy" })).rejected).toHaveLength(1);
    expect(rankDeck([card], config({ mobility: "climber" })).deck).toHaveLength(1);
  });

  it("every card ends up in exactly one of deck / rejected", () => {
    const cards = [scoredCard("a", 0.9, 0.1), scoredCard("b", 0.5, 0.9), ...CURATED_CARDS];
    for (const cfg of allConfigs()) {
      const { deck, rejected } = rankDeck(cards, cfg);
      expect(deck.length + rejected.length).toBe(cards.length);
    }
  });
});

describe("Analog Score is independent of the configurator", () => {
  it("never changes, for any configurator option", () => {
    const cards: DeckCard[] = deepFreeze([
      scoredCard("a", 0.91, 0.9),
      scoredCard("b", 0.42, 0.1),
      makeCard({ id: "c", analog: { mars_jezero: entry(0.66), moon_shackleton: entry(0.33) } }),
      ...structuredClone(CURATED_CARDS),
    ]);
    const snapshot = structuredClone(cards);

    for (const cfg of allConfigs()) {
      const { deck, rejected } = rankDeck(cards, cfg);
      for (const r of [...deck, ...rejected]) {
        const original = snapshot.find((c) => c.id === r.card.id)!;
        const expected = original.analog === null ? null : original.analog[cfg.target];
        // the analog entry shown is exactly the pipeline's entry for the target
        expect(r.analog).toEqual(expected);
      }
    }
    // inputs (frozen) were never mutated
    expect(cards).toEqual(snapshot);
  });

  it("the analog total for a given target is identical across all other options", () => {
    const cards = [scoredCard("a", 0.91, 0.5), scoredCard("b", 0.42, 0.25)];
    for (const target of TARGET_IDS) {
      const totals = allConfigs()
        .filter((c) => c.target === target)
        .map((cfg) => {
          const { deck, rejected } = rankDeck(cards, cfg);
          return Object.fromEntries([...deck, ...rejected].map((r) => [r.card.id, r.analog?.total]));
        });
      for (const t of totals) expect(t).toEqual(totals[0]);
    }
  });
});
