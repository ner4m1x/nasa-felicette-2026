/**
 * "Ask Félicette": scripted answers to five fixed questions about the CURRENT card.
 *
 * No language model: every answer is an i18n template (EN/PL) filled ONLY with data already on the
 * card or derived for it elsewhere in the app — Analog Score, percentile and limiting dimension
 * (deck.json), Mission Fit and its failed constraints (missionFit.ts), the per-target breakdown text,
 * the planetary comparison rows (planetaryReference.ts + scan grid) and the card's sources. Missing
 * data is said out loud ("no breakdown for this target"), never filled in.
 */
import { formatCoords, reasonText, to100 } from "@/components/swipe/parts";
import { TARGETS } from "@/data/targets";
import type { DimLabel } from "@/i18n/I18nProvider";
import type { I18nKey, I18nParams, Lang } from "@/i18n/types";
import { breakdownFor } from "./deck";
import { formatPercentile } from "./format";
import { resolveSource, type Manifest } from "./manifest";
import type { ComparisonRow, EarthCell } from "./planetaryComparison";
import type { PlanetaryRef } from "@/data/planetaryReference";
import { TARGET_IDS, type RankedCard, type TargetId } from "./types";

export const ASK_QUESTIONS = ["why", "breaks", "test", "compare", "place"] as const;
export type AskQuestion = (typeof ASK_QUESTIONS)[number];

export interface AskContext {
  ranked: RankedCard;
  target: TargetId;
  /** planetary comparison rows for the card's cell; null = scan grid still loading */
  rows: ComparisonRow[] | null;
  /** pipeline manifest, to name dataset sources (null = not loaded / absent: ids shown as is) */
  manifest?: Manifest | null;
}

export interface AskFormat {
  t: (key: I18nKey, params?: I18nParams) => string;
  dim: (id: string) => DimLabel;
  lang: Lang;
  /** usePlanetaryFormat() in the UI */
  planetValue: (ref: PlanetaryRef) => string;
  earthValue: (e: EarthCell) => string;
}

/** Shown at most this many breakdown lines / source titles per answer (bubble size). */
export const ASK_MAX_ITEMS = 3;

const join = (parts: (string | null | false | undefined)[]) => parts.filter(Boolean).join(" ");

/** Breakdown lines are fragments without final punctuation: close each one so they read as sentences. */
const sentence = (s: string) => (/[.!?…]$/.test(s.trim()) ? s.trim() : `${s.trim()}.`);

function sourceName(id: string, manifest: Manifest | null): string {
  const s = resolveSource(id, manifest);
  if (s.kind === "dataset") return s.entry.shortName;
  if (s.kind === "literature") return s.entry.title;
  return id;
}

function percentileText(p: number, fmt: AskFormat): string {
  const d = formatPercentile(p, fmt.lang);
  if (d.kind === "top") return fmt.t("card.percentileTop");
  if (d.kind === "value") return fmt.t("card.percentile", { p: d.text });
  return "";
}

function limitingLine(ctx: AskContext, fmt: AskFormat): string | null {
  const a = ctx.ranked.analog;
  if (!a) return null;
  const score = a.dims[a.limiting];
  return fmt.t("ask.a.limiting", {
    dim: fmt.dim(a.limiting).sci,
    score: typeof score === "number" ? to100(score) : "—",
  });
}

function fitLine(ctx: AskContext, fmt: AskFormat): string {
  const { fit, failed } = ctx.ranked.missionFit;
  const head = fmt.t("ask.a.fit", { fit: to100(fit) });
  if (failed.length === 0) return `${head} ${fmt.t("ask.a.fitAllPassed")}`;
  const reasons = failed.map((c) =>
    fmt.t(c.hard ? "ask.a.hard" : "ask.a.soft", { reason: reasonText(fmt.t, fmt.dim, { key: c.reasonKey, params: c.params }) }),
  );
  return `${head} ${reasons.join(" ")}`;
}

function why(ctx: AskContext, fmt: AskFormat): string {
  const a = ctx.ranked.analog;
  const target = fmt.t(TARGETS[ctx.target].labelKey);
  const analog = a
    ? fmt.t("ask.a.analog", { score: to100(a.total), target, percentile: percentileText(a.percentile, fmt) })
    : fmt.t("ask.a.noAnalog", { target });
  return join([analog, limitingLine(ctx, fmt), fitLine(ctx, fmt)]);
}

function breakdownList(ctx: AskContext, fmt: AskFormat, section: "breaksDown" | "utility"): string | null {
  const b = breakdownFor(ctx.ranked.card, ctx.target);
  const items = b?.[section][fmt.lang] ?? [];
  if (items.length === 0) return null;
  const shown = items.slice(0, ASK_MAX_ITEMS).map(sentence).join(" ");
  const more = items.length - ASK_MAX_ITEMS;
  return more > 0 ? `${shown} ${fmt.t("ask.a.more", { n: more })}` : shown;
}

