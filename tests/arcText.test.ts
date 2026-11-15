import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { MissionPatch } from "@/components/report/MissionPatch";
import { TARGETS } from "@/data/targets";
import { en } from "@/i18n/en";
import { I18nContext, translate, type I18nValue } from "@/i18n/I18nProvider";
import { pl } from "@/i18n/pl";
import type { Dictionary, I18nKey } from "@/i18n/types";
import { estimateNaturalWidth, fitArcText, fittedWidth, patchArc, type ArcFitInput } from "@/lib/arcText";
import { TARGET_IDS, type MissionConfig } from "@/lib/types";

const FOOTPRINTS = ["compact", "medium", "mega"] as const;
const MOBILITIES = ["climber", "heavy"] as const;
const CREWS = ["robotic", "short", "permanent"] as const;

/** Every mission's patch labels (same composition as MissionPatch). */
function labels(dict: Dictionary) {
  const t = (k: string) => translate(dict, k as I18nKey);
  const tops = TARGET_IDS.map((id) => `${t("app.short")} · ${t(TARGETS[id].catKey)}`.toUpperCase());
  const bottoms: string[] = [];
  for (const f of FOOTPRINTS)
    for (const m of MOBILITIES)
      for (const c of CREWS)
        bottoms.push(
          [t(`options.footprint.${f}.label`), t(`options.mobility.${m}.label`), t(`options.crew.${c}.label`)].join(" · ").toUpperCase(),
        );
  return { tops, bottoms };
}

describe("patchArc", () => {
  it("centres the arc on the top / bottom and returns its length", () => {
    const top = patchArc(120, 120, 90, "top", 180);
    expect(top.d).toBe("M 30.00 120.00 A 90 90 0 0 1 210.00 120.00");
    expect(top.length).toBeCloseTo(Math.PI * 90);
    const bottom = patchArc(120, 120, 98, "bottom", 180);
    expect(bottom.d).toBe("M 22.00 120.00 A 98 98 0 0 0 218.00 120.00");
  });
  it("uses the large-arc flag above 180°", () => {
    expect(patchArc(120, 120, 90, "top", 215).d).toMatch(/A 90 90 0 1 1/);
    expect(patchArc(120, 120, 98, "bottom", 130).d).toMatch(/A 98 98 0 0 0/);
  });
});

describe("fitArcText", () => {
  const base: Omit<ArcFitInput, "naturalWidth" | "chars"> = { baseFont: 10, baseSpacing: 1.5, minFont: 7, arc: 200 };
  it("keeps the base style when it fits", () => {
    expect(fitArcText({ ...base, naturalWidth: 100, chars: 20 })).toEqual({ fontSize: 10, letterSpacing: 1.5 });
  });
  it("first trims letter spacing", () => {
    const fit = fitArcText({ ...base, naturalWidth: 180, chars: 20 });
    expect(fit).toEqual({ fontSize: 10, letterSpacing: 1 });
  });
  it("then shrinks the font", () => {
    const fit = fitArcText({ ...base, naturalWidth: 250, chars: 40 });
    expect(fit.letterSpacing).toBe(0);
    expect(fit.fontSize).toBe(8);
    expect(fit.textLength).toBeUndefined();
  });
  it("squeezes with textLength only when even the minimum size is too long", () => {
    const fit = fitArcText({ ...base, naturalWidth: 400, chars: 60 });
    expect(fit).toEqual({ fontSize: 7, letterSpacing: 0, textLength: 200 });
  });
  it("never exceeds the arc", () => {
    for (let w = 10; w < 600; w += 7)
      for (const chars of [5, 20, 53]) {
        const input = { ...base, naturalWidth: w, chars };
        expect(fittedWidth(input, fitArcText(input))).toBeLessThanOrEqual(base.arc + 1e-9);
      }
  });
});

describe("mission patch labels: all 4 targets × all options, EN and PL", () => {
  // Same arcs and styles as MissionPatch (usable length = arc − 2 × 6 margin).
  const TOP = { arc: patchArc(120, 120, 90, "top", 215).length - 12, baseFont: 11, baseSpacing: 1.5, minFont: 7 };
  const BOTTOM = { arc: patchArc(120, 120, 98, "bottom", 130).length - 12, baseFont: 10, baseSpacing: 1.5, minFont: 7 };

  for (const [lang, dict] of [["en", en], ["pl", pl]] as const) {
    it(`${lang}: every label fits its arc at a readable size (estimate ${0.62} em/char)`, () => {
      const { tops, bottoms } = labels(dict);
      for (const [list, style] of [[tops, TOP], [bottoms, BOTTOM]] as const) {
        for (const text of list) {
          const input = { ...style, naturalWidth: estimateNaturalWidth(text, style.baseFont), chars: [...text].length };
          const fit = fitArcText(input);
          expect(fittedWidth(input, fit), text).toBeLessThanOrEqual(style.arc);
          // the longest labels shrink but stay ≥ the minimum size without squeezing
          expect(fit.textLength, text).toBeUndefined();
          expect(fit.fontSize, text).toBeGreaterThanOrEqual(style.minFont);
        }
      }
    });
  }

  it("renders centred textPaths for the longest PL mission", () => {
    const i18n: I18nValue = { lang: "pl", setLang: () => {}, t: (k, p) => translate(pl, k, p), dim: (id) => ({ sci: id, cat: null, short: id }) };
    const config: MissionConfig = { target: "moon_shackleton", footprint: "compact", mobility: "climber", crew: "short" };
    const html = renderToStaticMarkup(createElement(I18nContext.Provider, { value: i18n }, createElement(MissionPatch, { config })));
    expect(html.match(/<textPath[^>]*startOffset="50%"[^>]*text-anchor="middle"/g)?.length).toBe(2);
    expect(html).toContain("P.U.R.R. · POLARNA ZAMRAŻARKA I NASŁONECZNIONY DRAPAK");
  });
});
