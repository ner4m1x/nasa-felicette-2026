import { describe, expect, it } from "vitest";
import { en } from "@/i18n/en";
import { pl } from "@/i18n/pl";
import { translate } from "@/i18n/I18nProvider";
import type { Dictionary, Lang } from "@/i18n/types";
import { ASK_QUESTIONS, askAnswer, currentQuestion, type AskContext, type AskFormat } from "@/lib/askFelicette";
import { parseManifest } from "@/lib/manifest";
import { comparisonRows } from "@/lib/planetaryComparison";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { rankCard } from "@/lib/ranking";
import type { DeckCard, RankedCard, TargetId } from "@/lib/types";
import { config, makeCard } from "./helpers";

const DICTS: Record<Lang, Dictionary> = { en, pl };

function fmt(lang: Lang = "en"): AskFormat {
  return {
    t: (key, params) => translate(DICTS[lang], key, params),
    dim: (id) => ({ sci: `DIM:${id}`, cat: null, short: id }),
    lang,
    planetValue: (ref) => `PLANET:${ref.id}`,
    earthValue: (e) => (e.kind === "value" ? `EARTH:${e.value}` : `EARTH:${e.kind}`),
  };
}

const TARGET: TargetId = "mars_jezero";

/** Synthetic card: numbers are test inputs chosen to be easy to spot in the answers. */
function card(over: Partial<DeckCard> = {}): DeckCard {
  return makeCard({
    id: "c1",
    name: "Testland Basin",
    country: "Testonia",
    lat: 12.34,
    lon: -56.78,
    regionAreaKm2: 4321,
    analog: {
      mars_jezero: { total: 0.73, dims: { aridity: 0.91, relief: 0.42 }, limiting: "relief", percentile: 88.4 },
      moon_shackleton: { total: 0.21, dims: { x: 0.21 }, limiting: "x", percentile: 30 },
    },
    stability: 0.67,
    known: true,
    sourceIds: ["nssdc-moon-factsheet"],
    breakdown: {
      mars_jezero: {
        matches: { en: ["M-en"], pl: ["M-pl"] },
        breaksDown: { en: ["B1-en.", "B2-en.", "B3-en.", "B4-en."], pl: ["B1-pl."] },
        utility: { en: ["U1-en."], pl: ["U1-pl."] },
      },
    },
    ...over,
  });
}

function ctx(c: DeckCard = card(), rows: AskContext["rows"] = []): AskContext {
  const ranked = rankCard(c, config({ target: TARGET })) as RankedCard;
  return { ranked, target: TARGET, rows };
}

