"use client";

import { useCallback, useSyncExternalStore } from "react";

/** Subscribe to a CSS media query (external system: matchMedia). Server snapshot = false. */
export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const mql = window.matchMedia(query);
      mql.addEventListener("change", onChange);
      return () => mql.removeEventListener("change", onChange);
    },
    [query],
  );
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(query).matches,
    () => false,
  );
}

/** Tailwind `lg` breakpoint (64rem), where the desktop layouts start. */
export const DESKTOP_QUERY = "(min-width: 64rem)";
