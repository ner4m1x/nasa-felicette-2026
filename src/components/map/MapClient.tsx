"use client";

/**
 * Global Scan Map tab.
 * - ScanMap (Leaflet) is loaded with next/dynamic and `ssr: false`, and only after the tab is
 *   first opened (Leaflet must not initialise inside a display:none panel). After that it stays
 *   mounted; ScanMap calls invalidateSize() whenever the tab becomes visible again.
 * - Phone: full-screen map, inspector in a draggable bottom sheet. It starts at a low "peek" with a
 *   one-line summary (best target + score) and expands on tap/drag; collapsed, the map stays visible.
 *   Desktop (≥ lg): map + side inspector panel; FelicetteHero in its header (pointer-following eyes)
 *   says the intro, then her summary of the clicked cell.
 * - Pins (src/lib/mapPins.ts): top candidate regions + benchmark/trap/curated cards, sized by rank;
 *   "Show all candidates" lifts the cap. The ice-sheet view filter (SwipeContext) applies here too.
 *   Tapping a pin opens its breakdown.
 * - Add to Félicette's deck (useDeckAction, one state for all three entry points): a popup at the
 *   tapped point (best target + "+ Add to deck" + "Details"), a compact "+ Deck" in the phone
 *   peek bar, and a sticky action row under the coordinates in the inspector.
 */

import { motion, useDragControls } from "framer-motion";
import { Check, ChevronUp, Plus } from "lucide-react";
import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FelicetteAvatar } from "@/components/felicette/FelicetteAvatar";
import { FelicetteHero } from "@/components/felicette/FelicetteHero";
import type { DeckAction } from "@/components/inspector/AddToDeck";
import { PointInspector } from "@/components/inspector/PointInspector";
import { targetSummary } from "@/components/inspector/TargetComparison";
import { useDeckAction } from "@/components/inspector/useDeckAction";
import { ViewFilterNote } from "@/components/shell/ViewFilterNote";
import { formatCoords, to100 } from "@/components/swipe/parts";
import { BreakdownSheet, type Decision } from "@/components/swipe/BreakdownSheet";
import { TARGETS } from "@/data/targets";
import { useI18n } from "@/i18n/I18nProvider";
import { bestTarget, targetRows } from "@/lib/bestTarget";
import { DECK_ACTION_REASON_KEY } from "@/lib/deckAction";
import { lowScoreFromSample } from "@/lib/lowScore";
import { selectPins } from "@/lib/mapPins";
import { DEFAULT_BASE, DEFAULT_OVERLAY_OPACITY, DEFAULT_SHOW_SCAN, type BaseLayerId, type GibsLayerId } from "@/lib/gibs";
import { useMission } from "@/state/MissionContext";
import { DESKTOP_QUERY, useMediaQuery } from "@/state/useMediaQuery";
import { useSwipe } from "@/state/SwipeContext";
import { useOverlayAvailable, useScanGrid } from "@/state/usePipeline";
import type { MarkerItem } from "./CandidateMarkers";
import { MapPointPopup } from "./MapPointPopup";
import { LayerSwitcher } from "./LayerSwitcher";

const ScanMap = dynamic(() => import("./ScanMap"), {
  ssr: false,
  loading: () => <div className="h-full w-full animate-pulse bg-panel" />,
});

/** Visible height (px) of the collapsed inspector sheet on phones (UI tuning). */
const PEEK_PX = 96;

