import { describe, expect, it } from "vitest";
import { rankDeck } from "@/lib/ranking";
import { groupRejections, STRICT_SHARE, strictSpecs } from "@/lib/rejections";
import { config, makeCard, type CardOverrides } from "./helpers";

const card = (id: string, mission: CardOverrides["mission"], regionAreaKm2 = 1000) =>
  makeCard({ id, name: id, mission, regionAreaKm2 });

describe("strictSpecs", () => {
  it("shows the chip only when rejected cards are more than half of all cards", () => {
    expect(strictSpecs(10, 10)).toEqual({ show: false, rejected: 10, total: 20 });
    expect(strictSpecs(9, 11)).toEqual({ show: true, rejected: 11, total: 20 });
    expect(strictSpecs(0, 0).show).toBe(false);
    expect(strictSpecs(0, 3).show).toBe(true);
    expect(STRICT_SHARE).toBe(0.5);
  });
});

describe("groupRejections", () => {
  it("groups by failing constraint, counts, and sorts largest group first", () => {
    const cfg = config({ mobility: "heavy", footprint: "compact", crew: "robotic" });
    const cards = [
      card("steep-1", { trafficableFrac: 0.05 }), // 50 km² usable: fits a compact base
      card("steep-2", { trafficableFrac: 0.1 }),
      card("steep-3", { trafficableFrac: 0.15 }),
      card("small-1", { trafficableFrac: 0.9 }, 1), // 0.9 km² < compact 2 km²
      card("ok", { trafficableFrac: 0.9 }),
    ];
    const { rejected } = rankDeck(cards, cfg);
    const groups = groupRejections(rejected, cfg);
    expect(groups.map((g) => [g.id, g.cards.length])).toEqual([
      ["trafficability", 3],
      ["footprint", 1],
    ]);
    expect(groups[1].cards.map((c) => c.card.id)).toEqual(["small-1"]);
    expect(groups.flatMap((g) => g.cards.map((c) => c.card.id))).not.toContain("ok");
  });

  it("counts a card in every group it fails", () => {
    const cfg = config({ mobility: "heavy", footprint: "mega", crew: "robotic" });
    const { rejected } = rankDeck([card("both", { trafficableFrac: 0.05 })], cfg);
    const ids = groupRejections(rejected, cfg).map((g) => g.id).sort();
    expect(ids).toEqual(["footprint", "trafficability"]);
  });

  it("states the rule and which option relaxes it", () => {
    const cfg = config({ mobility: "heavy", footprint: "mega", crew: "permanent", target: "moon_shackleton" });
    const { rejected } = rankDeck([card("x", { trafficableFrac: 0.05, iceProxy: 0.1 })], cfg);
    const byId = Object.fromEntries(groupRejections(rejected, cfg).map((g) => [g.id, g]));

    expect(byId.trafficability.rule).toEqual({ key: "deck.strict.rule.trafficability", params: { minPct: 20 } });
    expect(byId.trafficability.relax?.key).toBe("deck.strict.relax.mobility");
    expect(byId.trafficability.relax?.labelParams?.option).toBe("options.mobility.climber.label");

    expect(byId.footprint.rule.labelParams?.base).toBe("options.footprint.mega.label");
    expect(byId.footprint.relax?.labelParams?.option).toBe("options.footprint.medium.label");
    expect(byId.footprint.relax?.params?.minKm2).toBe(10);

    expect(byId.resource.rule.key).toBe("deck.strict.rule.ice");
    expect(byId.resource.relax?.labelParams?.option).toBe("options.crew.short.label");
  });

  it("has no footprint relaxation for the smallest base", () => {
    const cfg = config({ mobility: "climber", footprint: "compact", crew: "robotic" });
    const { rejected } = rankDeck([card("tiny", { trafficableFrac: 0.01 }, 100)], cfg); // 1 km² < 2 km²
    const [g] = groupRejections(rejected, cfg);
    expect(g.id).toBe("footprint");
    expect(g.relax).toBeNull();
  });

  it("uses the basalt rule for a lava-tube target", () => {
    const cfg = config({ target: "moon_tranquillitatis_pit", crew: "permanent", mobility: "climber", footprint: "compact" });
    const { rejected } = rankDeck([card("no-basalt", { basaltFrac: 0.1 })], cfg);
    expect(groupRejections(rejected, cfg)[0].rule.key).toBe("deck.strict.rule.basalt");
  });

  it("returns nothing for an empty pile", () => {
    expect(groupRejections([], config())).toEqual([]);
  });
});
