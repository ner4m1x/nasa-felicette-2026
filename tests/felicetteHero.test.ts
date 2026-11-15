import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { FelicetteHero } from "@/components/felicette/FelicetteHero";
import { en } from "@/i18n/en";
import { I18nContext, translate, type I18nValue } from "@/i18n/I18nProvider";
import { FELICETTE_MOODS, type FelicetteMood } from "@/lib/felicetteMood";

const i18n: I18nValue = {
  lang: "en",
  setLang: () => {},
  t: (key, params) => translate(en, key, params),
  dim: (id) => ({ sci: id, cat: null, short: id }),
};

const render = (text: string, mood?: FelicetteMood) =>
  renderToStaticMarkup(createElement(I18nContext.Provider, { value: i18n }, createElement(FelicetteHero, { text, mood })));

describe("FelicetteHero", () => {
  it("is a figure with her name, the full line for screen readers and a typewriter placeholder", () => {
    const html = render("Pick a target.");
    expect(html).toMatch(/^<figure/);
    expect(html).toContain(`>${en.felicette.name}</figcaption>`);
    expect(html).toContain('aria-live="polite" class="sr-only">Pick a target.</p>');
    // server render: nothing typed yet, but the invisible full text reserves the height
    expect(html).toContain('class="invisible col-start-1 row-start-1">Pick a target.</span>');
  });

  it("draws a comic bubble with an amber outline and a tail for phone and desktop", () => {
    const html = render("Hi");
    expect(html).toContain("border-[var(--hero-bubble-border)]");
    expect(html.match(/<path d="M1 0 L/g)?.length).toBe(2);
    expect(html).toContain('stroke="var(--hero-bubble-border)"');
    expect(html).toContain("lg:hidden");
  });

  it("uses the hero avatar size token and passes the mood through", () => {
    for (const mood of FELICETTE_MOODS) {
      const html = render("Hi", mood);
      expect(html).toContain("h-[var(--hero-avatar-size)] w-[var(--hero-avatar-size)]");
      expect(html).toContain(`data-mood="${mood}"`);
    }
  });
});
