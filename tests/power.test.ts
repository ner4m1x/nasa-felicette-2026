import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  cacheKey,
  clearPowerCache,
  fetchPowerClimatology,
  parsePowerResponse,
  PowerUnavailableError,
  powerUrl,
  snapToGrid,
} from "@/lib/power";

/** Shape copied from a real POWER response (2026-11-14); the numbers are arbitrary test inputs. */
function body(fill = -999) {
  const months = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
  const series = (v: number) => ({ ...Object.fromEntries(months.map((m, i) => [m, v + i])), ANN: v });
  return {
    header: { fill_value: fill, range: "TEST RANGE", api: { version: "vTEST" } },
    parameters: {
      TS: { units: "UNIT_A", longname: "LONG A" },
      PRECTOTCORR: { units: "UNIT_B", longname: "LONG B" },
    },
    properties: { parameter: { TS: series(1), PRECTOTCORR: { ...series(2), ANN: fill, MAR: fill } } },
  };
}

const okResponse = (json: unknown) => ({ ok: true, status: 200, json: async () => json }) as Response;

describe("POWER helpers", () => {
  it("snaps coordinates to the 0.5° cache grid", () => {
    expect(snapToGrid(37.5476)).toBe(37.5);
    expect(snapToGrid(29.7816)).toBe(30);
    expect(snapToGrid(-0.2)).toBe(0);
    expect(cacheKey(37.6, 29.74)).toBe(cacheKey(37.4, 29.6));
  });

  it("builds the verified endpoint URL with snapped coordinates", () => {
    const url = new URL(powerUrl(37.6, -59.93));
    expect(url.origin + url.pathname).toBe("https://power.larc.nasa.gov/api/temporal/climatology/point");
    expect(url.searchParams.get("parameters")).toBe("TS,TS_MAX,TS_MIN,PRECTOTCORR,ALLSKY_SFC_SW_DWN");
    expect(url.searchParams.get("latitude")).toBe("37.5");
    expect(url.searchParams.get("longitude")).toBe("-60");
    expect(url.searchParams.get("community")).toBe("RE");
  });
});

describe("parsePowerResponse", () => {
  it("reads units and long names from the response", () => {
    const p = parsePowerResponse(body(), 10, 20);
    expect(p.parameters.TS.units).toBe("UNIT_A");
    expect(p.parameters.TS.longname).toBe("LONG A");
    expect(p.parameters.TS.annual).toBe(1);
    expect(p.parameters.TS.monthly).toHaveLength(12);
    expect(p.range).toBe("TEST RANGE");
    expect(p.apiVersion).toBe("vTEST");
  });

  it("turns the response's fill value into null", () => {
    const p = parsePowerResponse(body(-777), 10, 20);
    expect(p.parameters.PRECTOTCORR.annual).toBeNull();
    expect(p.parameters.PRECTOTCORR.monthly[2]).toBeNull();
    expect(p.parameters.PRECTOTCORR.monthly[0]).toBe(2);
  });

  it("rejects an unexpected shape", () => {
    expect(() => parsePowerResponse({ nope: true }, 0, 0)).toThrow(PowerUnavailableError);
  });
});

describe("fetchPowerClimatology", () => {
  beforeEach(() => clearPowerCache());

  it("caches by snapped coordinates", async () => {
    const fetchImpl = vi.fn(async () => okResponse(body()));
    await fetchPowerClimatology(37.6, 29.7, { fetchImpl });
    await fetchPowerClimatology(37.4, 29.6, { fetchImpl });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("retries once, then succeeds", async () => {
    const fetchImpl = vi
      .fn()
      .mockRejectedValueOnce(new TypeError("network"))
      .mockResolvedValueOnce(okResponse(body()));
    const p = await fetchPowerClimatology(1, 1, { fetchImpl });
    expect(p.parameters.TS.annual).toBe(1);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("gives up after two attempts with PowerUnavailableError", async () => {
    const fetchImpl = vi.fn(async () => ({ ok: false, status: 503 }) as Response);
    await expect(fetchPowerClimatology(2, 2, { fetchImpl })).rejects.toBeInstanceOf(PowerUnavailableError);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("times out a hanging request", async () => {
    const fetchImpl = vi.fn(
      (_url: string, init?: RequestInit) =>
        new Promise<Response>((_, reject) => {
          init?.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")));
        }),
    );
    await expect(
      fetchPowerClimatology(3, 3, { fetchImpl: fetchImpl as unknown as typeof fetch, timeoutMs: 10 }),
    ).rejects.toBeInstanceOf(PowerUnavailableError);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });
});