function noBreakdown(ctx: AskContext, fmt: AskFormat): string {
  return fmt.t("breakdown.noTarget", { target: fmt.t(TARGETS[ctx.target].labelKey) });
}

function breaks(ctx: AskContext, fmt: AskFormat): string {
  const list = breakdownList(ctx, fmt, "breaksDown");
  // the generated breakdown already names the limiting factor; without one, give it from the scores
  return list ? fmt.t("ask.a.breaks", { list }) : join([noBreakdown(ctx, fmt), limitingLine(ctx, fmt)]);
}

function test(ctx: AskContext, fmt: AskFormat): string {
  const list = breakdownList(ctx, fmt, "utility");
  return list ? fmt.t("ask.a.test", { list }) : noBreakdown(ctx, fmt);
}

function compare(ctx: AskContext, fmt: AskFormat): string {
  const { card } = ctx.ranked;
  const perTarget = TARGET_IDS.flatMap((id) => {
    const e = card.analog?.[id];
    return e ? [`${fmt.t(`targets.${id}.short`)} ${to100(e.total)}`] : [];
  });
  const across = perTarget.length
    ? fmt.t("ask.a.acrossTargets", { list: perTarget.join(" · ") })
    : fmt.t("ask.a.noAcross");

  const body = fmt.t(TARGETS[ctx.target].body === "moon" ? "ask.a.moon" : "ask.a.mars");
  if (ctx.rows === null) return join([across, fmt.t("ask.a.gridLoading")]);
  const measured = ctx.rows
    .filter((r) => r.earth.kind === "value")
    .map((r) => fmt.t("ask.a.row", { label: fmt.t(r.ref.labelKey), planet: fmt.planetValue(r.ref), body, earth: fmt.earthValue(r.earth) }));
  const invisible = ctx.rows.filter((r) => r.earth.kind === "invisible").map((r) => fmt.t(r.ref.labelKey));
  return join([
    across,
    measured.length ? measured.join(" ") : ctx.rows.length ? fmt.t("ask.a.noEarthValues") : null,
    invisible.length ? fmt.t("ask.a.invisible", { list: invisible.join("; ") }) : null,
  ]);
}

function place(ctx: AskContext, fmt: AskFormat): string {
  const { card } = ctx.ranked;
  const nf = (v: number, d = 1) => new Intl.NumberFormat(fmt.lang, { maximumFractionDigits: d }).format(v);
  const where = [card.name, card.country, formatCoords(fmt.lang, card.lat, card.lon)].filter(Boolean).join(" · ");
  const scale =
    card.scale === "regional"
      ? card.regionAreaKm2 !== null
        ? fmt.t("ask.a.regionalArea", { area: nf(card.regionAreaKm2, 0) })
        : fmt.t("ask.a.regional")
      : fmt.t("ask.a.site");
  const m = card.mission;
  const terrain = [
    m.slopeMeanDeg !== null ? fmt.t("ask.a.slope", { v: nf(m.slopeMeanDeg) }) : null,
    m.trafficableFrac !== null ? fmt.t("ask.a.trafficable", { v: nf(m.trafficableFrac * 100, 0) }) : null,
    m.reliefStdM !== null ? fmt.t("ask.a.relief", { v: nf(m.reliefStdM, 0) }) : null,
  ].filter((x): x is string => x !== null);
  const titles = card.sourceIds.map((id) => sourceName(id, ctx.manifest ?? null));
  const sources = titles.length
    ? fmt.t("ask.a.sources", {
        n: titles.length,
        list: [...titles.slice(0, ASK_MAX_ITEMS), ...(titles.length > ASK_MAX_ITEMS ? [`+${titles.length - ASK_MAX_ITEMS}`] : [])].join("; "),
      })
    : fmt.t("ask.a.noSources");
  return join([
    fmt.t("ask.a.place", { where, kind: fmt.t(`kinds.${card.kind}`), scale }),
    terrain.length ? fmt.t("ask.a.terrain", { list: terrain.join(", ") }) : null,
    card.known && fmt.t("ask.a.known"),
    card.stability !== null && fmt.t("ask.a.stability", { pct: nf(card.stability * 100, 0) }),
    card.ndviImputed && fmt.t("ask.a.ndviImputed"),
    sources,
  ]);
}

/** The question still shown: only if it was asked about the card that is on top now (else reset). */
export function currentQuestion(
  asked: { cardId: string; q: AskQuestion } | null,
  cardId: string | null,
): AskQuestion | null {
  return asked && cardId !== null && asked.cardId === cardId ? asked.q : null;
}

const ANSWERS: Record<AskQuestion, (ctx: AskContext, fmt: AskFormat) => string> = { why, breaks, test, compare, place };

export function askAnswer(q: AskQuestion, ctx: AskContext, fmt: AskFormat): string {
  return ANSWERS[q](ctx, fmt);
}
