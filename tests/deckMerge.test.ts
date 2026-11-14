import { describe, expect, it } from "vitest";
import { CURATED_CARDS } from "@/data/curatedCards";
import { mergeCurated } from "@/lib/deck";
import { TARGET_IDS, type AnalogEntry, type DeckCard, type TargetBreakdown } from "@/lib/types";
import { makeCard } from "./helpers";

const CURATED_ID = "curated-central-amazon";
const PIPELINE_ID = "site-central-amazon";
const curated = CURATED_CARDS.find((c) => c.id === CURATED_ID)!;

const bd = (tag: string): TargetBreakdown => ({
  matches: { en: [`${tag} match en`], pl: [`${tag} match pl`] },
  breaksDown: { en: [`${tag} breaks en`], pl: [`${tag} breaks pl`] },
  utility: { en: [`${tag} utility en`], pl: [`${tag} utility pl`] },
});

/** Synthetic pipeline card for the same site. Values are arbitrary test inputs, not data. */
const entry: AnalogEntry = { total: 0.3, dims: { a: 0.3 }, limiting: "a", percentile: 12 };
const pipelineCard: DeckCard = makeCard({
  id: PIPELINE_ID,
  kind: "trap",
  name: "Central Amazon (pipeline)",
  regionAreaKm2: 1234,
  stability: 0.7,
  analog: { mars_jezero: entry },
  mission: { slopeMeanDeg: 1, trafficableFrac: 0.42, reliefStdM: 11, iceProxy: 0, basaltFrac: 0.1 },
  breakdown: { mars_jezero: bd("PIPE") },
  sourceIds: ["pipeline-src"],
});
const other = makeCard({ id: "site-other", name: "OTHER" });

describe("mergeCurated: curated + pipeline card for the same site", () => {
  it("curated cards link to the expected pipeline ids", () => {
    const links = Object.fromEntries(CURATED_CARDS.filter((c) => c.pipelineSiteId).map((c) => [c.id, c.pipelineSiteId]));
    expect(links).toEqual({ "curated-central-amazon": "site-central-amazon", "curated-ostrzyca": "site-ostrzyca" });
  });

  it("keeps one card with curated identity/narrative and pipeline numbers", () => {
    const deck = mergeCurated([other, pipelineCard]);
    expect(deck.find((c) => c.id === PIPELINE_ID)).toBeUndefined();
    const merged = deck.filter((c) => c.id === CURATED_ID);
    expect(merged).toHaveLength(1);
    const m = merged[0];

    expect(m.kind).toBe(curated.kind);
    expect(m.name).toBe(curated.name);
    expect(m.lat).toBe(curated.lat);
    expect(m.analog).toEqual(pipelineCard.analog);
    expect(m.mission).toEqual(pipelineCard.mission);
    expect(m.stability).toBe(0.7);
    expect(m.regionAreaKm2).toBe(1234);
    expect(m.sourceIds).toEqual(expect.arrayContaining([...curated.sourceIds, "pipeline-src"]));

    // curated text first, then the pipeline's generated lines, per section and language
    const cj = curated.breakdown.mars_jezero!;
    for (const s of ["matches", "breaksDown", "utility"] as const) {
      for (const lang of ["en", "pl"] as const) {
        expect(m.breakdown.mars_jezero![s][lang]).toEqual([...cj[s][lang], ...pipelineCard.breakdown.mars_jezero![s][lang]]);
      }
    }
    // targets the pipeline did not score keep the curated text unchanged
    for (const t of TARGET_IDS.filter((t) => t !== "mars_jezero")) {
      expect(m.breakdown[t]).toEqual(curated.breakdown[t]);
    }
    // takes the pipeline card's place in the order, other cards untouched
    expect(deck[0]).toBe(other);
    expect(deck[1].id).toBe(CURATED_ID);
    // every other curated card is still appended once
    for (const c of CURATED_CARDS) expect(deck.filter((d) => d.id === c.id)).toHaveLength(1);
  });

  it("does not mutate the curated input", () => {
    const before = structuredClone(curated);
    mergeCurated([pipelineCard]);
    expect(curated).toEqual(before);
  });

  it("pipeline card absent: curated card is appended unchanged", () => {
    const deck = mergeCurated([other]);
    expect(deck.find((c) => c.id === CURATED_ID)).toBe(curated);
    expect(deck).toHaveLength(1 + CURATED_CARDS.length);
  });

  it("curated card absent: pipeline card is kept as-is", () => {
    const deck = mergeCurated([other, pipelineCard], CURATED_CARDS.filter((c) => c.id !== CURATED_ID));
    expect(deck.find((c) => c.id === PIPELINE_ID)).toBe(pipelineCard);
    expect(deck.find((c) => c.id === CURATED_ID)).toBeUndefined();
  });
});
