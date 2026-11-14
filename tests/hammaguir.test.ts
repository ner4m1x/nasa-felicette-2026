import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import { HAMMAGUIR_BASE, HAMMAGUIR_CARD_ID } from "@/data/curatedCards";
import { getSource } from "@/data/sources";
import { withGridCards } from "@/lib/deck";
import { cardFromGridCell } from "@/lib/gridCard";
import { applyPinned, rankDeck } from "@/lib/ranking";
import { decodeScanGrid, parseScanGridMeta } from "@/lib/scanGrid";
import type { RankedCard } from "@/lib/types";
import { config as makeConfig, makeCard } from "./helpers";

const read = (f: string) => readFileSync(new URL(`../public/data/${f}`, import.meta.url));
const meta = parseScanGridMeta(JSON.parse(read("scan_grid_meta.json").toString("utf8")))!;
const grid = decodeScanGrid(meta, new Uint8Array(gunzipSync(read("scan_grid.bin.gz"))));

describe("Hammaguir card (built from the published scan grid)", () => {
  const card = cardFromGridCell(grid, HAMMAGUIR_BASE)!;

  it("takes every score from the grid cell, with a percentile in 0..100", () => {
    expect(card).not.toBeNull();
    expect(card.id).toBe(HAMMAGUIR_CARD_ID);
    expect(card.kind).toBe("curated");
    const sample = grid.sample(HAMMAGUIR_BASE.lat, HAMMAGUIR_BASE.lon);
    const j = card.analog!.mars_jezero!;
    expect(j.total).toBe(sample.targets.mars_jezero!.total);
    expect(j.percentile).toBeGreaterThanOrEqual(0);
    expect(j.percentile).toBeLessThanOrEqual(100);
    console.info(`Hammaguir mars_jezero: total=${j.total.toFixed(3)} percentile=${j.percentile.toFixed(2)} limiting=${j.limiting}`);
  });

  it("cites sources that exist", () => {
    for (const id of card.sourceIds) expect(getSource(id), id).not.toBeNull();
  });

  it("is the 2nd card of the mars_jezero deck", () => {
    const others = Array.from({ length: 6 }, (_, i) => makeCard({ id: `c${i}` }));
    const deck = rankDeck(withGridCards(others, grid), makeConfig({ target: "mars_jezero" })).deck;
    expect(deck[1].card.id).toBe(HAMMAGUIR_CARD_ID);
  });

  it("is not pinned for other targets", () => {
    const others = Array.from({ length: 6 }, (_, i) => makeCard({ id: `c${i}` }));
    const deck = rankDeck(withGridCards(others, grid), makeConfig({ target: "moon_shackleton" })).deck;
    expect(deck.some((r) => r.card.id === HAMMAGUIR_CARD_ID)).toBe(true);
  });

  it("withGridCards does not duplicate an existing card", () => {
    expect(withGridCards([card], grid).filter((c) => c.id === HAMMAGUIR_CARD_ID)).toHaveLength(1);
  });
});

describe("applyPinned", () => {
  const r = (id: string) => ({ card: { id } }) as RankedCard;
  it("moves a card to its position and clamps to the deck length", () => {
    expect(applyPinned([r("a"), r("b"), r("x")], [{ id: "x", position: 2 }]).map((c) => c.card.id)).toEqual(["a", "x", "b"]);
    expect(applyPinned([r("x")], [{ id: "x", position: 2 }]).map((c) => c.card.id)).toEqual(["x"]);
    expect(applyPinned([r("a")], [{ id: "x", position: 2 }]).map((c) => c.card.id)).toEqual(["a"]);
  });
});

describe("ScanGrid.percentile", () => {
  it("is null on cells without a score and within 0..100 elsewhere", () => {
    expect(grid.percentile("mars_jezero", 0, -30)).toBeNull(); // mid-Atlantic
    const p = grid.percentile("mars_jezero", 23.4, 25.6); // Sahara
    expect(p).not.toBeNull();
    expect(p!).toBeGreaterThan(0);
    expect(p!).toBeLessThanOrEqual(100);
  });
});
