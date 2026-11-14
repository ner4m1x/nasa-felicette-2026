"use client";

// Phase 1 stub of the app shell. Phase 2 adds the layout, tabs (Swipe | Map | Report) and styling.

import { useI18n } from "@/i18n/I18nProvider";
import { BottomNav } from "./BottomNav";
import { TopBar } from "./TopBar";

export function AppShell() {
  const { t } = useI18n();
  return (
    <div className="flex min-h-dvh flex-col">
      <TopBar />
      <main className="flex flex-1 flex-col items-center justify-center gap-2 p-4 font-mono">
        <h1 className="text-xl font-bold">{t("app.title")}</h1>
        <p className="text-sm opacity-80">{t("app.subtitle")}</p>
      </main>
      <BottomNav />
    </div>
  );
}
