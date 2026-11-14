"use client";

// Phase 5 stub — the real state, persistence and URL sync come later.
import { createContext, useContext, type ReactNode } from "react";

const SwipeContext = createContext<null>(null);

export function SwipeProvider({ children }: { children: ReactNode }) {
  return <SwipeContext.Provider value={null}>{children}</SwipeContext.Provider>;
}

export function useSwipe(): null {
  return useContext(SwipeContext);
}
