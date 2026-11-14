import { describe, expect, it } from "vitest";
import { meterSegments } from "@/lib/meter";

describe("meterSegments", () => {
  it("lights the nearest number of cells", () => {
    expect(meterSegments(0.89, 20)).toBe(18);
    expect(meterSegments(0.5, 20)).toBe(10);
    expect(meterSegments(0.024, 20)).toBe(0);
    expect(meterSegments(0.026, 20)).toBe(1);
  });
  it("covers the ends exactly", () => {
    expect(meterSegments(0, 20)).toBe(0);
    expect(meterSegments(1, 20)).toBe(20);
  });
  it("clamps out-of-range values and ignores missing ones", () => {
    expect(meterSegments(1.3, 20)).toBe(20);
    expect(meterSegments(-0.2, 20)).toBe(0);
    expect(meterSegments(null, 20)).toBe(0);
    expect(meterSegments(undefined, 20)).toBe(0);
    expect(meterSegments(Number.NaN, 20)).toBe(0);
    expect(meterSegments(0.5, 0)).toBe(0);
  });
});
