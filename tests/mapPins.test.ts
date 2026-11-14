import { describe, expect, it } from "vitest";
import { applyIceFilter, isIceSheetCandidate, pinSize, selectPins } from "@/lib/mapPins";
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
    const deck = deepFreeze(rankDeck(cards, config({ target: "mars_jezero" })));
    const off = applyIceFilter(deck, false);
    expect(off).toBe(deck);
    const on = applyIceFilter(deck, true);
    const ids = on.deck.map((r) => r.card.id);
    expect(ids).not.toContain("ant");
    expect(ids).not.toContain("imp");
    // same objects, same scores, same relative order
    const kept = deck.deck.filter((r) => ids.includes(r.card.id));
    expect(on.deck).toEqual(kept);
    on.deck.forEach((r, i) => {
      expect(r).toBe(kept[i]);
      expect(r.rankScore).toBe(kept[i].rankScore);
      expect(r.analog).toBe(kept[i].analog);
    });
  });
});
