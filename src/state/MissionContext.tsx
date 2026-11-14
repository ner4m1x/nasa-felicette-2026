"use client";

/**
 * Mission configuration state (Phase 3).
 * - Source of the initial value: URL query (shared link) > localStorage > DEFAULT_MISSION.
 * - Every change is mirrored to localStorage (try/catch) and to the URL query via
 *   `history.replaceState`, so the current address is always a shareable link.
 * - Reads browser state during the first render, so it opts into browser-only rendering
 *   with `use(browser())` and must sit under a <Suspense> boundary.
 *
 * This state only drives Mission Fit. It never changes the Analog Score.
 */

import { createContext, use, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { browser } from "react-dom";
import { DEFAULT_MISSION } from "@/data/missionOptions";
import type { MissionConfig } from "@/lib/types";
import {
  parseMissionQuery,
  parseStoredMission,
  resolveInitialMission,
  withMissionQuery,
} from "./missionQuery";

export const MISSION_STORAGE_KEY = "purr.mission";

interface MissionValue {
  config: MissionConfig;
  /** Merge a partial change into the config. */
  update: (patch: Partial<MissionConfig>) => void;
  /** true when the page was opened from a link that carried a complete mission */
  fromLink: boolean;
  /** the user pressed "Launch scan" (the Swipe tab shows the deck instead of the configurator) */
  launched: boolean;
  setLaunched: (launched: boolean) => void;
}

const MissionContext = createContext<MissionValue | null>(null);

function readStored(): Partial<MissionConfig> {
  try {
    const raw = window.localStorage.getItem(MISSION_STORAGE_KEY);
    return raw ? parseStoredMission(JSON.parse(raw)) : {};
  } catch {
    return {};
  }
}

function readInitial() {
  return resolveInitialMission(
    parseMissionQuery(new URLSearchParams(window.location.search)),
    readStored(),
    DEFAULT_MISSION,
  );
}

export function MissionProvider({ children }: { children: ReactNode }) {
  use(browser("The mission config is read from the URL query and localStorage."));
  const [initial] = useState(readInitial);
  const [config, setConfig] = useState<MissionConfig>(initial.config);
  const [launched, setLaunched] = useState(false);

  const update = useCallback((patch: Partial<MissionConfig>) => {
    setConfig((prev) => ({ ...prev, ...patch }));
  }, []);

  // Sync external systems (localStorage + address bar) with the config.
  useEffect(() => {
    try {
      window.localStorage.setItem(MISSION_STORAGE_KEY, JSON.stringify(config));
    } catch {
      // storage blocked: the URL still carries the mission
    }
    const url = new URL(window.location.href);
    const query = withMissionQuery(url.searchParams, config).toString();
    if (url.search !== `?${query}`) {
      window.history.replaceState(window.history.state, "", `${url.pathname}?${query}${url.hash}`);
    }
  }, [config]);

  const value = useMemo<MissionValue>(
    () => ({ config, update, fromLink: initial.fromLink, launched, setLaunched }),
    [config, update, initial.fromLink, launched],
  );

  return <MissionContext.Provider value={value}>{children}</MissionContext.Provider>;
}

export function useMission(): MissionValue {
  const ctx = useContext(MissionContext);
  if (!ctx) throw new Error("useMission must be used inside <MissionProvider>");
  return ctx;
}
