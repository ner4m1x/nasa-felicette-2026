import { describe, expect, it } from "vitest";
import { en } from "@/i18n/en";
import { translate } from "@/i18n/I18nProvider";
import { pl } from "@/i18n/pl";
import type { Dictionary } from "@/i18n/types";
import { rankCard } from "@/lib/ranking";
import { TARGET_IDS, type AnalogEntry } from "@/lib/types";
import { felicetteVerdict, verdictHeadlineKey, type Verdict } from "@/lib/verdict";
import { config, makeCard } from "./helpers";

const DICTS: Record<string, Dictionary> = { en, pl };
const entry: AnalogEntry = { total: 0.9, dims: { a: 0.9 }, limiting: "a", percentile: 50 };
const PREFIX = /^\s*(HISS|PURR)\b/;

/** What the sheet renders: bold headline + reason. */
function sentence(dict: Dictionary, user: Verdict | null) {
  const cfg = config({ mobility: "heavy" });
  const r = rankCard(
    makeCard({ analog: Object.fromEntries(TARGET_IDS.map((t) => [t, entry])), mission: { trafficableFrac: 0.05 } }),
    cfg,
  )!;
  const v = felicetteVerdict(r, cfg);
  expect(v.reason.key).toBe("fit.constraint.trafficabilityFail");
  const record = user ? { verdict: user, recommendation: v.recommendation } : null;
  return `${translate(dict, verdictHeadlineKey(v.recommendation, record))} ${translate(dict, v.reason.key, v.reason.params)}`;
}

describe("verdict headline + reason", () => {
  for (const [lang, dict] of Object.entries(DICTS)) {
    it(`${lang}: a hard-failed card says HISS exactly once (before and after the swipe)`, () => {
      for (const user of [null, "hiss", "purr"] as const) {
        const s = sentence(dict, user);
        expect(s).not.toMatch(/HISS[:.]\s*HISS/);
        expect(s.match(/HISS/g)?.length ?? 0).toBe(1);
      }
    });

    it(`${lang}: no constraint or verdict reason text carries its own PURR/HISS prefix`, () => {
      const texts = [...Object.values(dict.fit.constraint), ...Object.values(dict.verdict.reason)];
      for (const s of texts) expect(s).not.toMatch(PREFIX);
    });
  }
});

describe("verdictHeadlineKey", () => {
  it("recommends before the swipe and compares after it", () => {
    expect(verdictHeadlineKey("hiss", null)).toBe("verdict.recommendHiss");
    expect(verdictHeadlineKey("purr", null)).toBe("verdict.recommendPurr");
    expect(verdictHeadlineKey("abstain", null)).toBe("verdict.abstain");
    expect(verdictHeadlineKey("hiss", { verdict: "hiss", recommendation: "hiss" })).toBe("verdict.agreeHiss");
    expect(verdictHeadlineKey("hiss", { verdict: "purr", recommendation: "hiss" })).toBe("verdict.purrVsHiss");
    expect(verdictHeadlineKey("purr", { verdict: "hiss", recommendation: "purr" })).toBe("verdict.hissVsPurr");
    expect(verdictHeadlineKey("abstain", { verdict: "purr", recommendation: "abstain" })).toBe("verdict.abstain");
  });
});
