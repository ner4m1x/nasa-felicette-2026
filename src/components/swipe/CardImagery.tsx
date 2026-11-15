"use client";

/**
 * Satellite thumbnail of a card's location: plain WMTS tiles as <img> (no Leaflet), composed so the
 * card's lat/lon sits at the centre (tile math in src/lib/cardImagery.ts).
 *
 * - Layers: cloud-free true colour (default; Sentinel-2 cloudless via EOX for site / user / curated
 *   cards, NASA Blue Marble for regional ones), NDVI, LST day — identifiers, dates and max zooms only
 *   from src/lib/gibs.ts. NDVI/LST are drawn over the dimmed true-colour base.
 * - Overlays: centre crosshair, caption (layer · date · source; the EOX attribution and licence
 *   whenever Sentinel-2 is visible, also under NDVI/LST), ~0.25° cell outline on regional
 *   cards, and on trap cards a Félicette hint chip that switches to NDVI.
 * - Gestures: the box keeps `touch-action: pan-y`; images ignore pointer events; the toggle and the
 *   chip stop pointerdown so a tap never starts the card drag.
 * - Loading: shimmer skeleton (static under reduced motion); a neutral state if tiles fail.
 *   `load` = false renders the skeleton only (cards deep in the stack); the next card loads its
 *   true colour while hidden behind the top card, which acts as the prefetch.
 */

import { ImageOff } from "lucide-react";
import { useCallback, useEffect, useRef, useState, type CSSProperties, type PointerEvent, type RefObject } from "react";
import { FelicetteAvatar } from "@/components/felicette/FelicetteAvatar";
import { useI18n } from "@/i18n/I18nProvider";
import {
  buildMosaic,
  cardDisplayZoom,
  cardLayers,
  cellFootprint,
  isThematic,
  layerDate,
  trueColourLayer,
  type CardLayerId,
  type MosaicTile,
} from "@/lib/cardImagery";
import { EOX_ATTRIBUTION_TEXT, GIBS_LAYERS } from "@/lib/gibs";
import type { DeckCard } from "@/lib/types";
import { IMAGERY } from "@/theme/tokens";

interface CardImageryProps {
  card: Pick<DeckCard, "id" | "name" | "lat" | "lon" | "scale" | "kind">;
  /** fetch tiles (top card and the one right behind it) */
  load: boolean;
  /** the top card: its controls are focusable */
  interactive: boolean;
}

type TileState = "loaded" | "failed";

const stop = (e: PointerEvent) => e.stopPropagation();

export function CardImagery({ card, load, interactive }: CardImageryProps) {
  const { t } = useI18n();
  const box = useRef<HTMLDivElement>(null);
  const size = useBoxSize(box);
  const trueColour = trueColourLayer(card);
  const [layerId, setLayerId] = useState<CardLayerId>(trueColour);
  const [tileState, setTileState] = useState<Record<string, TileState>>({});

  const onTile = useCallback((key: string, state: TileState) => {
    setTileState((prev) => (prev[key] === state ? prev : { ...prev, [key]: state }));
  }, []);

  const layer = GIBS_LAYERS[layerId];
  const thematic = isThematic(layerId);
  const zoom = size ? cardDisplayZoom(card, size.width, IMAGERY.regionalSpanKm, IMAGERY.siteDisplayZoom) : null;
  const mosaic = (id: CardLayerId) =>
    size && zoom !== null
      ? buildMosaic({ layer: GIBS_LAYERS[id], lat: card.lat, lon: card.lon, displayZoom: zoom, ...size })
      : null;
  const base = load ? mosaic(trueColour) : null;
  const top = load && thematic ? mosaic(layerId) : null;

  // The visible layer decides the state: all its tiles failed = unavailable; any pending = loading.
  const active = top ?? base;
  const states = active?.tiles.map((tile) => tileState[tile.key]) ?? [];
  const failed = states.length > 0 && states.every((s) => s === "failed");
  const ready = states.length > 0 && states.every((s) => s !== undefined);

  const date = layerDate(layer);
  // Sentinel-2 (EOX) is credited verbatim whenever it is on screen, alone or dimmed under NDVI/LST.
  const caption =
    layer.provider === "eox"
      ? t(`card.imagery.layer.${layerId}`)
      : [t(`card.imagery.layer.${layerId}`), date ?? t("card.imagery.composite"), t("card.imagery.source")].join(" · ");
  const credit = GIBS_LAYERS[trueColour].provider === "eox" ? EOX_ATTRIBUTION_TEXT : null;
  const footprint =
    card.scale === "regional" && size && zoom !== null
      ? cellFootprint({ lat: card.lat, lon: card.lon, sizeDeg: IMAGERY.cellSizeDeg, displayZoom: zoom, ...size })
      : null;

  return (
    <div
      ref={box}
      role="img"
      aria-label={[t("card.imagery.alt", { name: card.name }), caption, credit].filter(Boolean).join(". ")}
      className="relative w-full shrink-0 overflow-hidden border-b border-line bg-bg"
      style={{ height: "var(--imagery-card-height)", touchAction: "pan-y" }}
    >
      {base && (
        <TileLayer
          tiles={base.tiles}
          onTile={onTile}
          style={{ filter: thematic ? "var(--imagery-under-thematic-filter)" : "var(--imagery-base-filter)" }}
        />
      )}
      {top && <TileLayer tiles={top.tiles} onTile={onTile} style={{ opacity: "var(--imagery-thematic-opacity)" }} />}

      {!failed && (
        <svg aria-hidden className="pointer-events-none absolute inset-0 h-full w-full">
          {footprint && (
            <rect
              x={footprint.left}
              y={footprint.top}
              width={footprint.width}
              height={footprint.height}
              fill="none"
              stroke="var(--imagery-cell)"
              strokeWidth={1}
              strokeDasharray="3 3"
            />
          )}
          <Crosshair />
        </svg>
      )}

      {(!ready || !load) && !failed && (
        <div aria-hidden className="imagery-skeleton absolute inset-0 flex items-center justify-center">
          <span className="sr-only">{t("card.imagery.loading")}</span>
        </div>
      )}

      {failed && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 bg-panel-2 text-[11px] uppercase tracking-wider text-dim">
          <ImageOff aria-hidden size={18} />
          {t("card.imagery.unavailable")}
        </div>
      )}

      {/* Layer toggle (taps only: pointerdown never reaches the card drag). */}
      <div
        role="radiogroup"
        aria-label={t("card.imagery.group")}
        className="absolute left-2 top-2 flex overflow-hidden rounded-control border border-line text-[10px] font-bold uppercase tracking-wider"
        style={{ background: "var(--imagery-scrim)" }}
      >
        {cardLayers(card).map((id) => (
          <button
            key={id}
            type="button"
            role="radio"
            aria-checked={layerId === id}
            tabIndex={interactive ? 0 : -1}
            onPointerDown={stop}
            onClick={() => setLayerId(id)}
            className={`min-h-8 border-l border-line px-2 first:border-l-0 ${
              layerId === id ? "bg-phosphor/15 text-phosphor" : "text-dim hover:text-fg"
            }`}
            style={{ touchAction: "manipulation" }}
          >
            {t(`card.imagery.layer.${id}`)}
          </button>
        ))}
      </div>

      {card.kind === "trap" && layerId !== "ndvi" && (
        <button
          type="button"
          tabIndex={interactive ? 0 : -1}
          onPointerDown={stop}
          onClick={() => setLayerId("ndvi")}
          className="absolute bottom-7 right-2 min-h-8 rounded-pill border border-amber/70 px-2.5 text-[10px] font-bold tracking-wide text-amber hover:bg-amber/15"
          style={{ background: "var(--imagery-scrim)", touchAction: "manipulation" }}
        >
          <FelicetteAvatar mood="thinking" compact className="mr-1 inline-block h-5 w-5 align-middle" />
          {t("card.imagery.trapHint")}
        </button>
      )}

      <p
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 px-2 py-1 text-[9px] leading-tight text-dim"
        style={{ background: "var(--imagery-scrim)" }}
      >
        <span className="uppercase tracking-wider">{caption}</span>
        {credit && <span className="block">{credit}</span>}
      </p>
    </div>
  );
}

