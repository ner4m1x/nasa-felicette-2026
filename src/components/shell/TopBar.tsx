"use client";

import { ShieldAlert } from "lucide-react";
import { useI18n } from "@/i18n/I18nProvider";
import { BottomNav, type TabId } from "./BottomNav";
import { LangToggle } from "./LangToggle";

interface TopBarProps {
  activeTab: TabId;
  onSelectTab: (tab: TabId) => void;
  onOpenLimits: () => void;
}

export function TopBar({ activeTab, onSelectTab, onOpenLimits }: TopBarProps) {
  const { t } = useI18n();
  return (
    <header className="border-b border-line bg-panel pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)] pt-[env(safe-area-inset-top)]">
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-3 px-3 lg:h-16 lg:px-6">
        <div className="min-w-0 flex-1 lg:flex-none">
          <h1 className="cursor-blink text-glow truncate text-base font-bold tracking-widest text-phosphor lg:text-lg">
            <span className="sm:hidden">{t("app.short")}</span>
            <span className="hidden sm:inline">{t("app.title")}</span>
          </h1>
          <p className="hidden truncate text-[11px] text-dim sm:block">{t("app.subtitle")}</p>
        </div>

        <div className="hidden flex-1 justify-center lg:flex">
          <BottomNav variant="top" active={activeTab} onSelect={onSelectTab} />
        </div>

        <button
          type="button"
          onClick={onOpenLimits}
          aria-label={t("topbar.limitsAria")}
          aria-haspopup="dialog"
          className="flex min-h-11 min-w-11 items-center justify-center gap-2 rounded-md border border-amber/50 px-2 text-xs uppercase tracking-wider text-amber hover:bg-amber/10"
        >
          <ShieldAlert aria-hidden size={18} />
          <span className="hidden sm:inline">{t("topbar.limits")}</span>
        </button>
        <LangToggle />
      </div>
    </header>
  );
}
