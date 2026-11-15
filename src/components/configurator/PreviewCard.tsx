"use client";

/**
 * Desktop configurator: a static, non-swipeable preview of the first card of the deck ranked for
 * the current options (SwipeContext queue[0] — the card "Launch scan" will show first). Reuses
 * CardFace (satellite image, meters, radar); `inert` keeps it out of the tab order and pointer
 * input. Updates as the options change. Not rendered on phones (no imagery fetched there).
 */

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { CardFace } from "@/components/swipe/CardFace";
import { useI18n } from "@/i18n/I18nProvider";
import { useSwipe } from "@/state/SwipeContext";
import { DURATION } from "@/theme/tokens";

export function PreviewCard() {
  const { t } = useI18n();
  const swipe = useSwipe();
  const reduceMotion = useReducedMotion();
  const first = swipe.queue[0] ?? null;
  const status = !swipe.visible ? "loading" : first ? "card" : "empty";

  return (
    <figure aria-labelledby="preview-caption" className="space-y-1.5">
      <figcaption id="preview-caption" className="text-[11px] font-bold uppercase tracking-widest text-amber">
        {t("config.previewCaption")}
      </figcaption>
      <div className="relative h-[var(--preview-card-height)] overflow-hidden rounded-card border border-line bg-panel shadow-card">
        {status === "card" && first ? (
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={first.card.id}
              inert
              className="h-full"
              initial={reduceMotion ? false : { opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={reduceMotion ? undefined : { opacity: 0 }}
              transition={{ duration: DURATION.base }}
            >
              <CardFace ranked={first} interactive={false} loadImagery />
            </motion.div>
          </AnimatePresence>
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-2 p-6 text-center">
            <p className="text-xs font-bold uppercase tracking-wider text-phosphor">
              {t(status === "loading" ? "deck.loading" : "deck.emptyTitle")}
            </p>
            {status === "empty" && <p className="text-[11px] leading-relaxed text-dim">{t("config.previewEmpty")}</p>}
          </div>
        )}
        {/* the card body is cut off at the preview height: fade it out instead of a hard edge */}
        <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-panel to-transparent" />
      </div>
    </figure>
  );
}
