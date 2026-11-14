"use client";

/**
 * Global Scan Map tab.
 * - ScanMap (Leaflet) is loaded with next/dynamic and `ssr: false`, and only after the tab is
 *   first opened (Leaflet must not initialise inside a display:none panel). After that it stays
 *   mounted; ScanMap calls invalidateSize() whenever the tab becomes visible again.
 * - Phone: full-screen map, inspector in a draggable bottom sheet (peek / expanded).
 *   Desktop (≥ lg): map + side inspector panel with Félicette's eyes.
 * - Pins = the ranked deck for the configured target; tapping one opens its breakdown.
 */

import { motion, useDragControls } from "framer-motion";
import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FelicetteEyes } from "@/components/felicette/FelicetteEyes";
import { PointInspector } from "@/components/inspector/PointInspector";
import { BreakdownSheet, type Decision } from "@/components/swipe/BreakdownSheet";
import { TARGETS } from "@/data/targets";
import { useI18n } from "@/i18n/I18nProvider";
import type { GibsLayerId } from "@/lib/gibs";
import { useMission } from "@/state/MissionContext";
import { DESKTOP_QUERY, useMediaQuery } from "@/state/useMediaQuery";
import { useSwipe } from "@/state/SwipeContext";
import { useOverlayAvailable, useScanGrid } from "@/state/usePipeline";
import type { MarkerItem } from "./CandidateMarkers";
import { LayerSwitcher } from "./LayerSwitcher";

const ScanMap = dynamic(() => import("./ScanMap"), {
  ssr: false,
  loading: () => <div className="h-full w-full animate-pulse bg-panel" />,
});

/** Visible height (px) of the collapsed inspector sheet on phones (UI tuning). */
const PEEK_PX = 132;

export function MapClient({ active }: { active: boolean }) {
  const { t } = useI18n();
  const { config } = useMission();
  const swipe = useSwipe();
  const [visited, setVisited] = useState(active);
  if (active && !visited) setVisited(true);

  const [thematic, setThematic] = useState<GibsLayerId | null>(null);
  const [showScan, setShowScan] = useState(true);
  const [opacity, setOpacity] = useState(0.75);
  const [point, setPoint] = useState<{ lat: number; lon: number } | null>(null);
  const [openCardId, setOpenCardId] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);

  const desktop = useMediaQuery(DESKTOP_QUERY);
  const grid = useScanGrid(visited);
  const overlayAvailable = useOverlayAvailable(config.target);

  const markers = useMemo<MarkerItem[]>(() => {
    if (!swipe.ranked) return [];
    const purred = new Set(swipe.records.filter((r) => r.verdict === "purr").map((r) => r.cardId));
    return [
      ...swipe.ranked.deck.map((ranked) => ({ ranked, purred: purred.has(ranked.card.id), rejected: false })),
      ...swipe.ranked.rejected.map((ranked) => ({ ranked, purred: purred.has(ranked.card.id), rejected: true })),
    ];
  }, [swipe.ranked, swipe.records]);

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

  const onPick = useCallback((lat: number, lon: number) => {
    setPoint({ lat, lon });
    setExpanded(true);
  }, []);

  const inspector = <PointInspector point={point} grid={grid} config={config} />;

  return (
    <div className="relative h-full lg:grid lg:grid-cols-[minmax(0,1fr)_400px]">
      <div className="relative h-full min-h-0">
        {visited && (
          <ScanMap
            active={active}
            target={config.target}
            thematic={thematic}
            showScan={showScan}
            overlayAvailable={overlayAvailable === true}
            opacity={opacity}
            markers={markers}
            markerTitle={markerTitle}
            selected={point}
            onPick={onPick}
            onOpenCard={setOpenCardId}
            label={t("map.aria")}
          />
        )}
        <div className="pointer-events-none absolute right-3 top-3 z-[1000] flex flex-col items-end lg:left-14 lg:right-auto lg:items-start">
          <p className="pointer-events-auto mb-2 hidden max-w-64 rounded-control border border-line bg-panel/95 px-3 py-2 text-[11px] text-amber lg:block">
            {t(TARGETS[config.target].catKey)}
          </p>
          <LayerSwitcher
            thematic={thematic}
            onThematic={setThematic}
            showScan={showScan}
            onShowScan={setShowScan}
            overlayAvailable={overlayAvailable}
            opacity={opacity}
            onOpacity={setOpacity}
          />
        </div>
      </div>

      {desktop ? (
        <aside className="min-h-0 overflow-y-auto border-l border-line bg-panel" aria-label={t("map.inspector.title")}>
          <div className="flex justify-center border-b border-line py-3">
            <FelicetteEyes label={t("map.eyesAria")} className="h-14 w-28" />
          </div>
          {inspector}
        </aside>
      ) : (
        <MobileSheet expanded={expanded} onExpanded={setExpanded} label={t("map.inspector.title")}>
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
  children,
}: {
  expanded: boolean;
  onExpanded: (v: boolean) => void;
  label: string;
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
      <button
        type="button"
        onPointerDown={(e) => controls.start(e)}
        onClick={() => onExpanded(!expanded)}
        aria-expanded={expanded}
        className="flex min-h-11 w-full shrink-0 cursor-grab items-center justify-center"
        style={{ touchAction: "none" }}
      >
        <span aria-hidden className="block h-1.5 w-12 rounded-pill bg-line" />
        <span className="sr-only">{label}</span>
      </button>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain" style={{ touchAction: "pan-y" }}>
        {children}
      </div>
    </motion.div>
  );
}
