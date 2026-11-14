"use client";

/**
 * The pipeline's similarity heatmap for the selected target: /data/scan_{target}.png, a Web
 * Mercator PNG spanning ±85.0511° (scripts/pipeline/export.py). Rendered only when the HEAD check
 * found it (the parent passes `available`).
 */

import { ImageOverlay } from "react-leaflet";
import { SCAN_OVERLAY_BOUNDS, scanOverlayUrl } from "@/lib/scanGrid";
import type { TargetId } from "@/lib/types";

interface ScanOverlayProps {
  target: TargetId;
  opacity: number;
}

export function ScanOverlay({ target, opacity }: ScanOverlayProps) {
  return (
    <ImageOverlay
      key={target}
      url={scanOverlayUrl(target)}
      bounds={SCAN_OVERLAY_BOUNDS}
      opacity={opacity}
      className="purr-scan-overlay"
      zIndex={20}
    />
  );
}
