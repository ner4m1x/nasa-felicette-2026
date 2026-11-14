import { describe, expect, it } from "vitest";
import { CURATED_CARDS, LUNARES_CARD_ID } from "@/data/curatedCards";
import fixture from "@/data/fixtures/deck.dev.json";
import { breakdownFor, DeckFormatError, parseDeckFile } from "@/lib/deck";
import { TARGET_IDS } from "@/lib/types";
import { makeCard } from "./helpers";

const entry = {
  matches: { en: ["m"], pl: ["m"] },
  breaksDown: { en: ["b"], pl: ["b"] },
  utility: { en: ["u"], pl: ["u"] },
};

describe("per-target breakdown (deck.schema.json)", () => {
  it("accepts a breakdown keyed by target", () => {
    const card = makeCard({ breakdown: { mars_jezero: entry } });
    expect(() => parseDeckFile({ cards: [card] })).not.toThrow();
  });

  it("accepts an empty breakdown (no target has text)", () => {
    expect(() => parseDeckFile({ cards: [makeCard({ breakdown: {} })] })).not.toThrow();
  });

  it("rejects the old flat shape and unknown targets", () => {
    const flat = { ...makeCard(), breakdown: entry };
    expect(() => parseDeckFile({ cards: [flat] })).toThrow(DeckFormatError);
    const unknown = { ...makeCard(), breakdown: { venus: entry } };
    expect(() => parseDeckFile({ cards: [unknown] })).toThrow(/unknown target venus/);
  });

  it("rejects a breakdown missing a language or a section", () => {
    const noPl = { ...makeCard(), breakdown: { mars_jezero: { ...entry, utility: { en: ["u"] } } } };
    expect(() => parseDeckFile({ cards: [noPl] })).toThrow(/bad breakdown for mars_jezero/);
    const noSection = { ...makeCard(), breakdown: { mars_jezero: { matches: entry.matches, breaksDown: entry.breaksDown } } };
    expect(() => parseDeckFile({ cards: [noSection] })).toThrow(DeckFormatError);
  });

  it("breakdownFor returns the target's entry or null", () => {
    const card = makeCard({ breakdown: { mars_jezero: entry } });
    expect(breakdownFor(card, "mars_jezero")).toBe(entry);
    expect(breakdownFor(card, "moon_shackleton")).toBeNull();
  });

  it("the dev fixture validates and has a breakdown for every target", () => {
    const file = parseDeckFile(fixture);
    for (const card of file.cards) {
      for (const t of TARGET_IDS) expect(breakdownFor(card, t)).not.toBeNull();
    }
  });

  it("curated cards validate; Lake Salda is written for Jezero only, LunAres for every target", () => {
    expect(() => parseDeckFile({ cards: CURATED_CARDS })).not.toThrow();
    const salda = CURATED_CARDS.find((c) => c.id === "curated-lake-salda")!;
    expect(Object.keys(salda.breakdown)).toEqual(["mars_jezero"]);
    const lunares = CURATED_CARDS.find((c) => c.id === LUNARES_CARD_ID)!;
    for (const t of TARGET_IDS) expect(breakdownFor(lunares, t)).not.toBeNull();
  });
});
