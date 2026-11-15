"use client";

/**
 * Mission Report tab.
 * - Mission summary as a patch + the configurator choices.
 * - PURRed sites: both scores (never mixed), the limiting dimension and one "analogy breaks down"
 *   line for the configured target.
 * - Agreement with Félicette.
 * - Limits: Earth's fundamental limits + what the global scan cannot see.
 * - Methods & data: docs links, literature (sources.ts), pipeline datasets (manifest.json) and the
 *   validation badge — read from /data/validation_report.json only; never written here.
 * - Share: Web Share API on touch devices, clipboard otherwise, a selectable URL as last resort.
 */

import { BadgeCheck, CircleDashed, ExternalLink, Info, Share2, TriangleAlert } from "lucide-react";
import { useState, type ReactNode } from "react";
import { FelicetteSays } from "@/components/felicette/FelicetteSays";
import { EarthLimitsList } from "@/components/shell/EarthLimitsSheet";
import { KindBadge, SourceList, to100 } from "@/components/swipe/parts";
import { docUrl, METHOD_DOCS, VALIDATION_DOC } from "@/data/project";
import { SOURCES } from "@/data/sources";
import { TARGETS } from "@/data/targets";
import { useI18n } from "@/i18n/I18nProvider";
import type { I18nKey, Lang } from "@/i18n/types";
import { breakdownFor } from "@/lib/deck";
import { formatPercentile } from "@/lib/format";
import type { RankedCard, TargetId } from "@/lib/types";
import { validationTally, type ValidationReport } from "@/lib/validationReport";
import { useMission } from "@/state/MissionContext";
import { useSwipe } from "@/state/SwipeContext";
import { useManifest, useValidationReport } from "@/state/usePipeline";
import { MissionPatch } from "./MissionPatch";
import { PlanetaryReferenceList } from "./PlanetaryReferenceList";

const BLIND_SPOTS: I18nKey[] = [
  "report.blind.mineralogy",
  "report.blind.caves",
  "report.blind.subsurfaceIce",
  "report.blind.bearing",
  "report.blind.localSlopes",
];

interface MissionReportProps {
  onGoToSwipe: () => void;
  /** opens About & credits (data credits, repo, AI disclosure) */
  onOpenAbout: () => void;
}

