import { describe, expect, it } from "vitest";
import { doiUrl, parseManifest, resolveSource } from "@/lib/manifest";
import { parseValidationReport, validationTally } from "@/lib/validationReport";

/** Synthetic manifest with the shape written by scripts/pipeline/export.py build_manifest(). */
const MANIFEST = {
  pipeline_version: "test-0",
  run_timestamp: "2000-01-01T00:00:00Z",
  years: [2000],
  config: { commit: "0123456789abcdef", dirty: false },
  datasets: {
    TESTPROD: {
      source_id: "TESTPROD.001",
      short_name: "TESTPROD",
      version: "001",
      title: "Test product title",
      doi: "10.0000/TEST.001",
      concept_id: "C0-TEST",
      temporal_range: ["2000-01-01T00:00:00Z", null],
      granule_count: 1,
      role: "test role",
    },
    TESTHTTP: {
      source_id: "TESTHTTP",
      short_name: "TESTHTTP",
      version: null,
      title: "Paper title",
      doi: null,
      dataset_doi: null,
      url: "https://example.org/download",
      landing_url: "https://example.org/landing",
    },
    broken: "not an object",
  },
};

describe("doiUrl", () => {
  it("normalises bare, prefixed and resolver DOIs", () => {
    expect(doiUrl("10.0000/ABC.1")).toBe("https://doi.org/10.0000/ABC.1");
    expect(doiUrl("doi:10.0000/ABC.1")).toBe("https://doi.org/10.0000/ABC.1");
    expect(doiUrl("https://doi.org/10.0000/ABC.1")).toBe("https://doi.org/10.0000/ABC.1");
  });
  it("returns null for anything that is not a DOI", () => {
    expect(doiUrl(null)).toBeNull();
    expect(doiUrl("n/a")).toBeNull();
  });
});

describe("parseManifest", () => {
  it("indexes datasets by source_id and skips malformed entries", () => {
    const m = parseManifest(MANIFEST)!;
    expect(Object.keys(m.datasets).sort()).toEqual(["TESTHTTP", "TESTPROD.001"]);
    const p = m.datasets["TESTPROD.001"];
    expect(p.url).toBe("https://doi.org/10.0000/TEST.001");
    expect(p.version).toBe("001");
    expect(p.temporalRange).toBe("2000-01-01T00:00:00Z – …");
    expect(m.datasets.TESTHTTP.url).toBe("https://example.org/landing");
    expect(m.configCommit).toBe("0123456789abcdef");
  });
  it("returns null for a non-manifest", () => {
    expect(parseManifest(null)).toBeNull();
    expect(parseManifest({ datasets: 3 })).toBeNull();
  });
});

describe("resolveSource", () => {
  const m = parseManifest(MANIFEST);
  it("prefers literature from sources.ts", () => {
    expect(resolveSource("nasa-power", m).kind).toBe("literature");
  });
  it("resolves pipeline dataset ids from the manifest", () => {
    const r = resolveSource("TESTPROD.001", m);
    expect(r.kind).toBe("dataset");
  });
  it("falls back to 'unknown' (rendered as plain text) without a manifest or for unknown ids", () => {
    expect(resolveSource("TESTPROD.001", null)).toEqual({ kind: "unknown", id: "TESTPROD.001" });
    expect(resolveSource("no-such-id", m)).toEqual({ kind: "unknown", id: "no-such-id" });
  });
});

describe("parseValidationReport", () => {
  /** Synthetic report with the shape written by scripts/pipeline/validate.py. */
  const REPORT = {
    generated: "2000-01-01T00:00:00Z",
    config_version: 1,
    config_git: { commit: "abc" },
    method: { site_radius_km: 1 },
    sites: [{}, {}],
    summary: {
      mars_jezero: {
        benchmarks: { n: 2, median_percentile: 60 },
        traps: { n: 1, median_percentile: 40 },
        pattern_holds: true,
      },
      moon_shackleton: {
        benchmarks: { n: 0, median_percentile: null },
        traps: { n: 1, median_percentile: 10 },
        pattern_holds: false,
      },
      venus: { pattern_holds: true },
    },
  };
  it("reads the summary for known targets only, without re-deciding the outcome", () => {
    const r = parseValidationReport(REPORT)!;
    expect(Object.keys(r.summary).sort()).toEqual(["mars_jezero", "moon_shackleton"]);
    expect(r.summary.mars_jezero!.patternHolds).toBe(true);
    expect(r.summary.moon_shackleton!.benchmarks.medianPercentile).toBeNull();
    expect(validationTally(r)).toEqual({ holds: 1, total: 2 });
    expect(r.nSites).toBe(2);
  });
  it("returns null when absent or malformed", () => {
    expect(parseValidationReport(null)).toBeNull();
    expect(parseValidationReport({ sites: [] })).toBeNull();
  });
});
