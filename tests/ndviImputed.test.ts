import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { NdviImputedNote } from "@/components/swipe/NdviImputedNote";
import { en } from "@/i18n/en";
import { pl } from "@/i18n/pl";
import { DeckFormatError, mergeCuratedWithPipeline, parseDeckFile } from "@/lib/deck";
import { makeCard } from "./helpers";

describe("ndviImputed (deck.schema.json)", () => {
  it("is optional and accepts a boolean", () => {
    expect(() => parseDeckFile({ cards: [makeCard()] })).not.toThrow();
    const file = parseDeckFile({ cards: [makeCard({ ndviImputed: true }), makeCard({ id: "b", ndviImputed: false })] });
    expect(file.cards.map((c) => c.ndviImputed)).toEqual([true, false]);
  });

  it("rejects a non-boolean value", () => {
    const bad = { ...makeCard(), ndviImputed: "yes" };
    expect(() => parseDeckFile({ cards: [bad] })).toThrow(DeckFormatError);
    expect(() => parseDeckFile({ cards: [bad] })).toThrow(/bad ndviImputed/);
  });

  it("a merged curated card takes the flag from the pipeline card", () => {
    const curated = makeCard({ id: "curated", kind: "curated" });
    expect(mergeCuratedWithPipeline(curated, makeCard({ id: "site-x", ndviImputed: true })).ndviImputed).toBe(true);
    expect("ndviImputed" in mergeCuratedWithPipeline(curated, makeCard({ id: "site-x" }))).toBe(false);
  });

  it("has the note in EN and PL", () => {
    expect(en.card.ndviImputed).toMatch(/NDVI imputed.*MODIS/);
    expect(pl.card.ndviImputed).toMatch(/NDVI imputowane.*MODIS/);
  });
});

describe("NdviImputedNote", () => {
  const render = (imputed: boolean | undefined) =>
    renderToStaticMarkup(createElement(NdviImputedNote, { imputed, label: en.card.ndviImputed }));

  it("renders the note only when imputed is true", () => {
    const html = render(true);
    expect(html).toContain('data-testid="ndvi-imputed-note"');
    expect(html).toContain("NDVI imputed");
    expect(render(false)).toBe("");
    expect(render(undefined)).toBe("");
  });
});
