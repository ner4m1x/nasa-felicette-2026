"use client";

/**
 * Pins for the deck cards of the configured target, coloured by card kind (CSS variables
 * --kind-*). PURRed cards are highlighted; cards rejected by the mission specs are dimmed.
 * Tapping a pin opens that card's breakdown (handled by the parent).
 */

import L from "leaflet";
import { useMemo } from "react";
import { Marker } from "react-leaflet";
import type { CardKind, RankedCard } from "@/lib/types";

export interface MarkerItem {
  ranked: RankedCard;
  purred: boolean;
  rejected: boolean;
}

interface CandidateMarkersProps {
  items: readonly MarkerItem[];
  onOpen: (cardId: string) => void;
  /** accessible title for a pin, e.g. "LunAres — Operational" */
  titleFor: (item: MarkerItem) => string;
}

const iconCache = new Map<string, L.DivIcon>();

function pinIcon(kind: CardKind, purred: boolean, rejected: boolean): L.DivIcon {
  const key = `${kind}|${purred}|${rejected}`;
  let icon = iconCache.get(key);
  if (!icon) {
    const cls = ["purr-pin", purred && "purr-pin--purred", rejected && "purr-pin--rejected"].filter(Boolean).join(" ");
    icon = L.divIcon({
      className: "purr-pin-wrap",
      html: `<span class="${cls}" style="--pin: var(--kind-${kind})"></span>`,
      iconSize: [28, 28],
      iconAnchor: [14, 14],
    });
    iconCache.set(key, icon);
  }
  return icon;
}

export function CandidateMarkers({ items, onOpen, titleFor }: CandidateMarkersProps) {
  // PURRed pins last, so they draw on top.
  const sorted = useMemo(() => [...items].sort((a, b) => Number(a.purred) - Number(b.purred)), [items]);
  return (
    <>
      {sorted.map((item) => (
        <Marker
          key={item.ranked.card.id}
          position={[item.ranked.card.lat, item.ranked.card.lon]}
          icon={pinIcon(item.ranked.card.kind, item.purred, item.rejected)}
          title={titleFor(item)}
          alt={titleFor(item)}
          keyboard
          zIndexOffset={item.purred ? 1000 : 0}
          eventHandlers={{ click: () => onOpen(item.ranked.card.id) }}
        />
      ))}
    </>
  );
}
