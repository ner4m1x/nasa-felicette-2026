"use client";

/**
 * Félicette's eyes: an original, minimal SVG in the same tuxedo style as FelicetteAvatar (black ears,
 * white blaze, phosphor irises with slit pupils, amber nose). The pupils
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
      {/* black ears with a thin outline (same tuxedo cat as FelicetteAvatar) */}
      <g fill="var(--cat-fur)" stroke="var(--cat-outline)" strokeWidth="1.2" strokeLinejoin="round">
        <path d="M6 24 L16 1 L32 15 Z" />
        <path d="M114 24 L104 1 L88 15 Z" />
      </g>
      <g fill="none" stroke="var(--cat-ear-inner)" strokeWidth="1.2">
        <path d="M11 19 L16.5 7 L25 14.5" />
        <path d="M109 19 L103.5 7 L95 14.5" />
      </g>
      {/* white blaze between the eyes, down to the nose */}
      <path d="M60 4 Q57 26 54 46 Q60 52 66 46 Q63 26 60 4 Z" fill="var(--cat-white)" />
      {EYES.map((eye, i) => (
        <g key={i}>
          <path
            d={`M${eye.cx - 20} ${eye.cy} Q${eye.cx} ${eye.cy - 20} ${eye.cx + 20} ${eye.cy} Q${eye.cx} ${eye.cy + 20} ${eye.cx - 20} ${eye.cy} Z`}
            fill="var(--cat-fur)"
            stroke="var(--cat-outline)"
            strokeWidth="1.2"
          />
          <ellipse cx={eye.cx} cy={eye.cy} rx="13" ry="8.5" fill="var(--cat-eye)" />
          <g
            ref={(el) => {
              pupils.current[i] = el;
            }}
          >
            <ellipse cx={eye.cx} cy={eye.cy} rx="2.6" ry="7.5" fill="var(--cat-fur)" />
            <circle cx={eye.cx + 3} cy={eye.cy - 3} r="1.4" fill="var(--cat-white)" />
          </g>
        </g>
      ))}
      {/* nose + mouth */}
      <path d="M55.5 50 L64.5 50 L60 55 Z" fill="var(--cat-nose)" />
      <path
        d="M60 55 Q56 61 51.5 58.5 M60 55 Q64 61 68.5 58.5"
        fill="none"
        stroke="var(--cat-outline)"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}
