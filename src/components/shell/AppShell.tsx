"use client";

/**
 * App shell: TopBar, three tab panels (Swipe | Map | Report) and the phone bottom nav.
 * - Full-height (100dvh) layout; only the active panel's content scrolls, so nothing jumps.
 * - Panels stay mounted and are hidden, so the map is never remounted (it is created on the first
 *   visit to the Map tab and re-measured whenever the tab becomes visible again).
 * - On desktop (≥ lg) the bottom nav becomes a tab bar inside the TopBar.
 * - The red FixtureBanner shows whenever the loaded deck is dev fixture data (ground rule 2).
 */

import { AnimatePresence, motion, MotionConfig } from "framer-motion";
import { useState } from "react";
import { MissionConfigurator } from "@/components/configurator/MissionConfigurator";
import { MapClient } from "@/components/map/MapClient";
import { MissionReport } from "@/components/report/MissionReport";
import { SwipeDeck } from "@/components/swipe/SwipeDeck";
import { useMission } from "@/state/MissionContext";
import { useSwipe } from "@/state/SwipeContext";
import { BottomNav, TAB_IDS, type TabId } from "./BottomNav";
import { EarthLimitsSheet } from "./EarthLimitsSheet";
import { FixtureBanner } from "./FixtureBanner";
import { TopBar } from "./TopBar";

export function AppShell() {
  const [tab, setTab] = useState<TabId>("swipe");
  const [limitsOpen, setLimitsOpen] = useState(false);
  const { isFixture } = useSwipe();

  return (
    <MotionConfig reducedMotion="user">
      <div className="flex h-dvh flex-col overflow-hidden">
        <TopBar activeTab={tab} onSelectTab={setTab} onOpenLimits={() => setLimitsOpen(true)} />
        <FixtureBanner visible={isFixture} />

        <main className="relative min-h-0 flex-1 pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)]">
          {TAB_IDS.map((id) => (
            <section
              key={id}
              id={`panel-${id}`}
              hidden={tab !== id}
              className={`h-full ${id === "map" ? "overflow-hidden" : "overflow-y-auto"}`}
            >
              {id === "swipe" && <SwipeTab active={tab === "swipe"} />}
              {id === "map" && <MapClient active={tab === "map"} />}
              {id === "report" && <MissionReport onGoToSwipe={() => setTab("swipe")} />}
            </section>
          ))}
        </main>

        <BottomNav variant="bottom" active={tab} onSelect={setTab} />
        <EarthLimitsSheet open={limitsOpen} onClose={() => setLimitsOpen(false)} />
      </div>
    </MotionConfig>
  );
}

/** Swipe tab: the configurator, then (after "Launch scan") the deck. */
function SwipeTab({ active }: { active: boolean }) {
  const { launched, setLaunched } = useMission();
  return (
    <AnimatePresence mode="wait" initial={false}>
      {launched ? (
        <motion.div
          key="deck"
          className="h-full"
          initial={{ opacity: 0, scale: 0.94, filter: "blur(6px)" }}
          animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
          exit={{ opacity: 0, y: 24 }}
          transition={{ duration: 0.45, ease: "easeOut" }}
        >
          <SwipeDeck active={active} onReconfigure={() => setLaunched(false)} />
        </motion.div>
      ) : (
        <motion.div
          key="configurator"
          className="h-full"
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, scale: 1.04, filter: "blur(6px)" }}
          transition={{ duration: 0.35, ease: "easeIn" }}
        >
          <MissionConfigurator onLaunch={() => setLaunched(true)} />
        </motion.div>
      )}
    </AnimatePresence>
  );
}
