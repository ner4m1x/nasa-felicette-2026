import { describe, expect, it } from "vitest";
import { ICE_FILTER_DEFAULT_ON, rankIceFiltered, iceFilterDefault, iceFilterState, isIceSheetCandidate, pinSize, selectPins } from "@/lib/mapPins";
import { TARGET_IDS } from "@/lib/types";
import { CURATED_CARDS, LUNARES_CARD_ID } from "@/data/curatedCards";
import { rankDeck } from "@/lib/ranking";
import type { RankedCard } from "@/lib/types";
import { PIN_SIZE } from "@/theme/tokens";
import { config, deepFreeze, makeCard, type CardOverrides } from "./helpers";

// Synthetic cards: arbitrary test inputs, not data.
const scored = (id: string, total: number, extra: CardOverrides = {}) =>
  makeCard({
    id,
    analog: { mars_jezero: { total, dims: { a: total }, limiting: "a", percentile: 50 } },
    ...extra,
  });
const item = (c: ReturnType<typeof makeCard>) => ({ ranked: { card: c, analog: c.analog?.mars_jezero ?? null } as RankedCard });

describe("selectPins", () => {
  const discoveries = Array.from({ length: 15 }, (_, i) => scored(`d${String(i).padStart(2, "0")}`, 0.5 + i * 0.01));
  const others = [
    scored("bench", 0.1, { kind: "benchmark" }),
    scored("trap", 0.05, { kind: "trap" }),
    makeCard({ id: "cur", kind: "curated", analog: null }),
  ];
  const items = [...discoveries, ...others].map(item);

  it("shows the top 10 discoveries plus every non-discovery card by default", () => {
    const pins = selectPins(items, false);
    const ids = pins.map((p) => p.ranked.card.id);
    expect(ids.filter((id) => id.startsWith("d"))).toHaveLength(10);
    expect(ids).toContain("d14"); // highest score
    expect(ids).not.toContain("d00"); // lowest discovery
    expect(ids).toEqual(expect.arrayContaining(["bench", "trap", "cur"]));
  });

  it("shows every candidate with the toggle on", () => {
    expect(selectPins(items, true)).toHaveLength(items.length);
  });

  it("ranks by Analog Score; size shrinks with rank; unscored cards have no rank", () => {
    const pins = selectPins(items, false);
    const by = (id: string) => pins.find((p) => p.ranked.card.id === id)!;
    expect(by("d14").rank).toBe(1);
    expect(by("d14").size).toBe(PIN_SIZE.max);
    expect(by("d13").size).toBeLessThanOrEqual(by("d14").size);
    expect(by("cur").rank).toBeNull();
    expect(by("cur").size).toBe(PIN_SIZE.base);
    expect(pinSize(500)).toBe(PIN_SIZE.min);
  });
});

describe("ice-sheet view filter", () => {
  const cards = [
    scored("ant", 0.9, { kind: "discovery", lat: -75 }),
    scored("imp", 0.85, { kind: "discovery", lat: 70, ndviImputed: true }),
    scored("ok", 0.8, { kind: "discovery", lat: 20 }),
    scored("bench-ant", 0.7, { kind: "benchmark", lat: -77, ndviImputed: true }),
  ];

  it("flags Antarctic or NDVI-imputed discoveries only", () => {
    expect(cards.map(isIceSheetCandidate)).toEqual([true, true, false, false]);
  });

  it("hides ice-sheet candidates but never changes scores or the order of the rest", () => {
    const cfg = config({ target: "mars_jezero" });
    const frozen = deepFreeze(structuredClone(cards));
    const deck = deepFreeze(rankDeck(frozen, cfg));
    const off = rankIceFiltered(frozen, cfg, deck, false);
    expect(off).toBe(deck);
    const on = rankIceFiltered(frozen, cfg, deck, true);
    const ids = on.deck.map((r) => r.card.id);
    expect(ids).not.toContain("ant");
    expect(ids).not.toContain("imp");
    // same scores (the pipeline's analog entries by reference), same relative order
    const kept = deck.deck.filter((r) => ids.includes(r.card.id));
    expect(on.deck.map((r) => r.card.id)).toEqual(kept.map((r) => r.card.id));
    on.deck.forEach((r, i) => {
      expect(r.rankScore).toBe(kept[i].rankScore);
      expect(r.analog).toBe(kept[i].analog);
    });
  });
});