export function MissionReport({ onGoToSwipe, onOpenAbout }: MissionReportProps) {
  const { t, lang, dim } = useI18n();
  const { config } = useMission();
  const swipe = useSwipe();
  const manifest = useManifest();
  const validation = useValidationReport();

  const byId = new Map<string, RankedCard>();
  for (const r of [...(swipe.ranked?.deck ?? []), ...(swipe.ranked?.rejected ?? [])]) byId.set(r.card.id, r);
  const purred = swipe.records
    .filter((r) => r.verdict === "purr")
    .map((r) => byId.get(r.cardId))
    .filter((r): r is RankedCard => r !== undefined);

  const { agreement } = swipe;

  return (
    <div className="mx-auto max-w-5xl space-y-5 px-3 py-4 lg:px-6 lg:py-6">
      <header className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wider text-dim">{t("report.kicker")}</p>
          <h2 className="text-xl font-bold uppercase tracking-wider text-fg">{t("report.title")}</h2>
        </div>
        <button
          type="button"
          onClick={onOpenAbout}
          className="flex min-h-11 items-center gap-1.5 rounded-control border border-line px-3 text-[11px] font-bold uppercase tracking-wider text-dim hover:border-phosphor hover:text-phosphor"
        >
          <Info aria-hidden size={14} />
          {t("about.link")}
        </button>
        {swipe.isFixture && (
          <p className="rounded-pill border border-danger px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-danger">
            {t("fixture.banner")}
          </p>
        )}
      </header>

      <div className="grid gap-5 lg:grid-cols-[320px_minmax(0,1fr)]">
        {/* ---- Left: patch, agreement, share ---- */}
        <div className="space-y-5">
          <Card title={t("report.summary")}>
            <MissionPatch config={config} className="mx-auto block w-full max-w-60" />
            <dl className="mt-3 space-y-1.5 text-xs">
              <Row label={t("options.target.title")} value={t(TARGETS[config.target].labelKey)} />
              <Row label={t("options.footprint.title")} value={t(`options.footprint.${config.footprint}.label`)} />
              <Row label={t("options.mobility.title")} value={t(`options.mobility.${config.mobility}.label`)} />
              <Row label={t("options.crew.title")} value={t(`options.crew.${config.crew}.label`)} />
            </dl>
          </Card>

          <Card title={t("report.agreementTitle")}>
            <p className="text-4xl font-bold tabular-nums text-phosphor">
              {agreement.ratio === null ? "—" : `${Math.round(agreement.ratio * 100)}%`}
            </p>
            <p className="mt-1 text-xs tabular-nums text-dim">
              {agreement.ratio === null
                ? t("breakdown.agreementNone")
                : t("breakdown.agreement", {
                    agreed: agreement.agreed,
                    counted: agreement.counted,
                    pct: Math.round(agreement.ratio * 100),
                  })}
            </p>
            <p className="mt-2 text-xs tabular-nums">
              {t("deck.stats", { purr: purred.length, hiss: swipe.records.filter((r) => r.verdict === "hiss").length })}
            </p>
            <p className="mt-2 text-[11px] leading-relaxed text-dim">{t("report.agreementNote")}</p>
          </Card>

          <ShareCard />
        </div>

        {/* ---- Right: PURRed sites ---- */}
        <Card title={t("report.purredTitle", { n: purred.length })}>
          {purred.length === 0 ? (
            <div className="space-y-3">
              <FelicetteSays key="report-empty" text={t("report.purredEmpty")} />
              <button
                type="button"
                onClick={onGoToSwipe}
                className="flex min-h-11 items-center justify-center rounded-control border border-phosphor/60 px-4 text-xs font-bold uppercase tracking-wider text-phosphor hover:bg-phosphor/10"
              >
                {t("report.goSwipe")}
              </button>
            </div>
          ) : (
            <ul className="space-y-3">
              {purred.map((r) => (
                <PurredSite key={r.card.id} ranked={r} target={config.target} lang={lang} dimLabel={(id) => dim(id).sci} />
              ))}
            </ul>
          )}
        </Card>
      </div>

      {/* ---- Limits ---- */}
      <div className="grid gap-5 lg:grid-cols-2">
        <Card title={t("limits.title")} subtitle={t("limits.intro")}>
          <EarthLimitsList compact />
          <p className="mt-2 text-[11px] text-dim">* {t("limits.unverified")}</p>
        </Card>
        <Card title={t("report.blindTitle")} subtitle={t("report.blindIntro")}>
          <ul className="space-y-2 text-sm leading-relaxed">
            {BLIND_SPOTS.map((k) => (
              <li key={k} className="flex gap-2">
                <TriangleAlert aria-hidden size={16} className="mt-0.5 shrink-0 text-amber" />
                <span>{t(k)}</span>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      {/* ---- Methods & data ---- */}
      <Card title={t("report.methods.title")}>
        <ValidationBadge report={validation} />

        <div className="mt-4 grid gap-5 lg:grid-cols-3">
          <section>
            <h4 className="text-[11px] font-bold uppercase tracking-wider text-dim">{t("report.methods.docs")}</h4>
            <ul className="mt-1.5 space-y-1 text-xs">
              {METHOD_DOCS.map((d) => (
                <li key={d.file}>
                  <ExtLink href={docUrl(d.file)}>{t(d.key)}</ExtLink>
                </li>
              ))}
              {validation && (
                <li>
                  <ExtLink href={docUrl(VALIDATION_DOC)}>{t("report.methods.docValidation")}</ExtLink>
                </li>
              )}
            </ul>
            <p className="mt-3 text-[11px] leading-relaxed text-dim">{t("report.methods.deckSource", { source: t(`report.methods.source.${swipe.status === "ready" ? (swipe.isFixture ? "fixture" : swipe.notice ? "curatedOnly" : "pipeline") : "loading"}`) })}</p>
          </section>
          <section>
            <h4 className="text-[11px] font-bold uppercase tracking-wider text-dim">{t("report.methods.datasets")}</h4>
            <div className="mt-1.5">
              {manifest === undefined ? (
                <p className="text-xs text-dim">…</p>
              ) : manifest === null ? (
                <p className="text-xs text-dim">{t("report.methods.manifestPending")}</p>
              ) : (
                <>
                  <SourceList
                    ids={Object.keys(manifest.datasets)}
                    unverifiedLabel={t("breakdown.unverified")}
                    datasetLabel={t("sources.dataset")}
                    versionLabel={t("sources.version")}
                  />
                  <p className="mt-2 text-[10px] leading-snug text-dim">
                    {t("report.methods.run", {
                      version: manifest.pipelineVersion ?? "—",
                      when: manifest.runTimestamp ?? "—",
                      years: manifest.years.join(", ") || "—",
                      commit: manifest.configCommit?.slice(0, 12) ?? "—",
                    })}
                  </p>
                </>
              )}
            </div>
          </section>
          <PlanetaryReferenceList />
          <section>
            <h4 className="text-[11px] font-bold uppercase tracking-wider text-dim">{t("report.methods.literature")}</h4>
            <div className="mt-1.5">
              <SourceList
                ids={Object.keys(SOURCES)}
                unverifiedLabel={t("breakdown.unverified")}
                datasetLabel={t("sources.dataset")}
                versionLabel={t("sources.version")}
              />
              <p className="mt-2 text-[10px] text-dim">* {t("breakdown.unverified")}</p>
            </div>
          </section>
        </div>
      </Card>
    </div>
  );
}

function PurredSite({
  ranked,
  target,
  lang,
  dimLabel,
}: {
  ranked: RankedCard;
  target: TargetId;
  lang: Lang;
  dimLabel: (id: string) => string;
}) {
  const { t } = useI18n();
  const { card, analog, missionFit } = ranked;
  const breaks = breakdownFor(card, target)?.breaksDown[lang]?.[0] ?? null;
  return (
    <li className="rounded-control border border-line bg-panel-2 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <KindBadge kind={card.kind} label={t(`kinds.${card.kind}`)} />
        <span className="text-[10px] text-dim">{card.country ?? t("card.noCountry")}</span>
      </div>
      <h4 className="mt-1.5 text-sm font-bold">{card.name}</h4>
      <dl className="mt-2 grid grid-cols-2 gap-2 text-xs">
        <div>
          <dt className="text-[10px] uppercase tracking-wider text-score-analog">{t("card.analog")}</dt>
          <dd className="font-bold tabular-nums">{analog ? `${to100(analog.total)}${t("card.outOf")}` : "—"}</dd>
        </div>
        <div>
          <dt className="text-[10px] uppercase tracking-wider text-score-fit">{t("card.fit")}</dt>
          <dd className="font-bold tabular-nums">{`${to100(missionFit.fit)}${t("card.outOf")}`}</dd>
        </div>
      </dl>
      <p className="mt-2 text-xs">
        <span className="text-dim">{t("report.limitingLabel")}: </span>
        {analog ? dimLabel(analog.limiting) : t("card.unscored")}
      </p>
      <p className="mt-1 text-xs leading-relaxed">
        <span className="text-amber">⚠️ {t("breakdown.breaksDown")}: </span>
        {breaks ?? t("breakdown.noTarget", { target: t(TARGETS[target].labelKey) })}
      </p>
    </li>
  );
}

function ValidationBadge({ report }: { report: ValidationReport | null | undefined }) {
  const { t, lang } = useI18n();
  if (report === undefined) return <p className="text-xs text-dim">…</p>;
  if (report === null) {
    return (
      <div className="flex items-start gap-3 rounded-control border border-dashed border-amber/60 p-3">
        <CircleDashed aria-hidden size={28} className="shrink-0 text-amber" />
        <div>
          <p className="text-sm font-bold uppercase tracking-wider text-amber">{t("report.validation.pending")}</p>
          <p className="mt-0.5 text-xs text-dim">{t("report.validation.pendingBody")}</p>
        </div>
      </div>
    );
  }
  const { holds, total } = validationTally(report);
  const all = total > 0 && holds === total;
  const fmtPct = (v: number | null) => {
    const d = formatPercentile(v, lang);
    return d.kind === "top" ? "≥ 99.9" : d.kind === "value" ? d.text : "—";
  };
  return (
    <div className="rounded-control border p-3" style={{ borderColor: all ? "var(--phosphor)" : "var(--amber)" }}>
      <div className="flex items-start gap-3">
        {all ? (
          <BadgeCheck aria-hidden size={28} className="shrink-0 text-phosphor" />
        ) : (
          <TriangleAlert aria-hidden size={28} className="shrink-0 text-amber" />
        )}
        <div>
          <p className="text-sm font-bold uppercase tracking-wider" style={{ color: all ? "var(--phosphor)" : "var(--amber)" }}>
            {t("report.validation.badge", { holds, total })}
          </p>
          <p className="mt-0.5 text-[11px] text-dim">
            {t("report.validation.meta", {
              version: report.configVersion ?? "—",
              commit: report.configCommit?.slice(0, 12) ?? "—",
              when: report.generated ?? "—",
              sites: report.nSites,
            })}
          </p>
        </div>
      </div>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full min-w-[420px] text-left text-xs tabular-nums">
          <thead className="text-[10px] uppercase tracking-wider text-dim">
            <tr>
              <th className="py-1 pr-2 font-normal">{t("report.validation.target")}</th>
              <th className="py-1 pr-2 font-normal">{t("report.validation.benchmarks")}</th>
              <th className="py-1 pr-2 font-normal">{t("report.validation.traps")}</th>
              <th className="py-1 font-normal">{t("report.validation.holds")}</th>
            </tr>
          </thead>
          <tbody>
            {(Object.entries(report.summary) as [TargetId, NonNullable<ValidationReport["summary"][TargetId]>][]).map(
              ([tid, s]) => (
                <tr key={tid} className="border-t border-line">
                  <td className="py-1.5 pr-2">{t(TARGETS[tid].catKey)}</td>
                  <td className="py-1.5 pr-2">
                    {fmtPct(s.benchmarks.medianPercentile)} <span className="text-dim">(n={s.benchmarks.n})</span>
                  </td>
                  <td className="py-1.5 pr-2">
                    {fmtPct(s.traps.medianPercentile)} <span className="text-dim">(n={s.traps.n})</span>
                  </td>
                  <td className="py-1.5" style={{ color: s.patternHolds ? "var(--phosphor)" : "var(--danger)" }}>
                    {s.patternHolds ? t("report.validation.yes") : t("report.validation.no")}
                  </td>
                </tr>
              ),
            )}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-[10px] leading-snug text-dim">{t("report.validation.explain")}</p>
    </div>
  );
}

type ShareState = "idle" | "copied" | "shared" | "manual";

function ShareCard() {
  const { t } = useI18n();
  const [state, setState] = useState<ShareState>("idle");
  const [url, setUrl] = useState("");

  const share = async () => {
    const href = window.location.href; // the mission is always encoded in the query (MissionContext)
    setUrl(href);
    const touch = window.matchMedia("(pointer: coarse)").matches;
    if (touch && typeof navigator.share === "function") {
      try {
        await navigator.share({ title: t("app.title"), text: t("report.shareText"), url: href });
        setState("shared");
        return;
      } catch (e) {
        if (e instanceof DOMException && e.name === "AbortError") return; // user cancelled
      }
    }
    try {
      await navigator.clipboard.writeText(href);
      setState("copied");
    } catch {
      setState("manual");
    }
  };

  return (
    <Card title={t("report.shareTitle")}>
      <button
        type="button"
        onClick={share}
        className="flex min-h-12 w-full items-center justify-center gap-2 rounded-control border border-amber text-sm font-bold uppercase tracking-widest text-amber hover:bg-amber/10"
      >
        <Share2 aria-hidden size={18} />
        {t("report.share")}
      </button>
      <p role="status" className="mt-2 min-h-4 text-[11px] text-dim">
        {state === "copied" && t("report.shareCopied")}
        {state === "shared" && t("report.shareDone")}
        {state === "manual" && t("report.shareManual")}
      </p>
      {state === "manual" && (
        <input
          readOnly
          value={url}
          aria-label={t("report.shareTitle")}
          onFocus={(e) => e.currentTarget.select()}
          className="mt-1 w-full rounded-control border border-line bg-panel-2 px-2 py-2 text-xs"
        />
      )}
      <p className="mt-1 text-[11px] leading-relaxed text-dim">{t("config.shareHint")}</p>
    </Card>
  );
}

function Card({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  return (
    <section className="rounded-card border border-line bg-panel p-4">
      <h3 className="text-xs font-bold uppercase tracking-wider text-fg">{title}</h3>
      {subtitle && <p className="mt-0.5 text-[11px] leading-snug text-dim">{subtitle}</p>}
      <div className="mt-3">{children}</div>
    </section>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-dim">{label}</dt>
      <dd className="text-right font-bold">{value}</dd>
    </div>
  );
}

function ExtLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="underline decoration-dotted underline-offset-2 hover:text-phosphor"
    >
      {children}
      <ExternalLink aria-hidden size={10} className="ml-1 inline align-baseline" />
    </a>
  );
}
