"use client";

/**
 * Félicette's eyes: an original, minimal SVG (two almond eyes, slit pupils, ear tips). The pupils
 * follow the pointer on devices with a fine pointer; on touch devices they stay centred.
 * Pupil positions are written straight to the DOM (refs) — no React re-render per pointer move.
 * Respects prefers-reduced-motion (pupils stay still).
 */

import { useEffect, useRef } from "react";

const EYES = [
  { cx: 34, cy: 34 },
  { cx: 86, cy: 34 },
] as const;
/** maximum pupil travel inside the eye (SVG units) */
const TRAVEL = 7;

export function FelicetteEyes({ label, className = "" }: { label: string; className?: string }) {
  const svg = useRef<SVGSVGElement>(null);
  const pupils = useRef<(SVGGElement | null)[]>([]);

  // Subscribe to an external system (window pointer events).
  useEffect(() => {
    const fine = window.matchMedia("(pointer: fine)").matches;
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!fine || still) return;
    let frame = 0;
    const onMove = (e: PointerEvent) => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const el = svg.current;
        if (!el) return;
        const box = el.getBoundingClientRect();
        if (box.width === 0) return; // hidden
        const scale = box.width / 120;
        EYES.forEach((eye, i) => {
          const px = box.left + eye.cx * scale;
          const py = box.top + eye.cy * scale;
          const dx = e.clientX - px;
          const dy = e.clientY - py;
          const d = Math.hypot(dx, dy) || 1;
          const k = Math.min(1, d / 200) * TRAVEL;
          pupils.current[i]?.setAttribute("transform", `translate(${(dx / d) * k} ${(dy / d) * k * 0.6})`);
        });
      });
    };
    window.addEventListener("pointermove", onMove);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("pointermove", onMove);
    };
  }, []);

  return (
    <svg ref={svg} viewBox="0 0 120 64" role="img" aria-label={label} className={className}>
      {/* ear tips */}
      <path d="M8 22 L18 2 L30 16" fill="none" stroke="var(--amber)" strokeWidth="2.5" strokeLinejoin="round" />
      <path d="M112 22 L102 2 L90 16" fill="none" stroke="var(--amber)" strokeWidth="2.5" strokeLinejoin="round" />
      {EYES.map((eye, i) => (
        <g key={i}>
          <path
            d={`M${eye.cx - 20} ${eye.cy} Q${eye.cx} ${eye.cy - 20} ${eye.cx + 20} ${eye.cy} Q${eye.cx} ${eye.cy + 20} ${eye.cx - 20} ${eye.cy} Z`}
            fill="var(--panel-2)"
            stroke="var(--phosphor)"
            strokeWidth="2"
          />
          <g
            ref={(el) => {
              pupils.current[i] = el;
            }}
          >
            <ellipse cx={eye.cx} cy={eye.cy} rx="3.2" ry="8.5" fill="var(--phosphor)" />
            <circle cx={eye.cx + 1.5} cy={eye.cy - 3} r="1.2" fill="var(--bg)" />
          </g>
        </g>
      ))}
      {/* nose + mouth */}
      <path d="M56 52 L64 52 L60 56 Z" fill="var(--amber)" />
      <path d="M60 56 Q56 61 52 59 M60 56 Q64 61 68 59" fill="none" stroke="var(--amber)" strokeWidth="1.5" />
    </svg>
  );
}
