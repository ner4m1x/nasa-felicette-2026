"use client";

import { FileText, Layers, Map as MapIcon, type LucideIcon } from "lucide-react";
import { useI18n } from "@/i18n/I18nProvider";
import type { I18nKey } from "@/i18n/types";

export const TAB_IDS = ["swipe", "map", "report"] as const;
export type TabId = (typeof TAB_IDS)[number];

const TABS: Record<TabId, { labelKey: I18nKey; Icon: LucideIcon }> = {
  swipe: { labelKey: "nav.swipe", Icon: Layers },
  map: { labelKey: "nav.map", Icon: MapIcon },
  report: { labelKey: "nav.report", Icon: FileText },
};

interface BottomNavProps {
  active: TabId;
  onSelect: (tab: TabId) => void;
  /** "bottom" = phone bar (hidden ≥ lg); "top" = desktop tab bar inside the TopBar (hidden < lg) */
  variant: "bottom" | "top";
}

/** Main navigation: Swipe | Map | Report. Tap targets ≥ 44 px, active tab clearly marked. */
export function BottomNav({ active, onSelect, variant }: BottomNavProps) {
  const { t } = useI18n();

  if (variant === "top") {
    return (
      <nav aria-label={t("nav.aria")} className="hidden lg:block">
        <ul className="flex gap-1">
          {TAB_IDS.map((id) => {
            const { labelKey, Icon } = TABS[id];
            const isActive = id === active;
            return (
              <li key={id}>
                <button
                  type="button"
                  aria-current={isActive ? "page" : undefined}
                  onClick={() => onSelect(id)}
                  className={`flex min-h-11 items-center gap-2 rounded-md border px-4 text-sm uppercase tracking-wider transition-colors ${
                    isActive
                      ? "border-phosphor bg-phosphor/10 text-phosphor"
                      : "border-transparent text-dim hover:border-line hover:text-fg"
                  }`}
                >
                  <Icon aria-hidden size={16} />
                  {t(labelKey)}
                </button>
              </li>
            );
          })}
        </ul>
      </nav>
    );
  }

  return (
    <nav
      aria-label={t("nav.aria")}
      className="border-t border-line bg-panel pb-[env(safe-area-inset-bottom)] pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)] lg:hidden"
    >
      <ul className="grid grid-cols-3">
        {TAB_IDS.map((id) => {
          const { labelKey, Icon } = TABS[id];
          const isActive = id === active;
          return (
            <li key={id}>
              <button
                type="button"
                aria-current={isActive ? "page" : undefined}
                onClick={() => onSelect(id)}
                className={`relative flex min-h-14 w-full flex-col items-center justify-center gap-0.5 text-[11px] uppercase tracking-wider transition-colors ${
                  isActive ? "text-phosphor" : "text-dim active:text-fg"
                }`}
              >
                <span
                  aria-hidden
                  className={`absolute inset-x-6 top-0 h-0.5 rounded-b ${isActive ? "bg-phosphor" : "bg-transparent"}`}
                />
                <Icon aria-hidden size={22} strokeWidth={isActive ? 2.25 : 1.75} />
                {t(labelKey)}
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