describe("ice-sheet filter default", () => {
  it("is ON by default only for the lava-tube target", () => {
    expect(ICE_FILTER_DEFAULT_ON).toEqual(["moon_tranquillitatis_pit"]);
    for (const t of TARGET_IDS) expect(iceFilterDefault(t), t).toBe(t === "moon_tranquillitatis_pit");
  });

  it("the user's choice wins; byDefault only when the default is what turned it on", () => {
    expect(iceFilterState("moon_tranquillitatis_pit", {})).toEqual({ hide: true, byDefault: true });
    expect(iceFilterState("moon_tranquillitatis_pit", { moon_tranquillitatis_pit: false })).toEqual({ hide: false, byDefault: false });
    expect(iceFilterState("moon_tranquillitatis_pit", { moon_tranquillitatis_pit: true })).toEqual({ hide: true, byDefault: false });
    expect(iceFilterState("mars_jezero", {})).toEqual({ hide: false, byDefault: false });
    expect(iceFilterState("mars_jezero", { mars_jezero: true })).toEqual({ hide: true, byDefault: false });
    // a choice for one target does not leak into another
    expect(iceFilterState("moon_shackleton", { moon_tranquillitatis_pit: false }).hide).toBe(false);
  });

  it("default-on for the lava tube changes nothing about the scores", () => {
    const pit = (id: string, total: number, extra: CardOverrides) =>
      makeCard({ id, analog: { moon_tranquillitatis_pit: { total, dims: { a: total }, limiting: "a", percentile: 50 } }, ...extra });
    const cards = [
      pit("ant", 0.95, { kind: "discovery", lat: -75 }),
      pit("imp", 0.9, { kind: "discovery", lat: -62, ndviImputed: true }),
      pit("ok", 0.8, { kind: "discovery", lat: 20 }),
    ];
    const cfg = config({ target: "moon_tranquillitatis_pit" });
    const ranked = deepFreeze(rankDeck(cards, cfg));
    const snapshot = structuredClone(ranked);
    const shown = rankIceFiltered(cards, cfg, ranked, iceFilterState("moon_tranquillitatis_pit", {}).hide);
    expect(shown.deck.map((r) => r.card.id)).toEqual(["ok"]);
    const ok = ranked.deck.find((r) => r.card.id === "ok")!;
    expect(shown.deck[0].analog).toBe(ok.analog);
    expect(shown.deck[0].rankScore).toBe(ok.rankScore);
    expect(shown.deck[0].analog!.total).toBe(0.8);
    expect(ranked.deck.map((r) => r.analog!.total)).toEqual([0.95, 0.9, 0.8]);
    expect(ranked).toEqual(snapshot); // unfiltered deck (and every score in it) untouched
  });
});

describe("ice filter keeps the deck's fixed positions", () => {
  it("crewed lava tube: position 1 is still the best visible analog, LunAres stays 3rd", () => {
    const pit = (id: string, total: number, extra: CardOverrides) =>
      makeCard({ id, analog: { moon_tranquillitatis_pit: { total, dims: { a: total }, limiting: "a", percentile: 50 } }, ...extra });
    const cards = [
      pit("ant1", 0.95, { kind: "discovery", lat: -75 }),
      pit("ant2", 0.94, { kind: "discovery", lat: -70 }),
      pit("lanzarote", 0.8, { kind: "benchmark", lat: 29 }),
      pit("other", 0.7, { kind: "discovery", lat: 20 }),
      pit("third", 0.6, { kind: "discovery", lat: 10 }),
      ...CURATED_CARDS,
    ];
    const cfg = config({ target: "moon_tranquillitatis_pit", crew: "short", footprint: "compact", mobility: "climber" });
    const ranked = rankDeck(cards, cfg);
    const shown = rankIceFiltered(cards, cfg, ranked, true).deck.map((r) => r.card.id);
    expect(shown[0]).toBe("lanzarote");
    expect(shown.indexOf(LUNARES_CARD_ID)).toBe(2);
  });
});
