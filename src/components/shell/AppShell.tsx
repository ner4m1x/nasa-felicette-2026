"use client";

/**
 * App shell: TopBar, three tab panels (Swipe | Map | Report) and the phone bottom nav.
 * - Full-height (100dvh) layout; only the active panel's content scrolls, so nothing jumps.
 * - Panels stay mounted and are hidden, so the map is never remounted (it is created on the first
 *   visit to the Map tab and re-measured whenever the tab becomes visible again).
 * - On desktop (≥ lg) the bottom nav becomes a tab bar inside the TopBar.
 * - The red FixtureBanner shows whenever the loaded deck is dev fixture data (ground rule 2).
 * - About & credits (AboutSheet): opened from the Report tab, and from a small footer on desktop.
 */

import { AnimatePresence, motion, MotionConfig } from "framer-motion";
import { useState } from "react";
import { MissionConfigurator } from "@/components/configurator/MissionConfigurator";
import { MapClient } from "@/components/map/MapClient";
import { MissionReport } from "@/components/report/MissionReport";
import { SwipeDeck } from "@/components/swipe/SwipeDeck";
import { useI18n } from "@/i18n/I18nProvider";
import { useMission } from "@/state/MissionContext";
import { useSwipe } from "@/state/SwipeContext";
import { BottomNav, TAB_IDS, type TabId } from "./BottomNav";
import { AboutSheet } from "./AboutSheet";
import { EarthLimitsSheet } from "./EarthLimitsSheet";
import { FixtureBanner } from "./FixtureBanner";
import { TopBar } from "./TopBar";

export function AppShell() {
  const [tab, setTab] = useState<TabId>("swipe");
  const [limitsOpen, setLimitsOpen] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);
  const { t } = useI18n();
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
              {id === "report" && <MissionReport onGoToSwipe={() => setTab("swipe")} onOpenAbout={() => setAboutOpen(true)} />}
            </section>
          ))}
        </main>

        <BottomNav variant="bottom" active={tab} onSelect={setTab} />
        {/* desktop footer: About & credits + AI disclosure (phones reach it from the Report tab) */}
        <footer className="hidden shrink-0 items-center justify-end gap-3 border-t border-line bg-panel px-6 py-1 text-[10px] text-dim lg:flex">
          {(["about.aiTitle", "about.link"] as const).map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => setAboutOpen(true)}
              className="min-h-6 uppercase tracking-wider underline decoration-dotted underline-offset-2 hover:text-phosphor"
            >
              {t(key)}
            </button>
          ))}
        </footer>
        <EarthLimitsSheet open={limitsOpen} onClose={() => setLimitsOpen(false)} />
        <AboutSheet open={aboutOpen} onClose={() => setAboutOpen(false)} />
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
