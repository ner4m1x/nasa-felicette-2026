"use client";

// Phase 3 stub — the real state, persistence and URL sync come later.
import { createContext, useContext, type ReactNode } from "react";

const MissionContext = createContext<null>(null);

export function MissionProvider({ children }: { children: ReactNode }) {
  return <MissionContext.Provider value={null}>{children}</MissionContext.Provider>;
}

export function useMission(): null {
  return useContext(MissionContext);
}
