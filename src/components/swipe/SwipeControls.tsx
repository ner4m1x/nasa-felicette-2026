"use client";

/** HISS / Skip / PURR buttons (accessible alternative to dragging; arrows ← ↓ → do the same). */

import { Cat, ChevronsDown, X } from "lucide-react";
import { useI18n } from "@/i18n/I18nProvider";
import type { SwipeAction } from "./SwipeCard";

interface SwipeControlsProps {
  disabled: boolean;
  onAction: (action: SwipeAction) => void;
}

export function SwipeControls({ disabled, onAction }: SwipeControlsProps) {
  const { t } = useI18n();
  const base =
    "flex min-h-12 items-center justify-center gap-2 rounded-control border-2 text-sm font-black uppercase tracking-widest transition-colors disabled:opacity-40";
  return (
    <div className="grid grid-cols-[1fr_auto_1fr] gap-3">
      <button
        type="button"
        disabled={disabled}
        onClick={() => onAction("hiss")}
        aria-label={t("swipe.hissAria")}
        aria-keyshortcuts="ArrowLeft"
        className={`${base} border-hiss text-hiss hover:bg-hiss/10`}
      >
        <X aria-hidden size={20} />
        {t("swipe.hiss")}
      </button>
      <button
        type="button"
        disabled={disabled}
        onClick={() => onAction("skip")}
        aria-label={t("swipe.skipAria")}
        aria-keyshortcuts="ArrowDown"
        className={`${base} min-w-12 border-line px-3 text-skip hover:bg-line/40`}
      >
        <ChevronsDown aria-hidden size={18} />
        <span className="sr-only sm:not-sr-only">{t("swipe.skip")}</span>
      </button>
      <button
        type="button"
        disabled={disabled}
        onClick={() => onAction("purr")}
        aria-label={t("swipe.purrAria")}
        aria-keyshortcuts="ArrowRight"
        className={`${base} border-purr text-purr hover:bg-purr/10`}
      >
        <Cat aria-hidden size={20} />
        {t("swipe.purr")}
      </button>
    </div>
  );
}

/** "Keys: [←] HISS · [→] PURR · [↓] Skip". Arrows use the system font: the terminal font draws them tiny. */
export function KeyboardHint({ className = "" }: { className?: string }) {
  const { t } = useI18n();
  const keys: [string, string][] = [
    ["←", t("swipe.hiss")],
    ["→", t("swipe.purr")],
    ["↓", t("swipe.skip")],
  ];
  return (
    <span className={className}>
      {t("deck.keysLabel")}:{" "}
      {keys.map(([k, label], i) => (
        <span key={k}>
          {i > 0 && " · "}
          <kbd className="rounded-control border border-line px-1 font-[system-ui] text-fg">{k}</kbd> {label}
        </span>
      ))}
    </span>
  );
}
