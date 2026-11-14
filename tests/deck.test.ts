import { afterEach, describe, expect, it, vi } from "vitest";
import fixture from "@/data/fixtures/deck.dev.json";
import { CURATED_CARDS } from "@/data/curatedCards";
import {
  DeckFormatError,
  FixtureInProductionError,
  loadDeck,
  loadFixtureDeck,
  mergeCurated,
  parseDeckFile,
} from "@/lib/deck";
import { makeCard } from "./helpers";

const notFound = (() => Promise.resolve(new Response("not found", { status: 404 }))) as typeof fetch;
const networkError = (() => Promise.reject(new TypeError("fetch failed"))) as typeof fetch;
const serve = (body: unknown) => (() => Promise.resolve(Response.json(body))) as typeof fetch;

afterEach(() => vi.unstubAllEnvs());

describe("fixture file", () => {
  it("is unmistakable: __fixture flag, FIXTURE names, flat 0.5 scores", () => {
    expect(fixture.__fixture).toBe(true);
    const file = parseDeckFile(fixture);
    for (const card of file.cards) {
      expect(card.name).toMatch(/^FIXTURE SITE [A-Z]$/);
      for (const e of Object.values(card.analog ?? {})) {
        expect(e!.total).toBe(0.5);
        for (const d of Object.values(e!.dims)) expect(d).toBe(0.5);
      }
    }
  });
});

describe("production fixture guard", () => {
  it("loadFixtureDeck throws in production (explicit env)", async () => {
    await expect(loadFixtureDeck("production")).rejects.toBeInstanceOf(FixtureInProductionError);
  });

  it("loadFixtureDeck throws when NODE_ENV=production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    await expect(loadFixtureDeck()).rejects.toBeInstanceOf(FixtureInProductionError);
  });

  it("refuses a deck.json marked __fixture in production", async () => {
    await expect(loadDeck({ fetchImpl: serve(fixture), nodeEnv: "production" })).rejects.toBeInstanceOf(
      FixtureInProductionError,
    );
  });

  it.each([
    ["404", notFound],
    ["network error", networkError],
  ])("production with missing deck.json (%s) → curated cards only + notice, no fixture", async (_, fetchImpl) => {
    const r = await loadDeck({ fetchImpl, nodeEnv: "production" });
    expect(r.source).toBe("curated-only");
    expect(r.isFixture).toBe(false);
    expect(r.notice).toBe("deck.scanNotPublished");
    expect(r.cards.map((c) => c.id)).toEqual(CURATED_CARDS.map((c) => c.id));
    expect(r.cards.some((c) => c.name.startsWith("FIXTURE"))).toBe(false);
  });
});

describe("loadDeck", () => {
  it("dev with missing deck.json → fixture + curated, flagged as fixture", async () => {
    const r = await loadDeck({ fetchImpl: notFound, nodeEnv: "development" });
    expect(r.source).toBe("fixture");
    expect(r.isFixture).toBe(true);
    expect(r.cards).toHaveLength(fixture.cards.length + CURATED_CARDS.length);
  });

  it("pipeline deck.json → merged with curated cards, not a fixture", async () => {
    const r = await loadDeck({ fetchImpl: serve({ cards: [makeCard({ id: "p1" })] }), nodeEnv: "production" });
    expect(r.source).toBe("pipeline");
    expect(r.isFixture).toBe(false);
    expect(r.cards.map((c) => c.id)).toEqual(["p1", ...CURATED_CARDS.map((c) => c.id)]);
  });

  it("rejects a malformed deck.json", async () => {
    await expect(loadDeck({ fetchImpl: serve({ cards: [{ id: "x" }] }) })).rejects.toBeInstanceOf(DeckFormatError);
    expect(() => parseDeckFile({ nope: true })).toThrow(DeckFormatError);
  });

  it("does not duplicate a curated card the pipeline also exports", () => {
    const dup = { ...CURATED_CARDS[0] };
    expect(mergeCurated([dup]).filter((c) => c.id === dup.id)).toHaveLength(1);
  });
});
