"use client";

/**
 * Shared sheet: a bottom sheet on phones, a centered modal on desktop.
 * Native <dialog> (showModal): focus trap, Esc to close and top-layer stacking for free.
 * Used by EarthLimitsSheet, BreakdownSheet and RejectedPile — restyle all sheets here.
 */

import { X } from "lucide-react";
import { useEffect, useRef, type ReactNode } from "react";

interface SheetProps {
  open: boolean;
  onClose: () => void;
  /** id of the title element, for aria-labelledby */
  titleId: string;
  title: ReactNode;
  subtitle?: ReactNode;
  closeLabel: string;
  children: ReactNode;
  /** pinned under the scrolling body (e.g. a primary action) */
  footer?: ReactNode;
  /** rendered inside the dialog but outside the layout (e.g. a fixed confetti canvas) */
  overlay?: ReactNode;
}

export function Sheet({ open, onClose, titleId, title, subtitle, closeLabel, children, footer, overlay }: SheetProps) {
  const ref = useRef<HTMLDialogElement>(null);

  // Sync the native dialog (external system) with the `open` prop.
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose(); // click on the backdrop
      }}
      className="purr-sheet mb-0 mt-auto max-h-[85dvh] w-full max-w-full rounded-t-sheet border border-b-0 border-line bg-panel p-0 text-fg lg:m-auto lg:max-h-[80dvh] lg:max-w-xl lg:rounded-sheet lg:border-b"
    >
      {overlay}
      <div className="flex max-h-[inherit] flex-col">
        <div className="flex items-start gap-3 border-b border-line px-4 pb-3 pt-2 lg:pt-4">
          <div className="min-w-0 flex-1">
            <span aria-hidden className="mx-auto mb-2 block h-1 w-10 rounded-pill bg-line lg:hidden" />
            <h2 id={titleId} className="text-base font-bold uppercase tracking-wider text-fg">
              {title}
            </h2>
            {subtitle && <div className="mt-1 text-xs text-dim">{subtitle}</div>}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={closeLabel}
            className="flex min-h-11 min-w-11 items-center justify-center rounded-control text-dim hover:text-fg"
          >
            <X aria-hidden size={20} />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 pb-[calc(env(safe-area-inset-bottom)+1rem)]">
          {children}
        </div>

        {footer && (
          <div className="border-t border-line px-4 py-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)]">{footer}</div>
        )}
      </div>
    </dialog>
  );
}