describe("Ask Félicette answers (scripted, from card data only)", () => {
  it("why: analog score, percentile, limiting dimension and mission fit from the card", () => {
    const c = ctx();
    const a = askAnswer("why", c, fmt());
    expect(a).toContain("Analog score 73/100");
    expect(a).toContain("percentile 88.4 among land cells");
    expect(a).toContain("DIM:relief at 42/100");
    expect(a).toContain(`Mission fit ${Math.round(c.ranked.missionFit.fit * 100)}/100.`);
  });

  it("why: says so when the card has no Analog Score for the target", () => {
    const a = askAnswer("why", ctx(card({ analog: null })), fmt());
    expect(a).toContain("No Analog Score for");
    expect(a).not.toContain("DIM:");
  });

  it("breaks / test: the target's breakdown lines in the UI language, capped, with a 'more' note", () => {
    const en1 = askAnswer("breaks", ctx(), fmt("en"));
    expect(en1).toContain("B1-en. B2-en. B3-en.");
    expect(en1).not.toContain("B4-en.");
    expect(en1).toContain("(+1 more in the breakdown)");
    expect(askAnswer("breaks", ctx(), fmt("pl"))).toContain("B1-pl.");
    expect(askAnswer("test", ctx(), fmt("en"))).toContain("U1-en.");
  });

  it("breaks / test: no breakdown for the target → the existing 'no breakdown' line, nothing invented", () => {
    const c = ctx(card({ breakdown: {} }));
    const noTarget = translate(en, "breakdown.noTarget", { target: en.targets.mars_jezero.label });
    expect(askAnswer("test", c, fmt())).toBe(noTarget);
    expect(askAnswer("breaks", c, fmt())).toContain(noTarget);
  });

  it("compare: analog per target from the card, and the planetary comparison rows", () => {
    const loading = askAnswer("compare", ctx(card(), null), fmt());
    expect(loading).toContain("Shackleton 21");
    expect(loading).toContain("Jezero 73");
    expect(loading).toContain(en.ask.a.gridLoading);

    const rows = comparisonRows(TARGET, null); // no grid sample: Earth values pending / invisible
    const a = askAnswer("compare", ctx(card(), rows), fmt());
    const invisible = rows.filter((r) => r.earth.kind === "invisible");
    if (invisible.length) expect(a).toContain("Earth's global data can't see");

    const measured = [{ ...rows[0], earth: { kind: "value" as const, value: 42, unit: "°C" } }];
    const b = askAnswer("compare", ctx(card(), measured), fmt());
    expect(b).toContain(`PLANET:${rows[0].ref.id} on Mars vs EARTH:42 here.`);
  });

  it("place: name, coordinates, area, terrain, stability and sources from the card", () => {
    const a = askAnswer("place", ctx(), fmt());
    for (const s of ["Testland Basin", "Testonia", "12.34°N 56.78°W", "4,321 km²", "mean slope 2°", "90% trafficable", "relief σ 20 m", "67%", "Sources (1): Moon Fact Sheet"]) {
      expect(a).toContain(s);
    }
    const bare = askAnswer("place", ctx(card({ sourceIds: [], stability: null, known: false })), fmt());
    expect(bare).toContain(en.ask.a.noSources);
    expect(bare).not.toContain("sensitivity runs");
  });

  it("place: dataset sources are named from the published manifest, unknown ids stay as they are", () => {
    const manifest = parseManifest(JSON.parse(readFileSync(join(__dirname, "..", "public", "data", "manifest.json"), "utf8")))!;
    const [id, ds] = Object.entries(manifest.datasets)[0];
    const c = { ...ctx(card({ sourceIds: [id, "no-such-source"] })), manifest };
    expect(askAnswer("place", c, fmt())).toContain(`Sources (2): ${ds.shortName}; no-such-source.`);
  });

  it("place: more than three sources → the first three and a count", () => {
    const a = askAnswer("place", ctx(card({ sourceIds: ["s1", "s2", "s3", "s4", "s5"] })), fmt());
    expect(a).toContain("Sources (5): s1; s2; s3; +2.");
  });

  it("breaks: each breakdown fragment is closed as a sentence", () => {
    const c = ctx(card({ breakdown: { mars_jezero: { matches: { en: [], pl: [] }, breaksDown: { en: ["No full stop"], pl: [] }, utility: { en: [], pl: [] } } } }));
    expect(askAnswer("breaks", c, fmt())).toBe("Where it breaks: No full stop.");
  });

  it("every question, both languages: no unfilled placeholder or raw key", () => {
    for (const lang of ["en", "pl"] as const) {
      for (const q of ASK_QUESTIONS) {
        const a = askAnswer(q, ctx(card(), comparisonRows(TARGET, null)), fmt(lang));
        expect(a.length).toBeGreaterThan(10);
        expect(a).not.toMatch(/\{\w+\}/);
        expect(a).not.toMatch(/\bask\.[aq]\./);
      }
    }
  });

  it("the answer resets when the top card changes", () => {
    expect(currentQuestion({ cardId: "c1", q: "why" }, "c1")).toBe("why");
    expect(currentQuestion({ cardId: "c1", q: "why" }, "c2")).toBeNull();
    expect(currentQuestion({ cardId: "c1", q: "why" }, null)).toBeNull();
    expect(currentQuestion(null, "c1")).toBeNull();
  });

  it("has the five chips and the scripted-answers caption in EN and PL", () => {
    expect(Object.keys(en.ask.q)).toEqual([...ASK_QUESTIONS]);
    expect(Object.keys(pl.ask.q)).toEqual([...ASK_QUESTIONS]);
    expect(en.ask.caption).toBe("Scripted answers from this card's data – an LLM version is planned.");
  });
});
