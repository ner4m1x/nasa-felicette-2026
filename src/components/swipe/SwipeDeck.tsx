"use client";

/**
 * Orbital Swipe deck: a stack of 3 visible cards ranked for the configured mission.
 * Inputs: finger/mouse drag (SwipeCard), HISS / Skip / PURR buttons, and keyboard ← / ↓ / →
 * (only while the Swipe tab is visible and no dialog is open).
 * After each PURR/HISS the BreakdownSheet opens with Félicette's verdict vs the user's.
 * Phone: deck fills the tab. Desktop (≥ lg): phone-width deck + info panel beside it.
 */

import { AlertTriangle, Ban, RotateCcw, Settings2 } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { MissionBrief } from "@/components/configurator/MissionBrief";
import { FelicetteAvatar } from "@/components/felicette/FelicetteAvatar";
import { FelicetteHero } from "@/components/felicette/FelicetteHero";
import { ViewFilterNote } from "@/components/shell/ViewFilterNote";
import { TARGETS } from "@/data/targets";
import { useI18n } from "@/i18n/I18nProvider";
import type { RankedCard } from "@/lib/types";
import { strictSpecs } from "@/lib/rejections";
import { useMission } from "@/state/MissionContext";
import { useSwipe } from "@/state/SwipeContext";
import { STACK } from "@/theme/tokens";
import { BreakdownSheet, type Decision } from "./BreakdownSheet";
import { RejectedPile } from "./RejectedPile";
import { SwipeCard, type SwipeAction, type SwipeCardHandle } from "./SwipeCard";
import { KeyboardHint, SwipeControls } from "./SwipeControls";

interface SwipeDeckProps {
  /** the Swipe tab is visible (keyboard shortcuts are live only then) */
  active: boolean;
  onReconfigure: () => void;
}

const KEY_ACTIONS: Record<string, SwipeAction> = { ArrowRight: "purr", ArrowLeft: "hiss", ArrowDown: "skip" };

function isTypingTarget(el: EventTarget | null): boolean {
  if (!(el instanceof HTMLElement)) return false;
  return el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName) || !!el.closest("[role=tablist],[role=radiogroup],[role=slider]");
}

