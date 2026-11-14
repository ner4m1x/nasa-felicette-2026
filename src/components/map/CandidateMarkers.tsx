"use client";

/**
 * Pins for the deck cards of the configured target, coloured by card kind (CSS variables
 * --kind-* in tokens.css) and sized by rank (src/lib/mapPins.ts). PURRed cards are highlighted;
 * cards rejected by the mission specs are dimmed.
 * Tapping a pin opens that card's breakdown (handled by the parent).
 */

import L from "leaflet";
import { useMemo } from "react";
import { Marker } from "react-leaflet";
import type { CardKind, RankedCard } from "@/lib/types";
import { PIN_SIZE } from "@/theme/tokens";

export interface MarkerItem {
  ranked: RankedCard;
  purred: boolean;
  rejected: boolean;
  /** pin diameter in px (from rank) */
  size?: number;
}

interface CandidateMarkersProps {
  items: readonly MarkerItem[];
  onOpen: (cardId: string) => void;
  /** accessible title for a pin, e.g. "LunAres — Operational" */
  titleFor: (item: MarkerItem) => string;
}

const iconCache = new Map<string, L.DivIcon>();

function pinIcon(kind: CardKind, purred: boolean, rejected: boolean, size: number): L.DivIcon {
  const key = `${kind}|${purred}|${rejected}|${size}`;
  let icon = iconCache.get(key);
  if (!icon) {
    const cls = ["purr-pin", purred && "purr-pin--purred", rejected && "purr-pin--rejected"].filter(Boolean).join(" ");
    icon = L.divIcon({
      className: "purr-pin-wrap",
      html: `<span class="${cls}" style="--pin: var(--kind-${kind}); --pin-size: ${size}px"></span>`,
      // Hit area never smaller than 28 px, even for small pins.
      iconSize: [Math.max(28, size + 8), Math.max(28, size + 8)],
      iconAnchor: [Math.max(28, size + 8) / 2, Math.max(28, size + 8) / 2],
    });
    iconCache.set(key, icon);
  }
  return icon;
}

export function CandidateMarkers({ items, onOpen, titleFor }: CandidateMarkersProps) {
  // Smaller (lower-ranked) pins first and PURRed pins last, so important pins draw on top.
  const sorted = useMemo(
    () => [...items].sort((a, b) => Number(a.purred) - Number(b.purred) || (a.size ?? 0) - (b.size ?? 0)),
    [items],
  );
  return (
    <>
      {sorted.map((item) => (
        <Marker
          key={item.ranked.card.id}
          position={[item.ranked.card.lat, item.ranked.card.lon]}
          icon={pinIcon(item.ranked.card.kind, item.purred, item.rejected, item.size ?? PIN_SIZE.base)}
          title={titleFor(item)}
          alt={titleFor(item)}
          keyboard
          zIndexOffset={item.purred ? 1000 : (item.size ?? 0) * 10}
          eventHandlers={{ click: () => onOpen(item.ranked.card.id) }}
        />
      ))}
    </>
  );
}
