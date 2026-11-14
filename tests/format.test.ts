import { describe, expect, it } from "vitest";
import { displayUnit, formatPercentile, formatPowerValue } from "@/lib/format";

describe("formatPercentile", () => {
  it("shows top 0.1% at or above 99.95 and never 100", () => {
    expect(formatPercentile(100, "en")).toEqual({ kind: "top" });
    expect(formatPercentile(99.95, "en")).toEqual({ kind: "top" });
    expect(formatPercentile(99.94, "en")).toEqual({ kind: "value", text: "99.9" });
  });
  it("uses one decimal place", () => {
    expect(formatPercentile(87.26, "en")).toEqual({ kind: "value", text: "87.3" });
    expect(formatPercentile(12, "en")).toEqual({ kind: "value", text: "12.0" });
    expect(formatPercentile(87.26, "pl")).toEqual({ kind: "value", text: "87,3" });
  });
  it("handles missing values", () => {
    expect(formatPercentile(Number.NaN, "en")).toEqual({ kind: "none" });
    expect(formatPercentile(null, "en")).toEqual({ kind: "none" });
  });
});

describe("POWER units", () => {
  it("maps raw units", () => {
    expect(displayUnit("C")).toBe("°C");
    expect(displayUnit("kW-hr/m^2/day")).toBe("kWh/m²/day");
    expect(displayUnit("%")).toBe("%");
  });
  it("adds mm/yr for mm/day", () => {
    expect(formatPowerValue(1, "mm/day", "en")).toEqual({ main: "1 mm/day", extra: "≈ 365 mm/yr" });
    expect(formatPowerValue(21.5, "C", "en")).toEqual({ main: "21.5 °C", extra: null });
    expect(formatPowerValue(null, "C", "en")).toEqual({ main: "—", extra: null });
  });
});
