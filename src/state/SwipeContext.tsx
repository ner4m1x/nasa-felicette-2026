"use client";

/**
 * Orbital Swipe state (Phase 5).
 * - Loads the deck once (src/lib/deck.ts) and ranks it with the current mission (rankDeck).
 * - Keeps the user's PURR/HISS records per mission (a different mission = a different deck and
 *   different recommendations), persisted to localStorage (try/catch).
 * - Skipped cards move to the back of the queue (in memory only).
 * - Every record stores Félicette's recommendation at swipe time, for the agreement score.
 *
 * Reads localStorage on its first render, so it opts into browser-only rendering with
 * `use(browser())` (it already sits under the <Suspense> boundary of src/app/page.tsx).
 */

import { createContext, use, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { browser } from "react-dom";
import { loadDeck, withGridCards, type DeckLoadResult } from "@/lib/deck";
import { applyIceFilter } from "@/lib/mapPins";
import { rankDeck } from "@/lib/ranking";
import type { MissionConfig, RankedCard, RankedDeck } from "@/lib/types";
import {
  agreementScore,
  felicetteVerdict,
  type Agreement,
  type FelicetteVerdict,
  type SwipeRecord,
  type Verdict,
} from "@/lib/verdict";
import { useMission } from "./MissionContext";
import { useScanGrid } from "./usePipeline";

export const SWIPES_STORAGE_KEY = "purr.swipes";

type DeckState =
  | { status: "loading" }
  | { status: "ready"; result: DeckLoadResult }
  | { status: "error"; message: string };

type RecordsByMission = Record<string, SwipeRecord[]>;

export function missionKey(config: MissionConfig): string {
  return [config.target, config.footprint, config.mobility, config.crew].join("|");
}

interface SwipeValue {
  status: DeckState["status"];
  error: string | null;
  isFixture: boolean;
  notice: DeckLoadResult["notice"];
  /** the ranked deck for the current mission (null while loading), unfiltered */
  ranked: RankedDeck | null;
  /** `ranked` after the display-only view filter (what the deck and the map show) */
  visible: RankedDeck | null;
  /** display filter: hide ice-sheet candidates (never changes scores) */
  hideIce: boolean;
  setHideIce: (v: boolean) => void;
  /** cards still to judge, in order (skipped cards at the back) */
  queue: RankedCard[];
  /** PURR/HISS records for the current mission, in swipe order */
  records: SwipeRecord[];
  agreement: Agreement;
  verdictFor: (card: RankedCard) => FelicetteVerdict;
  /** Record a swipe and return it (with Félicette's recommendation). */
  decide: (card: RankedCard, verdict: Verdict) => SwipeRecord;
  skip: (cardId: string) => void;
  /** Clear the current mission's records and skips. */
  reset: () => void;
}

const SwipeContext = createContext<SwipeValue | null>(null);

function isRecord(v: unknown): v is SwipeRecord {
  if (typeof v !== "object" || v === null) return false;
  const r = v as Record<string, unknown>;
  return (
    typeof r.cardId === "string" &&
    (r.verdict === "purr" || r.verdict === "hiss") &&
    (r.recommendation === "purr" || r.recommendation === "hiss" || r.recommendation === "abstain")
  );
}

function readStoredRecords(): RecordsByMission {
  try {
    const raw = window.localStorage.getItem(SWIPES_STORAGE_KEY);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) return {};
    const out: RecordsByMission = {};
    for (const [key, list] of Object.entries(parsed)) {
      if (Array.isArray(list)) out[key] = list.filter(isRecord);
    }
    return out;
  } catch {
    return {};
  }
}

