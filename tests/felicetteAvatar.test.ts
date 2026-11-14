import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { FelicetteAvatar } from "@/components/felicette/FelicetteAvatar";
import { FELICETTE_MOODS, moodForTeaser, moodForVerdict, type FelicetteMood } from "@/lib/felicetteMood";
import { LOW_SCORE } from "@/lib/lowScore";

const render = (mood: FelicetteMood, label?: string) => renderToStaticMarkup(createElement(FelicetteAvatar, { mood, label }));

describe("FelicetteAvatar", () => {
  it.each(FELICETTE_MOODS)("renders the %s expression", (mood) => {
    const svg = render(mood);
    expect(svg).toMatch(/^<svg[^>]*viewBox="0 0 64 64"/);
    expect(svg).toContain(`data-mood="${mood}"`);
    expect(svg).toContain('data-part="eyes"');
    expect(svg).toContain('data-part="mouth"');
    // tuxedo: black fur and white blaze/chest, only token colours (no hard-coded hex)
    expect(svg).toContain("var(--cat-fur)");
    expect(svg).toContain("var(--cat-white)");
    expect(svg).not.toMatch(/#[0-9a-f]{3,6}\b/i);
  });

  it("gives every expression a distinct drawing", () => {
    const strip = (s: string) => s.replace(/data-mood="[^"]*"/, "").replace(/felicette-clip-[\w-]+/g, "clip");
    const all = FELICETTE_MOODS.map((m) => strip(render(m)));
    expect(new Set(all).size).toBe(FELICETTE_MOODS.length);
  });

  it("puts the ears back only when hissing", () => {
    for (const m of FELICETTE_MOODS) {
      const svg = render(m);
      expect(svg.includes('data-part="ears-back"')).toBe(m === "hiss");
      expect(svg.includes('data-part="ears-up"')).toBe(m !== "hiss");
    }
  });

  it("blinks only with open eyes", () => {
    expect(render("neutral")).toContain("felicette-blink");
    expect(render("thinking")).toContain("felicette-blink");
    expect(render("surprised")).toContain("felicette-blink");
    expect(render("happy")).not.toContain("felicette-blink");
    expect(render("hiss")).not.toContain("felicette-blink");
  });

  it("shows a thought bubble only while thinking", () => {
    for (const m of FELICETTE_MOODS) expect(render(m).includes('data-part="thought"')).toBe(m === "thinking");
  });

  it("is decorative by default and an image when labelled", () => {
    expect(render("neutral")).toContain('aria-hidden="true"');
    const labelled = render("happy", "Félicette");
    expect(labelled).toContain('role="img"');
    expect(labelled).toContain('aria-label="Félicette"');
    expect(labelled).not.toContain("aria-hidden");
  });
});

describe("felicetteMood", () => {
  it("maps her recommendation to a face", () => {
    expect(moodForVerdict("purr", 0.8)).toBe("happy");
    expect(moodForVerdict("hiss", 0.4)).toBe("hiss");
    expect(moodForVerdict("abstain", null)).toBe("neutral");
  });

  it("is surprised by a very low analog score (below LOW_SCORE)", () => {
    expect(moodForVerdict("hiss", LOW_SCORE / 2)).toBe("surprised");
    expect(moodForVerdict("hiss", LOW_SCORE)).toBe("hiss");
    expect(moodForTeaser(LOW_SCORE / 2)).toBe("surprised");
    expect(moodForTeaser(0.5)).toBe("neutral");
    expect(moodForTeaser(null)).toBe("neutral");
  });
});