export function MapClient({ active }: { active: boolean }) {
  const { t, lang, dim } = useI18n();
  const { config } = useMission();
  const swipe = useSwipe();
  const [visited, setVisited] = useState(active);
  if (active && !visited) setVisited(true);

  const [base, setBase] = useState<BaseLayerId>(DEFAULT_BASE);
  const [thematic, setThematic] = useState<GibsLayerId | null>(null);
  const [showScan, setShowScan] = useState(DEFAULT_SHOW_SCAN);
  const [opacity, setOpacity] = useState(DEFAULT_OVERLAY_OPACITY);
  const [point, setPoint] = useState<{ lat: number; lon: number } | null>(null);
  /** the point whose popup is open (same object as `point`, or null once closed) */
  const [popupFor, setPopupFor] = useState<{ lat: number; lon: number } | null>(null);
  const asideRef = useRef<HTMLElement>(null);
  const [openCardId, setOpenCardId] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [showAll, setShowAll] = useState(false);

  const desktop = useMediaQuery(DESKTOP_QUERY);
  const grid = useScanGrid(visited);
  const overlayAvailable = useOverlayAvailable(config.target);

  const markers = useMemo<MarkerItem[]>(() => {
    if (!swipe.visible) return [];
    const purred = new Set(swipe.records.filter((r) => r.verdict === "purr").map((r) => r.cardId));
    return selectPins(
      [
        ...swipe.visible.deck.map((ranked) => ({ ranked, purred: purred.has(ranked.card.id), rejected: false })),
        ...swipe.visible.rejected.map((ranked) => ({ ranked, purred: purred.has(ranked.card.id), rejected: true })),
      ],
      showAll,
    );
  }, [swipe.visible, swipe.records, showAll]);

  const sample = useMemo(
    () => (point && grid?.status === "ready" ? grid.grid.sample(point.lat, point.lon) : null),
    [point, grid],
  );
  const deckAction = useDeckAction(point, grid?.status === "ready" ? grid.grid : null, sample, config);

  // One-line summary (phone peek + map popup): best of the four targets at the clicked cell.
  const peek = useMemo(() => {
    if (!point || !sample || grid?.status !== "ready") return null;
    if (sample.land === false) return { best: null, score: null, rows: null, low: false };
    const rows = targetRows(sample, (tid) => grid.grid.percentile(tid, point.lat, point.lon));
    const best = bestTarget(rows);
    return {
      best,
      score: rows.find((r) => r.target === best)?.total ?? null,
      rows,
      low: best !== null && lowScoreFromSample(sample, best) !== null,
    };
  }, [point, sample, grid]);

  const markerTitle = useCallback(
    (m: MarkerItem) =>
      [m.ranked.card.name, t(`kinds.${m.ranked.card.kind}`), m.purred && t("swipe.purr"), m.rejected && t("map.rejectedTag")]
        .filter(Boolean)
        .join(" · "),
    [t],
  );

  const decision = useMemo<Decision | null>(() => {
    const item = markers.find((m) => m.ranked.card.id === openCardId);
    if (!item) return null;
    return {
      ranked: item.ranked,
      record: swipe.records.find((r) => r.cardId === openCardId) ?? null,
      verdict: swipe.verdictFor(item.ranked),
    };
  }, [markers, openCardId, swipe]);

  // Picking a point keeps the phone sheet at its peek: the summary shows there, the map stays visible.
  const onPick = useCallback((lat: number, lon: number) => {
    const p = { lat, lon };
    setPoint(p);
    setPopupFor(p);
  }, []);
  // Only the current point's popup may close itself (a replaced popup's late close is ignored).
  const onPopupClose = useCallback(() => setPopupFor((open) => (open === point ? null : open)), [point]);
  const onDetails = useCallback(() => {
    if (!desktop) {
      setPopupFor(null);
      setExpanded(true);
      return;
    }
    asideRef.current?.scrollTo({ top: 0 });
    document.getElementById("inspector-header")?.focus();
  }, [desktop]);

  const cutoff = grid?.status === "ready" ? grid.grid.meta.overlayTransparentBelow?.[config.target] : undefined;
  const peekText = !point
    ? cutoff !== undefined
      ? t("map.peek.hintCutoff", { n: to100(cutoff) })
      : t("map.peek.hint")
    : peek?.best && peek.score !== null
      ? t("map.peek.best", { target: t(TARGETS[peek.best].shortKey), score: to100(peek.score) })
      : peek
        ? t("map.peek.none")
        : formatCoords(lang, point.lat, point.lon);

  const inspector = (
    <PointInspector point={point} grid={grid} config={config} deckAction={deckAction} heroInHeader={desktop} />
  );
  // Desktop panel header: Félicette says the intro, then her summary of the clicked cell.
  const heroText = peek?.rows ? targetSummary(t, dim, peek.rows, peek.best) : t("map.inspector.intro");
  const popup =
    point && popupFor === point ? <MapPointPopup summary={peekText} action={deckAction} onDetails={onDetails} /> : null;

  return (
    <div className="relative h-full lg:grid lg:grid-cols-[minmax(0,1fr)_400px]">
      <div className="relative h-full min-h-0">
        {visited && (
          <ScanMap
            active={active}
            target={config.target}
            base={base}
            thematic={thematic}
            showScan={showScan}
            overlayAvailable={overlayAvailable === true}
            opacity={opacity}
            markers={markers}
            markerTitle={markerTitle}
            selected={point}
            onPick={onPick}
            popup={popup}
            onPopupClose={onPopupClose}
            onOpenCard={setOpenCardId}
            label={t("map.aria")}
          />
        )}
        <div className="pointer-events-none absolute right-3 top-3 z-[1000] flex flex-col items-end lg:left-14 lg:right-auto lg:items-start">
          <p className="pointer-events-auto mb-2 hidden max-w-64 rounded-control border border-line bg-panel/95 px-3 py-2 text-[11px] text-amber lg:block">
            {t(TARGETS[config.target].catKey)}
          </p>
          <LayerSwitcher
            base={base}
            onBase={setBase}
            thematic={thematic}
            onThematic={setThematic}
            showScan={showScan}
            onShowScan={setShowScan}
            overlayAvailable={overlayAvailable}
            opacity={opacity}
            onOpacity={setOpacity}
            transparentBelow={cutoff}
            showAll={showAll}
            onShowAll={setShowAll}
            hideIce={swipe.hideIce}
            onHideIce={swipe.setHideIce}
          />
          {swipe.hideIce && <ViewFilterNote byDefault={swipe.hideIceByDefault} className="pointer-events-auto mt-2 max-w-64" />}
        </div>
      </div>

      {desktop ? (
        <aside ref={asideRef} className="min-h-0 overflow-y-auto border-l border-line bg-panel" aria-label={t("map.inspector.title")}>
          <div className="border-b border-line p-4">
            <FelicetteHero
              key={heroText}
              text={heroText}
              mood={peek?.low ? "surprised" : "neutral"}
              followPointer
              avatarLabel={t("map.eyesAria")}
            />
          </div>
          {inspector}
        </aside>
      ) : (
        <MobileSheet
          expanded={expanded}
          onExpanded={setExpanded}
          label={t("map.inspector.title")}
          summary={peekText}
          toggleLabel={t(expanded ? "map.peek.collapse" : "map.peek.expand")}
          action={point ? <PeekDeckButton action={deckAction} /> : null}
        >
          {inspector}
        </MobileSheet>
      )}

      <BreakdownSheet
        decision={decision}
        agreement={swipe.agreement}
        onClose={() => setOpenCardId(null)}
        closeActionLabel={t("breakdown.close")}
        allowConfetti={false}
      />
    </div>
  );
}

