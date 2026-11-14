import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import { footprintFactor } from "@/lib/missionFit";
import { rankCard } from "@/lib/ranking";
import { FOOTPRINT_IDS } from "@/lib/types";
import { decodeScanGrid, parseScanGridMeta } from "@/lib/scanGrid";
import { agreementScore, felicetteVerdict } from "@/lib/verdict";
import {
  addUserCard,
  breakdownFromSample,
  canAddUserCard,
  createUserCard,
  readUserCards,
  removeUserCard,
  USER_CARDS_STORAGE_KEY,
  userCardName,
  writeUserCards,
} from "@/lib/userCards";
import { config, makeCard } from "./helpers";

const read = (f: string) => readFileSync(new URL(`../public/data/${f}`, import.meta.url));
const meta = parseScanGridMeta(JSON.parse(read("scan_grid_meta.json").toString("utf8")))!;
const grid = decodeScanGrid(meta, new Uint8Array(gunzipSync(read("scan_grid.bin.gz"))));

// A Sahara land point and a mid-Atlantic ocean point (test inputs, not data claims).
const LAND = { lat: 23.4, lon: 25.6 };
const OCEAN = { lat: 0, lon: -30 };

class MemoryStorage {
  map = new Map<string, string>();
  getItem(k: string) {
    return this.map.get(k) ?? null;
  }
  setItem(k: string, v: string) {
    this.map.set(k, v);
  }
}

describe("createUserCard (from a grid cell)", () => {
  const card = createUserCard(grid, LAND.lat, LAND.lon, [])!;
  const sample = grid.sample(LAND.lat, LAND.lon);

  it("takes kind, scale, area and every score from the grid cell", () => {
    expect(card.kind).toBe("user");
    expect(card.scale).toBe("site");
    expect(card.regionAreaKm2).toBeNull();
    expect(card.id.startsWith("user:")).toBe(true);
    for (const [t, s] of Object.entries(sample.targets)) {
      if (s?.total === null || s === undefined) continue;
      expect(card.analog![t as keyof typeof sample.targets]!.total).toBe(s.total);
    }
    expect(card.mission.reliefStdM).toBe(sample.features.relief_std_m.value);
    expect(card.ndviImputed).toBe(sample.ndviImputed === true);
  });

  it("generates an EN/PL breakdown per scored target with the pipeline templates", () => {
    const b = card.breakdown.mars_jezero!;
    expect(b.matches.en.length).toBeGreaterThanOrEqual(2);
    expect(b.matches.en[0]).toMatch(/\(dimension score \d\.\d\d\)$/);
    expect(b.matches.pl[0]).toMatch(/\(wynik wymiaru \d\.\d\d\)$/);
    expect(b.breaksDown.en[0]).toMatch(/^Limiting factor, /);
    expect(b.breaksDown.en.some((l) => l.startsWith("Not visible to the global scan: "))).toBe(true);
    expect(b.utility.en.length).toBeGreaterThan(0);
    expect(b.utility.pl.length).toBe(b.utility.en.length);
  });

  it("returns null for an ocean cell and no breakdown for unscored targets", () => {
    expect(createUserCard(grid, OCEAN.lat, OCEAN.lon, [])).toBeNull();
    const fake = { ...sample, targets: { mars_jezero: { total: null, dims: {}, limiting: null } } };
    expect(breakdownFromSample(fake, "mars_jezero")).toBeNull();
  });

  it("names the card after the nearest region within ~150 km, else by coordinates", () => {
    const near = makeCard({ id: "r1", name: "Near Region", lat: LAND.lat + 0.5, lon: LAND.lon, scale: "regional" });
    const far = makeCard({ id: "r2", name: "Far Region", lat: LAND.lat + 5, lon: LAND.lon, scale: "regional" });
    expect(userCardName(LAND.lat, LAND.lon, [far, near])).toBe("Near Region");
    expect(userCardName(LAND.lat, LAND.lon, [far])).toBe("Your scan @ 23.40°N, 25.60°E");
  });
});

describe("add button state", () => {
  it("is disabled with a reason for ocean, missing grid, unscored target or duplicates", () => {
    expect(canAddUserCard(grid.sample(OCEAN.lat, OCEAN.lon), "mars_jezero", new Set())).toEqual({ ok: false, reason: "ocean" });
    expect(canAddUserCard(null, "mars_jezero", new Set())).toEqual({ ok: false, reason: "noGrid" });
    const land = grid.sample(LAND.lat, LAND.lon);
    expect(canAddUserCard(land, "mars_jezero", new Set())).toEqual({ ok: true });
    const id = createUserCard(grid, LAND.lat, LAND.lon, [])!.id;
    expect(canAddUserCard(land, "mars_jezero", new Set([id]))).toEqual({ ok: false, reason: "duplicate" });
    const unscored = { ...land, targets: {} };
    expect(canAddUserCard(unscored, "mars_jezero", new Set())).toEqual({ ok: false, reason: "unscored" });
  });
});

describe("persistence and removal (per mission)", () => {
  const card = createUserCard(grid, LAND.lat, LAND.lon, [])!;

  it("round-trips through storage, keyed by mission", () => {
    const storage = new MemoryStorage();
    const all = addUserCard({}, "m1", card);
    writeUserCards(storage, all);
    const back = readUserCards(storage);
    expect(back.m1).toHaveLength(1);
    expect(back.m1[0]).toEqual(card);
    expect(back.m2).toBeUndefined();
  });

  it("ignores broken storage and invalid entries", () => {
    const storage = new MemoryStorage();
    storage.setItem(USER_CARDS_STORAGE_KEY, "{not json");
    expect(readUserCards(storage)).toEqual({});
    storage.setItem(USER_CARDS_STORAGE_KEY, JSON.stringify({ m1: [{ id: "x", kind: "discovery" }, card] }));
    expect(readUserCards(storage).m1).toHaveLength(1);
    const throwing = {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("blocked");
      },
    };
    expect(readUserCards(throwing)).toEqual({});
    expect(() => writeUserCards(throwing, { m1: [card] })).not.toThrow();
  });

  it("adds without duplicates and removes by id", () => {
    let all = addUserCard({}, "m1", card);
    all = addUserCard(all, "m1", card);
    expect(all.m1).toHaveLength(1);
    all = removeUserCard(all, "m1", card.id);
    expect(all.m1).toHaveLength(0);
  });
});

describe("Félicette and mission fit on user cards", () => {
  const card = createUserCard(grid, LAND.lat, LAND.lon, [])!;
  const cfg = config({ target: "mars_jezero" });

  it("she abstains, so user cards never count toward agreement", () => {
    const ranked = rankCard(card, cfg)!;
    const v = felicetteVerdict(ranked, cfg);
    expect(v.recommendation).toBe("abstain");
    const records = [
      { cardId: card.id, verdict: "purr" as const, recommendation: v.recommendation },
      { cardId: "other", verdict: "purr" as const, recommendation: "purr" as const },
    ];
    expect(agreementScore(records)).toEqual({ agreed: 1, counted: 1, ratio: 1 });
  });

  it("footprint is unverified (site-scale)", () => {
    for (const footprint of FOOTPRINT_IDS) {
      const r = footprintFactor(card, { ...cfg, footprint });
      expect(r.factor).toBe(1);
      expect(r.failed).toHaveLength(0);
      expect(r.notes.map((n) => n.key)).toEqual(["fit.note.footprintUserSite"]);
    }
  });
});
