"use client";

/**
 * Hooks for the optional pipeline files in /public/data. Each loader is memoised at module level
 * (one request per file per page load), so any number of components can call these hooks.
 * `undefined` = still loading; `null` = not published.
 */

import { useEffect, useState } from "react";
import { loadManifest, type Manifest } from "@/lib/manifest";
import { loadScanGrid, overlayExists, type ScanGridState } from "@/lib/scanGrid";
import type { TargetId } from "@/lib/types";
import { loadValidationReport, type ValidationReport } from "@/lib/validationReport";
import { loadSensitivityReport, type SensitivityReport } from "@/lib/sensitivityReport";

function useLoader<T>(load: (() => Promise<T>) | null): T | undefined {
  const [state, setState] = useState<{ load: (() => Promise<T>) | null; value: T | undefined }>({
    load,
    value: undefined,
  });
  // Reset when the loader changes (render-time adjustment, not an effect).
  if (state.load !== load) setState({ load, value: undefined });

  // Subscribe to an external system (network).
  useEffect(() => {
    if (!load) return;
    let cancelled = false;
    load().then((value) => !cancelled && setState({ load, value }));
    return () => {
      cancelled = true;
    };
  }, [load]);

  return state.load === load ? state.value : undefined;
}

export function useManifest(): Manifest | null | undefined {
  return useLoader(loadManifest);
}

export function useValidationReport(): ValidationReport | null | undefined {
  return useLoader(loadValidationReport);
}

export function useSensitivityReport(): SensitivityReport | null | undefined {
  return useLoader(loadSensitivityReport);
}

/** Loads the grid only once `enabled` (e.g. the map tab has been opened). */
export function useScanGrid(enabled: boolean): ScanGridState | undefined {
  return useLoader(enabled ? loadScanGrid : null);
}

const overlayChecks = new Map<TargetId, Promise<boolean>>();
const overlayLoaders = new Map<TargetId, () => Promise<boolean>>();

function overlayLoader(target: TargetId): () => Promise<boolean> {
  let fn = overlayLoaders.get(target);
  if (!fn) {
    fn = () => {
      let p = overlayChecks.get(target);
      if (!p) {
        p = overlayExists(target);
        overlayChecks.set(target, p);
      }
      return p;
    };
    overlayLoaders.set(target, fn);
  }
  return fn;
}

/** HEAD-checks /data/scan_{target}.png once per target. */
export function useOverlayAvailable(target: TargetId): boolean | undefined {
  return useLoader(overlayLoader(target));
}
