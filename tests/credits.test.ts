import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { EARTH_CREDITS, PLANETARY_CREDITS } from "@/data/credits";
import { getSource } from "@/data/sources";
import { en } from "@/i18n/en";
import { pl } from "@/i18n/pl";

const leaf = (d: unknown, key: string) => key.split(".").reduce<unknown>((o, k) => (o as Record<string, unknown>)?.[k], d);
const ALL = [...EARTH_CREDITS, ...PLANETARY_CREDITS];

describe("About & credits", () => {
  it("covers the required datasets and missions", () => {
    const names = ALL.map((c) => c.name).join(" | ");
    for (const n of ["MODIS", "MERRA-2", "POWER", "GIBS", "Diviner", "LOLA", "MEDA", "SHARAD", "HiRISE", "ETOPO 2022", "GLiM", "Natural Earth"])
      expect(names).toContain(n);
  });

  it("every credit has an https link and an EN + PL role line", () => {
    for (const c of ALL) {
      expect(c.url, c.id).toMatch(/^https:\/\//);
      expect(typeof leaf(en, c.roleKey), c.roleKey).toBe("string");
      expect(typeof leaf(pl, c.roleKey), c.roleKey).toBe("string");
    }
  });

  // (sources.ts `verified` means human-reviewed content; some DOI-checked entries are still false)
  it("publications resolve to sources.ts entries with a DOI", () => {
    for (const c of PLANETARY_CREDITS)
      for (const id of c.papers ?? []) {
        const s = getSource(id);
        expect(s, id).not.toBeNull();
        expect(s!.doi, id).toBeTruthy();
      }
  });

  it("the AI disclosure text is the same in the app and in docs/AI_DISCLOSURE.md", () => {
    const doc = readFileSync(new URL("../docs/AI_DISCLOSURE.md", import.meta.url), "utf8").replace(/\s+/g, " ");
    expect(doc).toContain(en.about.ai);
    expect(en.about.ai).toBe(
      "Concept and design decisions by the author. Code written with AI assistance (Anthropic Claude Code); research, review and planning assisted by Claude and Google Gemini. The Félicette mascot artwork is AI-assisted. All data values come from cited datasets and publications, not from AI.",
    );
    expect(pl.about.ai.length).toBeGreaterThan(0);
    expect(readFileSync(new URL("../README.md", import.meta.url), "utf8")).toContain("docs/AI_DISCLOSURE.md");
  });
});