export function SwipeDeck({ active, onReconfigure }: SwipeDeckProps) {
  const { t } = useI18n();
  const { config } = useMission();
  const swipe = useSwipe();
  const topCard = useRef<SwipeCardHandle>(null);
  const [decision, setDecision] = useState<Decision | null>(null);
  const [rejectedOpen, setRejectedOpen] = useState(false);

  const visible = swipe.queue.slice(0, STACK.visible);
  const total = swipe.visible?.deck.length ?? 0;
  const rejected = swipe.visible?.rejected ?? [];
  const strict = strictSpecs(total, rejected.length);
  const purrs = swipe.records.filter((r) => r.verdict === "purr").length;

  const onDone = (ranked: RankedCard, action: SwipeAction) => {
    if (action === "skip") {
      swipe.skip(ranked.card.id);
      return;
    }
    const verdict = swipe.verdictFor(ranked);
    const record = swipe.decide(ranked, action);
    setDecision({ ranked, record, verdict });
  };

  // Keyboard shortcuts (external system: window key events).
  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => {
      const action = KEY_ACTIONS[e.key];
      if (!action || e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
      if (document.querySelector("dialog[open]") || isTypingTarget(e.target)) return;
      if (!topCard.current) return;
      e.preventDefault();
      topCard.current.fling(action);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [active]);

  const agreementLine =
    swipe.agreement.ratio === null
      ? t("breakdown.agreementNone")
      : t("breakdown.agreement", {
          agreed: swipe.agreement.agreed,
          counted: swipe.agreement.counted,
          pct: Math.round(swipe.agreement.ratio * 100),
        });

  const rejectedButton = (className = "") => (
    <button
      type="button"
      onClick={() => setRejectedOpen(true)}
      aria-haspopup="dialog"
      className={`flex min-h-11 items-center justify-center gap-1.5 rounded-control border border-hiss/50 px-3 text-xs font-bold uppercase tracking-wider text-hiss hover:bg-hiss/10 ${className}`}
    >
      <Ban aria-hidden size={14} />
      {t("deck.rejectedButton", { n: rejected.length })}
    </button>
  );

  const reconfigureButton = (className = "", compact = false) => (
    <button
      type="button"
      onClick={onReconfigure}
      aria-label={compact ? t("config.reconfigure") : undefined}
      className={`flex min-h-11 min-w-11 items-center justify-center gap-2 rounded-control border border-amber/60 px-2 text-xs font-bold uppercase tracking-wider text-amber hover:bg-amber/10 ${className}`}
    >
      {compact ? <Settings2 aria-hidden size={16} /> : <RotateCcw aria-hidden size={16} />}
      {!compact && t("config.reconfigure")}
    </button>
  );

  return (
    <div className="mx-auto flex h-full min-h-[600px] max-w-6xl flex-col gap-3 px-3 pb-3 pt-3 lg:grid lg:min-h-0 lg:grid-cols-[var(--deck-desktop-width)_360px] lg:justify-center lg:gap-8 lg:p-6">
      {/* ---- Deck column ---- */}
      <div className="flex min-h-0 flex-1 flex-col gap-3 lg:max-h-[800px]">
        <div className="flex items-center gap-2">
          <div className="min-w-0 flex-1">
            <p className="truncate text-[11px] font-bold uppercase tracking-wider text-amber">
              {t(TARGETS[config.target].catKey)}
            </p>
            <p className="truncate text-[10px] tabular-nums text-dim">
              {swipe.status === "ready" && total > 0 && t("deck.progress", { left: swipe.queue.length, total })}
              {swipe.status === "ready" && total > 0 && (
                <span className="hidden sm:inline">
                  {" · "}
                  {t("deck.stats", { purr: purrs, hiss: swipe.records.length - purrs })}
                </span>
              )}
            </p>
          </div>
          {rejectedButton("lg:hidden")}
          {reconfigureButton("lg:hidden", true)}
        </div>

        {strict.show && (
          <button
            type="button"
            onClick={() => setRejectedOpen(true)}
            aria-haspopup="dialog"
            className="flex min-h-9 items-center gap-2 self-start rounded-pill border border-amber/60 px-3 text-left text-[11px] font-bold leading-tight text-amber hover:bg-amber/10"
          >
            <AlertTriangle aria-hidden size={13} className="shrink-0" />
            {t("deck.strict.chip", { x: strict.rejected, y: strict.total })}
          </button>
        )}

        {swipe.hideIce && <ViewFilterNote byDefault={swipe.hideIceByDefault} onClear={() => swipe.setHideIce(false)} />}

        {swipe.notice && (
          <p role="status" className="rounded-control border border-amber/50 px-3 py-2 text-xs text-amber">
            {t(swipe.notice)}
          </p>
        )}

        <div
          role="region"
          aria-label={t("deck.stackAria")}
          className="relative mb-7 min-h-[380px] flex-1"
        >
          {swipe.status === "loading" && (
            <Panel title={t("deck.loading")}>
              <FelicetteAvatar mood="thinking" className="order-first h-20 w-20" />
            </Panel>
          )}
          {swipe.status === "error" && <Panel title={t("deck.loadError", { error: swipe.error ?? "" })} tone="danger" />}
          {swipe.status === "ready" && total === 0 && (
            <Panel title={t("deck.emptyTitle")} body={t("deck.emptyBody")}>
              {rejectedButton()}
            </Panel>
          )}
          {swipe.status === "ready" && total > 0 && visible.length === 0 && (
            <Panel title={t("deck.doneTitle")} body={t("deck.doneBody")}>
              <p className="text-xs tabular-nums text-dim">{agreementLine}</p>
              <button
                type="button"
                onClick={swipe.reset}
                className="flex min-h-11 items-center justify-center gap-2 rounded-control border border-phosphor/60 px-4 text-xs font-bold uppercase tracking-wider text-phosphor hover:bg-phosphor/10"
              >
                <RotateCcw aria-hidden size={14} />
                {t("deck.restart")}
              </button>
            </Panel>
          )}
          {visible
            .map((ranked, depth) => (
              <SwipeCard
                key={ranked.card.id}
                ref={depth === 0 ? topCard : undefined}
                ranked={ranked}
                depth={depth}
                onDone={(action) => onDone(ranked, action)}
              />
            ))
            .reverse()}
        </div>

        <SwipeControls disabled={visible.length === 0} onAction={(a) => topCard.current?.fling(a)} />
        <p className="text-center text-[10px] text-dim">
          <span className="lg:hidden">{t("deck.dragHint")}</span>
          <KeyboardHint className="hidden lg:inline" />
        </p>
      </div>

      {/* ---- Desktop info panel ---- */}
      <aside className="hidden space-y-4 lg:block">
        <FelicetteHero key="launch" text={t("felicette.launch")} />
        <MissionBrief />
        <section className="space-y-1 rounded-control border border-line bg-panel p-3 text-xs">
          <p className="tabular-nums">{t("deck.stats", { purr: purrs, hiss: swipe.records.length - purrs })}</p>
          <p className="tabular-nums text-dim">{agreementLine}</p>
        </section>
        {rejectedButton("w-full")}
        {reconfigureButton("w-full min-h-12")}
        <p className="text-[11px] leading-relaxed text-dim">
          <KeyboardHint />
        </p>
        <p className="text-[11px] leading-relaxed text-dim">{t("config.shareHint")}</p>
      </aside>

      <BreakdownSheet decision={decision} agreement={swipe.agreement} onClose={() => setDecision(null)} />
      <RejectedPile open={rejectedOpen} onClose={() => setRejectedOpen(false)} rejected={rejected} />
    </div>
  );
}

function Panel({
  title,
  body,
  tone = "default",
  children,
}: {
  title: string;
  body?: string;
  tone?: "default" | "danger";
  children?: ReactNode;
}) {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 rounded-card border border-line bg-panel p-6 text-center">
      <p className={`text-sm font-bold uppercase tracking-wider ${tone === "danger" ? "text-danger" : "text-phosphor"}`}>
        {title}
      </p>
      {body && <p className="max-w-xs text-xs leading-relaxed text-dim">{body}</p>}
      {children}
    </div>
  );
}
