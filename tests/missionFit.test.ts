import { describe, expect, it } from "vitest";
import {
  CLIMBER_BASE_FACTOR,
  CLIMBER_RELIEF_FULL_BONUS_M,
  HEAVY_TRAFFICABLE_FAIL,
  HEAVY_TRAFFICABLE_FULL,
  PERMANENT_BASALT_FRAC_MIN,
  PERMANENT_ICE_PROXY_MIN,
  hasHardFail,
  missionFit,
} from "@/lib/missionFit";
import { CURATED_CARDS, LUNARES_CARD_ID } from "@/data/curatedCards";
import { MEDIUM_FULL_KM2, MEDIUM_MIN_KM2, MEGA_MIN_KM2 } from "@/data/missionOptions";
import type { TargetId } from "@/lib/types";
import { allConfigs, config, makeCard } from "./helpers";

const steps = (n: number) => Array.from({ length: n + 1 }, (_, i) => i / n);

describe("missionFit — heavy rovers / trafficability", () => {
  it("is monotonically non-decreasing in trafficableFrac", () => {
    const fits = steps(50).map(
      (f) => missionFit(makeCard({ mission: { trafficableFrac: f }, regionAreaKm2: 1e6 }), config()).fit,
    );
    for (let i = 1; i < fits.length; i++) expect(fits[i]).toBeGreaterThanOrEqual(fits[i - 1]);
  });

  it("hard-fails below the fail threshold, with a reason", () => {
    const r = missionFit(makeCard({ mission: { trafficableFrac: HEAVY_TRAFFICABLE_FAIL - 0.01 } }), config());
    expect(r.fit).toBe(0);
    expect(hasHardFail(r)).toBe(true);
    const c = r.failed.find((x) => x.id === "trafficability")!;
    expect(c.reasonKey).toBe("fit.constraint.trafficabilityFail");
    expect(c.params).toMatchObject({ pct: 19, minPct: 20, fullPct: 60 });
  });

  it("gives full credit at the full threshold and a soft penalty between thresholds", () => {
    const full = missionFit(makeCard({ mission: { trafficableFrac: HEAVY_TRAFFICABLE_FULL } }), config());
    expect(full.failed).toEqual([]);
    expect(full.fit).toBe(1);
    const mid = missionFit(makeCard({ mission: { trafficableFrac: 0.34 } }), config());
    expect(hasHardFail(mid)).toBe(false);
    expect(mid.fit).toBeGreaterThan(0);
    expect(mid.fit).toBeLessThan(1);
    expect(mid.failed[0]).toMatchObject({ id: "trafficability", hard: false, params: { pct: 34 } });
  });

  it("does not fail on unmeasured trafficability, but notes it", () => {
    const r = missionFit(makeCard({ mission: { trafficableFrac: null } }), config());
    expect(hasHardFail(r)).toBe(false);
    expect(r.notes.map((n) => n.key)).toContain("fit.note.trafficabilityUnknown");
  });
});

describe("missionFit — climber", () => {
  it("never penalises slopes / low trafficability", () => {
    const r = missionFit(
      makeCard({ mission: { trafficableFrac: 0.01, slopeMeanDeg: 30 }, regionAreaKm2: 1e6 }),
      config({ mobility: "climber" }),
    );
    expect(r.failed.filter((c) => c.id === "trafficability")).toEqual([]);
  });

  it("adds a small, monotonic bonus for high relief", () => {
    const fits = [0, 50, 100, CLIMBER_RELIEF_FULL_BONUS_M, 1000].map(
      (m) => missionFit(makeCard({ mission: { reliefStdM: m } }), config({ mobility: "climber" })).fit,
    );
    for (let i = 1; i < fits.length; i++) expect(fits[i]).toBeGreaterThanOrEqual(fits[i - 1]);
    expect(fits[0]).toBeCloseTo(CLIMBER_BASE_FACTOR);
    expect(fits[3]).toBe(1);
    const r = missionFit(
      makeCard({ mission: { reliefStdM: CLIMBER_RELIEF_FULL_BONUS_M } }),
      config({ mobility: "climber" }),
    );
    expect(r.notes.map((n) => n.key)).toContain("fit.note.reliefBonus");
  });
});

