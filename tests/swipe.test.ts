import { describe, expect, it } from "vitest";
import { swipeDecision } from "@/lib/swipe";

const T = { offsetFraction: 0.3, velocityPxPerS: 500, minFlickOffsetPx: 30 };
const W = 400; // card width → offset threshold 120 px

describe("swipeDecision", () => {
  it("springs back for small, slow drags", () => {
    expect(swipeDecision(0, 0, W, T)).toBeNull();
    expect(swipeDecision(80, 100, W, T)).toBeNull();
    expect(swipeDecision(-80, -100, W, T)).toBeNull();
  });

  it("commits on offset alone (right = PURR, left = HISS)", () => {
    expect(swipeDecision(130, 0, W, T)).toBe("purr");
    expect(swipeDecision(-130, 0, W, T)).toBe("hiss");
  });

  it("commits on a fast flick in the drag direction", () => {
    expect(swipeDecision(40, 900, W, T)).toBe("purr");
    expect(swipeDecision(-40, -900, W, T)).toBe("hiss");
  });

  it("ignores a fast flick that barely moved (accidental tap)", () => {
    expect(swipeDecision(10, 900, W, T)).toBeNull();
  });

  it("ignores velocity against the drag direction", () => {
    expect(swipeDecision(60, -900, W, T)).toBeNull();
  });

  it("cancels a long drag thrown back toward the centre", () => {
    expect(swipeDecision(150, -900, W, T)).toBeNull();
  });
});