function TileLayer({
  tiles,
  onTile,
  style,
}: {
  tiles: MosaicTile[];
  onTile: (key: string, state: TileState) => void;
  style: CSSProperties;
}) {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0" style={style}>
      {tiles.map((tile) => (
        <Tile key={tile.key} tile={tile} onTile={onTile} />
      ))}
    </div>
  );
}

function Tile({ tile, onTile }: { tile: MosaicTile; onTile: (key: string, state: TileState) => void }) {
  const [failed, setFailed] = useState(false);
  const ref = useRef<HTMLImageElement>(null);
  // A cached image can finish before React attaches onLoad: read its state once mounted.
  useEffect(() => {
    const img = ref.current;
    if (img?.complete) onTile(tile.key, img.naturalWidth > 0 ? "loaded" : "failed");
  }, [tile.key, onTile]);
  return (
    // Plain <img>: WMTS tiles are already the right size; next/image would proxy and re-encode them.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      ref={ref}
      src={tile.url}
      alt=""
      draggable={false}
      decoding="async"
      onLoad={() => onTile(tile.key, "loaded")}
      onError={() => {
        setFailed(true);
        onTile(tile.key, "failed");
      }}
      className="absolute max-w-none select-none"
      style={{
        left: tile.left,
        top: tile.top,
        width: tile.width,
        height: tile.height,
        visibility: failed ? "hidden" : undefined,
      }}
    />
  );
}

/** Thin centre crosshair with a gap, so the exact spot stays visible. */
function Crosshair() {
  const arm = 9;
  const gap = 4;
  return (
    <svg x="50%" y="50%" overflow="visible" stroke="var(--imagery-crosshair)" strokeWidth={1}>
      <line x1={-gap - arm} y1={0} x2={-gap} y2={0} />
      <line x1={gap} y1={0} x2={gap + arm} y2={0} />
      <line x1={0} y1={-gap - arm} x2={0} y2={-gap} />
      <line x1={0} y1={gap} x2={0} y2={gap + arm} />
    </svg>
  );
}

/** Box size in CSS px (ResizeObserver: external system), null until measured. */
function useBoxSize(ref: RefObject<HTMLDivElement | null>) {
  const [size, setSize] = useState<{ width: number; height: number } | null>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => {
      const width = Math.round(el.clientWidth);
      const height = Math.round(el.clientHeight);
      if (width > 0 && height > 0)
        setSize((prev) => (prev && prev.width === width && prev.height === height ? prev : { width, height }));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref]);
  return size;
}
