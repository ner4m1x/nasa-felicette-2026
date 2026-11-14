"use client";

/**
 * App shell: TopBar, three tab panels (Swipe | Map | Report) and the phone bottom nav.
 * - Full-height (100dvh) layout; only the active panel's content scrolls, so nothing jumps.
 * - Panels stay mounted and are hidden, so the map (Phase 6) is never remounted.
 * - On desktop (≥ lg) the bottom nav becomes a tab bar inside the TopBar.
 * - The red FixtureBanner shows whenever the loaded deck is dev fixture data (ground rule 2).
 */

import { AnimatePresence, motion, MotionConfig } from "framer-motion";
import { FileText, Map as MapIcon, type LucideIcon } from "lucide-react";
import { useState } from "react";
import { MissionConfigurator } from "@/components/configurator/MissionConfigurator";
import { SwipeDeck } from "@/components/swipe/SwipeDeck";
import { useI18n } from "@/i18n/I18nProvider";
import type { I18nKey } from "@/i18n/types";
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
            <section key={id} id={`panel-${id}`} hidden={tab !== id} className="h-full overflow-y-auto">
              {id === "swipe" && <SwipeTab active={tab === "swipe"} />}
              {id === "map" && <TabPlaceholder Icon={MapIcon} textKey="tabs.mapOffline" />}
              {id === "report" && <TabPlaceholder Icon={FileText} textKey="tabs.reportOffline" />}
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

function TabPlaceholder({ Icon, textKey }: { Icon: LucideIcon; textKey: I18nKey }) {
  const { t } = useI18n();
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center text-dim">
      <Icon aria-hidden size={40} className="text-line" />
      <p className="cursor-blink max-w-xs text-sm">{t(textKey)}</p>
    </div>
  );
}
