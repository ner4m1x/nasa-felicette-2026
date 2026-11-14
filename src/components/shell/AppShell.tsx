"use client";

/**
 * App shell: TopBar, three tab panels (Swipe | Map | Report) and the phone bottom nav.
 * - Full-height (100dvh) layout; only the active panel's content scrolls, so nothing jumps.
 * - Panels stay mounted and are hidden, so the map (Phase 6) is never remounted.
 * - On desktop (≥ lg) the bottom nav becomes a tab bar inside the TopBar.
 */

import { AnimatePresence, motion, MotionConfig } from "framer-motion";
import { FileText, Map as MapIcon, Radar, RotateCcw, type LucideIcon } from "lucide-react";
import { useState } from "react";
import { MissionBrief } from "@/components/configurator/MissionBrief";
import { MissionConfigurator } from "@/components/configurator/MissionConfigurator";
import { FelicetteSays } from "@/components/felicette/FelicetteSays";
import { useI18n } from "@/i18n/I18nProvider";
import type { I18nKey } from "@/i18n/types";
import { useMission } from "@/state/MissionContext";
import { BottomNav, TAB_IDS, type TabId } from "./BottomNav";
import { EarthLimitsSheet } from "./EarthLimitsSheet";
import { TopBar } from "./TopBar";

export function AppShell() {
  const [tab, setTab] = useState<TabId>("swipe");
  const [limitsOpen, setLimitsOpen] = useState(false);

  return (
    <MotionConfig reducedMotion="user">
      <div className="flex h-dvh flex-col overflow-hidden">
        <TopBar activeTab={tab} onSelectTab={setTab} onOpenLimits={() => setLimitsOpen(true)} />

        <main className="relative min-h-0 flex-1 pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)]">
          {TAB_IDS.map((id) => (
            <section key={id} id={`panel-${id}`} hidden={tab !== id} className="h-full overflow-y-auto">
              {id === "swipe" && <SwipeTab />}
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
function SwipeTab() {
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
          <DeckDock onReconfigure={() => setLaunched(false)} />
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

/**
 * Where the Orbital Swipe deck (Phase 5) will dock: phone-width column + info panel on desktop.
 * For now it shows the scan animation, the mission brief and a way back to the configurator.
 */
function DeckDock({ onReconfigure }: { onReconfigure: () => void }) {
  const { t } = useI18n();
  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-4 p-4 lg:grid lg:grid-cols-[440px_360px] lg:justify-center lg:gap-8 lg:p-6">
      <FelicetteSays key="launch" text={t("felicette.launch")} className="lg:hidden" />

      <div className="relative flex aspect-[3/4] max-h-[60dvh] w-full flex-col items-center justify-center gap-4 overflow-hidden rounded-2xl border border-line bg-panel p-6 text-center lg:max-h-none">
        <motion.span
          aria-hidden
          className="absolute inset-x-0 top-0 h-16 bg-gradient-to-b from-phosphor/0 via-phosphor/15 to-phosphor/0"
          initial={{ y: "-100%" }}
          animate={{ y: "700%" }}
          transition={{ duration: 2.2, ease: "linear", repeat: Infinity, repeatDelay: 0.6 }}
        />
        <Radar aria-hidden size={56} className="text-phosphor" />
        <p className="max-w-xs text-sm text-dim">{t("felicette.deckDocking")}</p>
      </div>

      <aside className="space-y-4">
        <FelicetteSays key="launch" text={t("felicette.launch")} className="hidden lg:flex" />
        <MissionBrief />
        <button
          type="button"
          onClick={onReconfigure}
          className="flex min-h-12 w-full items-center justify-center gap-2 rounded-lg border border-amber/60 text-sm font-bold uppercase tracking-wider text-amber hover:bg-amber/10"
        >
          <RotateCcw aria-hidden size={16} />
          {t("config.reconfigure")}
        </button>
        <p className="text-[11px] leading-relaxed text-dim">{t("config.shareHint")}</p>
      </aside>
    </div>
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
