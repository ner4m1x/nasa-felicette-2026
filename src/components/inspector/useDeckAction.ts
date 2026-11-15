"use client";

import { useCallback, useMemo } from "react";
import { deckActionState, type DeckActionState } from "@/lib/deckAction";
import type { ScanGrid, ScanGridSample } from "@/lib/scanGrid";
import type { MissionConfig } from "@/lib/types";
import { createUserCard } from "@/lib/userCards";
import { useSwipe } from "@/state/SwipeContext";

/** Add/remove the clicked cell as a user card; `state` drives every Add-to-deck control. */
export function useDeckAction(
  point: { lat: number; lon: number } | null,
  grid: ScanGrid | null,
  sample: ScanGridSample | null,
  config: MissionConfig,
): { state: DeckActionState; add: () => void; remove: () => void } {
  const swipe = useSwipe();

  const state = useMemo(() => {
    const ids = new Set(swipe.userCards.map((c) => c.id));
    const rejected = new Set((swipe.ranked?.rejected ?? []).map((r) => r.card.id));
    return deckActionState(sample, config.target, ids, rejected);
  }, [swipe.userCards, swipe.ranked, sample, config.target]);

  const add = useCallback(() => {
    if (!point || !grid || state.kind !== "add") return;
    const regions = [...(swipe.ranked?.deck ?? []), ...(swipe.ranked?.rejected ?? [])].map((r) => r.card);
    const card = createUserCard(grid, point.lat, point.lon, regions);
    if (card) swipe.addUserCard(card);
  }, [point, grid, state.kind, swipe]);

  const remove = useCallback(() => {
    if (state.kind === "inDeck") swipe.removeUserCard(state.id);
  }, [state, swipe]);

  return { state, add, remove };
}