function MobileSheet({
  expanded,
  onExpanded,
  label,
  summary,
  toggleLabel,
  action,
  children,
}: {
  expanded: boolean;
  onExpanded: (v: boolean) => void;
  label: string;
  /** one-line summary shown in the peek (best target + score) */
  summary: string;
  toggleLabel: string;
  /** compact control at the right end of the peek row (e.g. "+ Deck"); not part of the drag handle */
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const controls = useDragControls();
  const [height, setHeight] = useState(0);

  // Measure the sheet (external system: layout) to know the collapsed offset.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setHeight(el.offsetHeight));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const collapsedY = Math.max(0, height - PEEK_PX);

  return (
    <motion.div
      ref={ref}
      role="region"
      aria-label={label}
      className="absolute inset-x-0 bottom-0 z-[1100] flex h-[72%] flex-col rounded-t-sheet border border-b-0 border-line bg-panel shadow-card"
      drag="y"
      dragListener={false}
      dragControls={controls}
      dragConstraints={{ top: 0, bottom: collapsedY }}
      dragElastic={0.08}
      animate={{ y: expanded ? 0 : collapsedY }}
      transition={{ type: "spring", stiffness: 380, damping: 36 }}
      onDragEnd={(_, info) => {
        const goingDown = info.velocity.y > 300 || (info.velocity.y > -300 && info.offset.y > 60);
        const goingUp = info.velocity.y < -300 || info.offset.y < -60;
        if (goingUp) onExpanded(true);
        else if (goingDown) onExpanded(false);
      }}
      style={{ touchAction: "none" }}
    >
      <div className="flex min-h-[72px] w-full shrink-0 items-stretch gap-2 pr-3">
        <button
          type="button"
          onPointerDown={(e) => controls.start(e)}
          onClick={() => onExpanded(!expanded)}
          aria-expanded={expanded}
          aria-label={`${toggleLabel}: ${summary}`}
          className="flex min-w-0 flex-1 cursor-grab flex-col items-center gap-2 pl-4 pt-2"
          style={{ touchAction: "none" }}
        >
          <span aria-hidden className="block h-1.5 w-12 rounded-pill bg-line" />
          <span aria-live="polite" className="flex w-full items-center gap-2 text-left text-xs font-bold text-fg">
            <FelicetteAvatar compact className="h-6 w-6 shrink-0" />
            <span className="min-w-0 flex-1 truncate">{summary}</span>
            <ChevronUp aria-hidden size={16} className={`shrink-0 text-dim transition-transform ${expanded ? "rotate-180" : ""}`} />
          </span>
        </button>
        {action && <div className="flex shrink-0 items-center pt-3.5">{action}</div>}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain" style={{ touchAction: "pan-y" }}>
        {children}
      </div>
    </motion.div>
  );
}

/** Compact Add-to-deck control in the phone peek bar (full reasons live in the popup and the sheet). */
function PeekDeckButton({ action }: { action: DeckAction }) {
  const { t } = useI18n();
  const { state } = action;
  if (state.kind === "inDeck") {
    return (
      <span
        role="status"
        className="flex min-h-10 items-center gap-1 rounded-control border border-phosphor/50 px-2.5 text-[11px] font-bold uppercase tracking-wider text-phosphor"
      >
        <Check aria-hidden size={13} />
        {t("map.peek.inDeck")}
      </span>
    );
  }
  const reason = state.kind === "disabled" ? t(DECK_ACTION_REASON_KEY[state.reason]) : undefined;
  return (
    <button
      type="button"
      onClick={action.add}
      disabled={state.kind !== "add"}
      title={reason}
      aria-label={reason ? `${t("map.inspector.add.button")} – ${reason}` : t("map.inspector.add.button")}
      className="flex min-h-10 items-center gap-1 rounded-control border border-[var(--kind-user)] px-2.5 text-[11px] font-bold uppercase tracking-wider text-[var(--kind-user)] hover:bg-[var(--kind-user)]/10 disabled:cursor-not-allowed disabled:opacity-50"
    >
      <Plus aria-hidden size={14} />
      {t("map.peek.add")}
    </button>
  );
}