describe("missionFit — footprint", () => {
  const climber = { mobility: "climber" as const };

  it("hard-fails a regional card whose trafficable area is below the footprint minimum", () => {
    // 0.5 × 150 km² = 75 km² < mega minimum
    const card = makeCard({ regionAreaKm2: 150, mission: { trafficableFrac: 0.5 } });
    const r = missionFit(card, config({ ...climber, footprint: "mega" }));
    expect(r.fit).toBe(0);
    expect(r.failed[0]).toMatchObject({ id: "footprint", hard: true, params: { areaKm2: 75, minKm2: MEGA_MIN_KM2 } });
  });

  it("passes when trafficableFrac × area meets the minimum, with partial credit inside the medium range", () => {
    const at = (km2: number) =>
      missionFit(makeCard({ regionAreaKm2: km2, mission: { trafficableFrac: 1, reliefStdM: 1e4 } }), config({ ...climber }));
    expect(hasHardFail(at(MEDIUM_MIN_KM2 - 1))).toBe(true);
    expect(hasHardFail(at(MEDIUM_MIN_KM2))).toBe(false);
    expect(at(MEDIUM_MIN_KM2).fit).toBeLessThan(at(MEDIUM_FULL_KM2).fit);
    expect(at(MEDIUM_FULL_KM2).fit).toBe(1);
    const fits = [10, 20, 30, 40, 50, 60].map((k) => at(k).fit);
    for (let i = 1; i < fits.length; i++) expect(fits[i]).toBeGreaterThanOrEqual(fits[i - 1]);
  });

  it("compact adds the below-grid-resolution note for regional cards", () => {
    const r = missionFit(makeCard(), config({ footprint: "compact" }));
    expect(r.notes.map((n) => n.key)).toContain("fit.note.footprintBelowGrid");
  });

  it("site cards with compact get no footprint penalty or note", () => {
    const card = makeCard({ scale: "site", regionAreaKm2: 0.1, mission: { trafficableFrac: 0.9 } });
    const r = missionFit(card, config({ footprint: "compact" }));
    expect(r.failed.filter((c) => c.id === "footprint")).toEqual([]);
    expect(r.notes.map((n) => n.key)).not.toContain("fit.note.footprintBelowGrid");
  });
});

describe("missionFit — permanent crew resources", () => {
  const permanent = (target: TargetId) => config({ crew: "permanent", target });

  it.each(["moon_shackleton", "mars_arcadia"] as const)("%s requires the ice proxy", (target) => {
    expect(hasHardFail(missionFit(makeCard({ mission: { iceProxy: null } }), permanent(target)))).toBe(true);
    const low = missionFit(makeCard({ mission: { iceProxy: PERMANENT_ICE_PROXY_MIN - 0.1 } }), permanent(target));
    expect(low.failed[0].reasonKey).toBe("fit.constraint.iceLow");
    expect(hasHardFail(missionFit(makeCard({ mission: { iceProxy: PERMANENT_ICE_PROXY_MIN } }), permanent(target)))).toBe(false);
  });

  it("moon_tranquillitatis_pit requires basalt substrate", () => {
    const missing = missionFit(makeCard({ mission: { basaltFrac: null } }), permanent("moon_tranquillitatis_pit"));
    expect(missing.failed[0]).toMatchObject({ id: "resource", hard: true, reasonKey: "fit.constraint.basaltMissing" });
    const ok = missionFit(makeCard({ mission: { basaltFrac: PERMANENT_BASALT_FRAC_MIN } }), permanent("moon_tranquillitatis_pit"));
    expect(hasHardFail(ok)).toBe(false);
  });

  it("mars_jezero only notes that hydrated minerals are not captured", () => {
    const r = missionFit(makeCard({ mission: { iceProxy: null, basaltFrac: null } }), permanent("mars_jezero"));
    expect(hasHardFail(r)).toBe(false);
    expect(r.notes.map((n) => n.key)).toContain("fit.note.hydratedMineralsNotCaptured");
  });

  it("robotic and short crews have no resource requirement", () => {
    for (const crew of ["robotic", "short"] as const) {
      const r = missionFit(makeCard({ mission: { iceProxy: null } }), config({ crew, target: "moon_shackleton" }));
      expect(r.failed.filter((c) => c.id === "resource")).toEqual([]);
    }
  });
});

describe("missionFit — general", () => {
  it("operational cards skip terrain constraints", () => {
    const lunares = CURATED_CARDS.find((c) => c.id === LUNARES_CARD_ID)!;
    for (const cfg of allConfigs()) {
      const r = missionFit(lunares, cfg);
      expect(r.fit).toBe(1);
      expect(r.notes.map((n) => n.key)).toContain("fit.note.operationalNotGeology");
    }
  });

  it("fit is always in [0, 1] and is 0 exactly when a hard constraint failed", () => {
    const cards = [
      makeCard(),
      makeCard({ mission: { trafficableFrac: 0.1, reliefStdM: null, iceProxy: 0.1 } }),
      makeCard({ scale: "site", regionAreaKm2: null }),
      ...CURATED_CARDS,
    ];
    for (const cfg of allConfigs()) {
      for (const card of cards) {
        const r = missionFit(card, cfg);
        expect(r.fit).toBeGreaterThanOrEqual(0);
        expect(r.fit).toBeLessThanOrEqual(1);
        expect(r.fit === 0).toBe(hasHardFail(r));
      }
    }
  });
});
