import { describe, expect, it } from "vitest";
import { DECK_ACTION_REASON_KEY, deckActionState } from "@/lib/deckAction";
import type { ScanGridSample } from "@/lib/scanGrid";
import { userCardId } from "@/lib/userCards";
import { en } from "@/i18n/en";
import { pl } from "@/i18n/pl";

// Synthetic samples: arbitrary test inputs, not data.
const land: ScanGridSample = {
  cellLat: 50.125,
  cellLon: 19.875,
  land: true,
  features: {},
  targets: {
    mars_jezero: { total: 0.4, dims: {}, limiting: null },
    mars_arcadia: { total: null, dims: {}, limiting: null },
  },
};
const ocean: ScanGridSample = { ...land, land: false, targets: {} };
const none = new Set<string>();

describe("deckActionState (map popup / peek bar / inspector)", () => {
  it("scored land cell → add", () => {
    expect(deckActionState(land, "mars_jezero", none, none)).toEqual({ kind: "add" });
  });

  it("keeps every disabled reason", () => {
    expect(deckActionState(null, "mars_jezero", none, none)).toEqual({ kind: "disabled", reason: "noGrid" });
    expect(deckActionState(ocean, "mars_jezero", none, none)).toEqual({ kind: "disabled", reason: "ocean" });
    expect(deckActionState(land, "mars_arcadia", none, none)).toEqual({ kind: "disabled", reason: "unscored" });
    expect(deckActionState(land, "moon_shackleton", none, none)).toEqual({ kind: "disabled", reason: "unscored" });
  });

  it("already added → inDeck (next card), or inDeck + rejected when the specs reject it", () => {
    const id = userCardId(land);
    expect(deckActionState(land, "mars_jezero", new Set([id]), none)).toEqual({ kind: "inDeck", id, rejected: false });
    expect(deckActionState(land, "mars_jezero", new Set([id]), new Set([id]))).toEqual({ kind: "inDeck", id, rejected: true });
  });

  it("an added cell stays removable even if its target is not scored for the current config", () => {
    const id = userCardId(land);
    expect(deckActionState(land, "mars_arcadia", new Set([id]), none).kind).toBe("inDeck");
  });

  it("a rejected id that is not a user card does not count as in deck", () => {
    expect(deckActionState(land, "mars_jezero", none, new Set([userCardId(land)]))).toEqual({ kind: "add" });
  });

  it("every reason has an EN and PL message", () => {
    for (const key of Object.values(DECK_ACTION_REASON_KEY)) {
      const leaf = (d: unknown) => key.split(".").reduce<unknown>((o, k) => (o as Record<string, unknown>)?.[k], d);
      expect(typeof leaf(en)).toBe("string");
      expect(typeof leaf(pl)).toBe("string");
    }
    expect(en.map.popup.inDeck).toBeTruthy();
    expect(pl.map.popup.inDeck).toBeTruthy();
  });
});
