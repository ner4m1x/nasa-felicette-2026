"use client";

/**
 * Laser-dot cursor over the map (fine pointers only; touch devices get a pulse at the tapped
 * point instead, see ScanMap). Follows the mouse via a ref + transform — no React re-render.
 */

import { useEffect, useRef, type RefObject } from "react";

export function LaserCursor({ container }: { container: RefObject<HTMLElement | null> }) {
  const dot = useRef<HTMLSpanElement>(null);

  // Subscribe to an external system (pointer events on the map container).
  useEffect(() => {
    const el = container.current;
    if (!el || !window.matchMedia("(pointer: fine)").matches) return;
    const move = (e: PointerEvent) => {
      const d = dot.current;
      if (!d || e.pointerType !== "mouse") return;
      const box = el.getBoundingClientRect();
      d.style.opacity = "1";
      d.style.transform = `translate(${e.clientX - box.left}px, ${e.clientY - box.top}px)`;
    };
    const leave = () => {
      if (dot.current) dot.current.style.opacity = "0";
    };
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerleave", leave);
    el.classList.add("purr-laser");
    return () => {
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerleave", leave);
      el.classList.remove("purr-laser");
    };
  }, [container]);

  return <span ref={dot} aria-hidden className="purr-laser-dot" />;
}
