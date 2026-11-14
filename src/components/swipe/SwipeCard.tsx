"use client";

/**
 * One draggable card of the Orbital Swipe deck.
 * - Framer Motion drag="x": rotation follows the offset; PURR/HISS stamps fade in with distance.
 * - Release: commits on offset OR velocity (src/lib/swipe.ts), otherwise springs back.
 * - Touch: `touch-action: pan-y` on the card AND on the card body's scroll container (CardFace), plus
 *   dragDirectionLock: one-finger horizontal drag anywhere = swipe; vertical drag = scroll the body.
 * - Buttons and keyboard use the imperative `fling()` handle, so every input path animates alike.
 * All tuning values come from src/theme/tokens.ts.
 */

import {
  animate,
  motion,
  useMotionValue,
  useReducedMotion,
  useTransform,
  type MotionValue,
  type PanInfo,
} from "framer-motion";
import { useImperativeHandle, useRef, type Ref } from "react";
import { useI18n } from "@/i18n/I18nProvider";
import { swipeDecision } from "@/lib/swipe";
import type { RankedCard } from "@/lib/types";
import type { Verdict } from "@/lib/verdict";
import { FLY_OUT, SPRING_SNAP, STACK, SWIPE } from "@/theme/tokens";
import { CardFace } from "./CardFace";

export type SwipeAction = Verdict | "skip";

export interface SwipeCardHandle {
  fling: (action: SwipeAction) => void;
}

interface SwipeCardProps {
  ref?: Ref<SwipeCardHandle>;
  ranked: RankedCard;
  /** 0 = top card; 1, 2 = cards behind it */
  depth: number;
  onDone: (action: SwipeAction) => void;
}

const STAMP_FULL_PX = SWIPE.stampFullFraction * SWIPE.referenceWidthPx;

export function SwipeCard({ ref, ranked, depth, onDone }: SwipeCardProps) {
  const { t } = useI18n();
  const reduceMotion = useReducedMotion();
  const isTop = depth === 0;
  const el = useRef<HTMLDivElement>(null);
  const busy = useRef(false);

  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const opacity = useMotionValue(1);
  const rotate = useTransform(
    x,
    [-SWIPE.referenceWidthPx, 0, SWIPE.referenceWidthPx],
    [-SWIPE.maxRotateDeg, 0, SWIPE.maxRotateDeg],
  );
  const purrOpacity = useTransform(x, [0, STAMP_FULL_PX], [0, 1]);
  const hissOpacity = useTransform(x, [-STAMP_FULL_PX, 0], [1, 0]);

  const fling = (action: SwipeAction) => {
    if (busy.current) return;
    busy.current = true;
    const width = el.current?.offsetWidth ?? SWIPE.referenceWidthPx;
    const transition = reduceMotion ? { duration: 0 } : FLY_OUT;
    const finish = () => onDone(action);
    if (action === "skip") {
      animate(y, SWIPE.skipDropPx, transition);
      animate(opacity, 0, transition).then(finish);
    } else {
      const dir = action === "purr" ? 1 : -1;
      animate(x, dir * width * SWIPE.flyOutWidths, transition).then(finish);
    }
  };

  useImperativeHandle(ref, () => ({ fling }));

  const onDragEnd = (_: unknown, info: PanInfo) => {
    if (busy.current) return;
    const width = el.current?.offsetWidth ?? SWIPE.referenceWidthPx;
    const verdict = swipeDecision(info.offset.x, info.velocity.x, width);
    if (verdict) fling(verdict);
    else animate(x, 0, reduceMotion ? { duration: 0 } : SPRING_SNAP);
  };

  return (
    // Outer layer: position in the stack (scale / offset behind the top card).
    <motion.div
      className="absolute inset-0"
      style={{ zIndex: STACK.visible - depth }}
      initial={false}
      animate={{ scale: 1 - depth * STACK.scaleStep, y: depth * STACK.yStepPx }}
      transition={reduceMotion ? { duration: 0 } : SPRING_SNAP}
      aria-hidden={!isTop}
    >
      {/* Inner layer: the drag gesture. */}
      <motion.div
        ref={el}
        drag={isTop ? "x" : false}
        dragDirectionLock
        dragMomentum={false}
        onDragEnd={onDragEnd}
        style={{ x, y, rotate, opacity, touchAction: "pan-y" }}
        role="group"
        aria-roledescription="card"
        aria-label={t("swipe.cardAria", { name: ranked.card.name, kind: t(`kinds.${ranked.card.kind}`) })}
        className={`relative h-full select-none overflow-hidden rounded-card border border-line bg-panel ${
          isTop ? "cursor-grab shadow-card-top active:cursor-grabbing" : "pointer-events-none shadow-card"
        }`}
      >
        <CardFace ranked={ranked} interactive={isTop} loadImagery={depth <= 1} />

        {isTop && (
          <>
            <Stamp label={t("swipe.purr")} opacity={purrOpacity} side="left" color="var(--purr)" />
            <Stamp label={t("swipe.hiss")} opacity={hissOpacity} side="right" color="var(--hiss)" />
          </>
        )}
      </motion.div>
    </motion.div>
  );
}

function Stamp({
  label,
  opacity,
  side,
  color,
}: {
  label: string;
  opacity: MotionValue<number>;
  side: "left" | "right";
  color: string;
}) {
  return (
    <motion.span
      aria-hidden
      style={{ opacity, color, borderColor: color, rotate: side === "left" ? -14 : 14 }}
      className={`pointer-events-none absolute top-16 ${
        side === "left" ? "left-4" : "right-4"
      } rounded-control border-4 bg-bg/70 px-3 py-1 text-3xl font-black tracking-widest`}
    >
      {label}
    </motion.span>
  );
}
