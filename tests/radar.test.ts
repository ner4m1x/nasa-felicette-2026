import { describe, expect, it } from "vitest";
import { radarGeometry, RADAR_RINGS } from "@/lib/radar";

const SIZE = 120;
const PAD = 15;
const C = SIZE / 2;
const R = C - PAD;

describe("radarGeometry", () => {
  const dims = { a: 1, b: 0.5, c: 0, d: 0.25 };
  const g = radarGeometry(dims, "c", SIZE, PAD);

  it("numbers the axes 1..n in pipeline order and flags only the limiting one", () => {
    expect(g.axes.map((a) => [a.id, a.n])).toEqual([
      ["a", 1],
      ["b", 2],
      ["c", 3],
      ["d", 4],
    ]);
    expect(g.axes.filter((a) => a.limiting).map((a) => a.id)).toEqual(["c"]);
  });

  it("starts at 12 o'clock and goes clockwise", () => {
    const [a, b] = g.axes;
    expect(a.ax).toBeCloseTo(C);
    expect(a.ay).toBeCloseTo(C - R);
    expect(b.ax).toBeCloseTo(C + R); // 90° clockwise = right
    expect(b.ay).toBeCloseTo(C);
  });

  it("scales each vertex by its value and keeps the raw value", () => {
    expect(g.axes[0].y).toBeCloseTo(C - R); // value 1 → spoke end
    expect(g.axes[1].x).toBeCloseTo(C + R * 0.5);
    expect(g.axes[2].x).toBeCloseTo(C); // value 0 → centre
    expect(g.axes[2].y).toBeCloseTo(C);
    expect(g.axes[1].value).toBe(0.5);
  });

  it("clamps out-of-range / non-finite values for drawing only", () => {
    const h = radarGeometry({ a: 1.4, b: -0.2, c: Number.NaN }, null, SIZE, PAD);
    expect(h.axes[0].y).toBeCloseTo(C - R);
    expect(h.axes[1].x).toBeCloseTo(C);
    expect(h.axes[0].value).toBe(1.4);
    expect(h.axes.some((a) => a.limiting)).toBe(false);
  });

  it("emits one ring per grid level and a polygon with one point per axis", () => {
    expect(g.rings).toHaveLength(RADAR_RINGS.length);
    expect(g.polygon.split(" ")).toHaveLength(4);
    expect(g.rings[0].split(" ")).toHaveLength(4);
  });

  it("puts the axis numbers outside the spokes but inside the viewBox", () => {
    for (const a of g.axes) {
      const d = Math.hypot(a.lx - C, a.ly - C);
      expect(d).toBeGreaterThan(R);
      expect(a.lx).toBeGreaterThanOrEqual(0);
      expect(a.lx).toBeLessThanOrEqual(SIZE);
      expect(a.ly).toBeGreaterThanOrEqual(0);
      expect(a.ly).toBeLessThanOrEqual(SIZE);
    }
  });
});
