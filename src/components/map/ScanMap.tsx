"use client";

/**
 * The Leaflet map (client-only; loaded through next/dynamic with ssr: false by MapClient).
 * - Base: cloud-free GIBS Blue Marble by default, or the single-day VIIRS true colour; the base
 *   tile layer alone gets the terminal dim (--map-base-filter). Optional thematic GIBS layer
 *   (LST / NDVI) and the pipeline scan overlay on top, both unfiltered with the user's opacity.
 * - The map sits in a tab panel that is hidden, not unmounted: when the tab becomes visible again
 *   `invalidateSize()` re-measures the container.
 * - Click/tap anywhere → onPick(lat, lon). The selected point gets a pulse marker (this is the
 *   touch feedback; mouse users also get the LaserCursor) and, when given, a popup (MapPointPopup:
 *   best target + "Add to deck" + "Details"). One Popup instance per point (keyed), so a stale
 *   popup's close event can be told apart from the current one by the caller.
 */

import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { useEffect, useMemo, useRef, type ReactNode } from "react";
import { AttributionControl, MapContainer, Marker, Popup, TileLayer, useMap, useMapEvents } from "react-leaflet";
import { GIBS_ATTRIBUTION, GIBS_LAYERS, gibsLayerLabel, gibsTileUrl, type BaseLayerId, type GibsLayerId } from "@/lib/gibs";
import type { TargetId } from "@/lib/types";
import { MAP_POPUP } from "@/theme/tokens";
import { CandidateMarkers, type MarkerItem } from "./CandidateMarkers";
import { LaserCursor } from "./LaserCursor";
import { ScanOverlay } from "./ScanOverlay";

export interface ScanMapProps {
  active: boolean;
  target: TargetId;
  base: BaseLayerId;
  thematic: GibsLayerId | null;
  showScan: boolean;
  overlayAvailable: boolean;
  opacity: number;
  markers: readonly MarkerItem[];
  markerTitle: (item: MarkerItem) => string;
  selected: { lat: number; lon: number } | null;
  onPick: (lat: number, lon: number) => void;
  /** popup content at the selected point (null = no popup) */
  popup?: ReactNode;
  /** the popup at the selected point was closed (× button, Esc, or a click elsewhere) */
  onPopupClose?: () => void;
  onOpenCard: (cardId: string) => void;
  /** accessible label of the map region */
  label: string;
}

const WORLD: L.LatLngBoundsExpression = [
  [-85.0511, -180],
  [85.0511, 180],
];

const pulseIcon = L.divIcon({
  className: "purr-pin-wrap",
  html: '<span class="purr-pulse"></span>',
  iconSize: [36, 36],
  iconAnchor: [18, 18],
});

const LEAFLET_PREFIX = '<a href="https://leafletjs.com" target="_blank" rel="noreferrer">Leaflet</a>';
const POPUP_OFFSET: L.PointExpression = [0, MAP_POPUP.offsetYPx];
const POPUP_PAD: L.PointExpression = [MAP_POPUP.autoPanPaddingPx, MAP_POPUP.autoPanPaddingPx];

function SizeSync({ active }: { active: boolean }) {
  const map = useMap();
  // Sync Leaflet (external system) with the tab visibility.
  useEffect(() => {
    if (!active) return;
    const id = requestAnimationFrame(() => map.invalidateSize());
    return () => cancelAnimationFrame(id);
  }, [active, map]);
  // …and with container resizes (desktop window resize, rotation).
  useEffect(() => {
    const ro = new ResizeObserver(() => map.invalidateSize());
    ro.observe(map.getContainer());
    return () => ro.disconnect();
  }, [map]);
  return null;
}

function ClickHandler({ onPick }: { onPick: (lat: number, lon: number) => void }) {
  useMapEvents({
    click: (e) => {
      const p = e.latlng.wrap();
      onPick(p.lat, p.lng);
    },
  });
  return null;
}

export default function ScanMap(props: ScanMapProps) {
  const { active, target, base: baseId, thematic, showScan, overlayAvailable, opacity, markers, markerTitle, selected } = props;
  const wrap = useRef<HTMLDivElement>(null);
  const base = GIBS_LAYERS[baseId];
  const theme = thematic ? GIBS_LAYERS[thematic] : null;
  const { popup, onPopupClose } = props;
  // Stable identities: react-leaflet re-opens the popup whenever `position` changes identity.
  const popupPos = useMemo<L.LatLngTuple | null>(() => (selected ? [selected.lat, selected.lon] : null), [selected]);
  const popupEvents = useMemo(() => ({ remove: () => onPopupClose?.() }), [onPopupClose]);

  return (
    <div ref={wrap} className="relative h-full w-full" role="region" aria-label={props.label}>
      <MapContainer
        center={[20, 0]}
        zoom={2}
        minZoom={1}
        maxZoom={9}
        maxBounds={WORLD}
        maxBoundsViscosity={1}
        worldCopyJump={false}
        zoomControl
        className="h-full w-full"
        attributionControl={false}
      >
        {/* Leaflet credit as plain text: the default prefix adds a flag icon, and the app shows no flags */}
        <AttributionControl prefix={LEAFLET_PREFIX} />
        {/* key: remount on switch so Leaflet's attribution control drops the old base's line */}
        <TileLayer
          key={base.id}
          url={gibsTileUrl(base)}
          maxNativeZoom={base.maxZoom}
          maxZoom={9}
          noWrap
          bounds={WORLD}
          className="purr-base-tiles"
          attribution={`${GIBS_ATTRIBUTION} · ${gibsLayerLabel(base)}`}
        />
        {theme && (
          <TileLayer
            key={theme.id}
            url={gibsTileUrl(theme)}
            maxNativeZoom={theme.maxZoom}
            maxZoom={9}
            noWrap
            bounds={WORLD}
            opacity={opacity}
            zIndex={10}
            attribution={gibsLayerLabel(theme)}
          />
        )}
        {showScan && overlayAvailable && <ScanOverlay target={target} opacity={opacity} />}
        <CandidateMarkers items={markers} onOpen={props.onOpenCard} titleFor={markerTitle} />
        {selected && <Marker position={[selected.lat, selected.lon]} icon={pulseIcon} interactive={false} keyboard={false} />}
        {popupPos && popup && (
          <Popup
            key={popupPos.join(",")}
            position={popupPos}
            className="purr-popup"
            offset={POPUP_OFFSET}
            autoPanPadding={POPUP_PAD}
            eventHandlers={popupEvents}
          >
            {popup}
          </Popup>
        )}
        <ClickHandler onPick={props.onPick} />
        <SizeSync active={active} />
      </MapContainer>
      <LaserCursor container={wrap} />
    </div>
  );
}