export function SwipeProvider({ children }: { children: ReactNode }) {
  use(browser("Swipe records are stored in localStorage."));
  const { config } = useMission();
  const [deck, setDeck] = useState<DeckState>({ status: "loading" });
  const [byMission, setByMission] = useState<RecordsByMission>(readStoredRecords);
  const [skippedByMission, setSkippedByMission] = useState<Record<string, string[]>>({});

  // Load the deck once (external system: network / bundled fixture).
  useEffect(() => {
    let cancelled = false;
    loadDeck().then(
      (result) => !cancelled && setDeck({ status: "ready", result }),
      (e: unknown) => !cancelled && setDeck({ status: "error", message: e instanceof Error ? e.message : String(e) }),
    );
    return () => {
      cancelled = true;
    };
  }, []);

  // Persist records (external system: localStorage).
  useEffect(() => {
    try {
      window.localStorage.setItem(SWIPES_STORAGE_KEY, JSON.stringify(byMission));
    } catch {
      // storage blocked: records still live for this session
    }
  }, [byMission]);

  const key = missionKey(config);
  const records = useMemo(() => byMission[key] ?? [], [byMission, key]);
  const skipped = useMemo(() => skippedByMission[key] ?? [], [skippedByMission, key]);

  // Grid-built curated cards (Hammaguir) join the deck once the scan grid is loaded.
  const grid = useScanGrid(true);
  const cards = useMemo(() => {
    if (deck.status !== "ready") return null;
    return grid?.status === "ready" ? withGridCards(deck.result.cards, grid.grid) : deck.result.cards;
  }, [deck, grid]);

  const ranked = useMemo(() => (cards ? rankDeck(cards, config) : null), [cards, config]);
  const [hideIce, setHideIce] = useState(false);
  const visible = useMemo(() => (ranked ? applyIceFilter(ranked, hideIce) : null), [ranked, hideIce]);

  const queue = useMemo(() => {
    if (!visible) return [];
    const decided = new Set(records.map((r) => r.cardId));
    const open = visible.deck.filter((r) => !decided.has(r.card.id));
    const skipOrder = new Map(skipped.map((id, i) => [id, i]));
    const fresh = open.filter((r) => !skipOrder.has(r.card.id));
    const later = open
      .filter((r) => skipOrder.has(r.card.id))
      .sort((a, b) => skipOrder.get(a.card.id)! - skipOrder.get(b.card.id)!);
    return [...fresh, ...later];
  }, [visible, records, skipped]);

  const verdictFor = useCallback((card: RankedCard) => felicetteVerdict(card, config), [config]);

  const decide = useCallback(
    (card: RankedCard, verdict: Verdict): SwipeRecord => {
      const record: SwipeRecord = {
        cardId: card.card.id,
        verdict,
        recommendation: felicetteVerdict(card, config).recommendation,
      };
      setByMission((prev) => {
        const list = (prev[key] ?? []).filter((r) => r.cardId !== record.cardId);
        return { ...prev, [key]: [...list, record] };
      });
      setSkippedByMission((prev) => ({ ...prev, [key]: (prev[key] ?? []).filter((id) => id !== record.cardId) }));
      return record;
    },
    [config, key],
  );

  const skip = useCallback(
    (cardId: string) =>
      setSkippedByMission((prev) => ({ ...prev, [key]: [...(prev[key] ?? []).filter((id) => id !== cardId), cardId] })),
    [key],
  );

  const reset = useCallback(() => {
    setByMission((prev) => ({ ...prev, [key]: [] }));
    setSkippedByMission((prev) => ({ ...prev, [key]: [] }));
  }, [key]);

  const value = useMemo<SwipeValue>(
    () => ({
      status: deck.status,
      error: deck.status === "error" ? deck.message : null,
      isFixture: deck.status === "ready" && deck.result.isFixture,
      notice: deck.status === "ready" ? deck.result.notice : null,
      ranked,
      visible,
      hideIce,
      setHideIce,
      queue,
      records,
      agreement: agreementScore(records),
      verdictFor,
      decide,
      skip,
      reset,
    }),
    [deck, ranked, visible, hideIce, queue, records, verdictFor, decide, skip, reset],
  );

  return <SwipeContext.Provider value={value}>{children}</SwipeContext.Provider>;
}

export function useSwipe(): SwipeValue {
  const ctx = useContext(SwipeContext);
  if (!ctx) throw new Error("useSwipe must be used inside <SwipeProvider>");
  return ctx;
}
