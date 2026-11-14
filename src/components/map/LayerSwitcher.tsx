"use client";

/**
 * Terminal-style layer switcher: base map radio group (cloud-free Blue Marble by default, or the
 * single-day VIIRS mosaic), thematic GIBS layer (none / LST / NDVI) on top, the pipeline scan
 * overlay toggle, one opacity slider for the overlays (the base is never made transparent), and the
 * display-only pin controls ("Show all candidates", "Hide ice-sheet candidates").
 * Phone: collapsed behind a "Layers" button. Desktop: always open.
 */

import { Layers, X } from "lucide-react";
import { useId, useState } from "react";
import { useI18n } from "@/i18n/I18nProvider";
import { DEFAULT_TOP_N } from "@/lib/mapPins";
import { BASE_LAYERS, GIBS_LAYERS, THEMATIC_LAYERS, type BaseLayerId, type GibsLayerId } from "@/lib/gibs";

interface LayerSwitcherProps {
  base: BaseLayerId;
  onBase: (id: BaseLayerId) => void;
  thematic: GibsLayerId | null;
  onThematic: (id: GibsLayerId | null) => void;
  showScan: boolean;
  onShowScan: (v: boolean) => void;
  /** undefined = still checking; false = not published */
  overlayAvailable: boolean | undefined;
  opacity: number;
  onOpacity: (v: number) => void;
  /** overlay cutoff (0..1) from scan_grid_meta: lower scores are transparent but still scored */
  transparentBelow?: number;
  showAll: boolean;
  onShowAll: (v: boolean) => void;
  hideIce: boolean;
  onHideIce: (v: boolean) => void;
}

/**
 * Display legend for the pipeline overlay, which export.py renders with matplotlib "viridis"
 * (transparent below 0.2). These are the colormap's anchor colours at 0, .25, .5, .75 and 1.
 */
const VIRIDIS = "linear-gradient(to right, #440154, #3b528b, #21918c, #5ec962, #fde725)";

export function LayerSwitcher(props: LayerSwitcherProps) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const name = useId();
  const baseName = useId();
  const sliderId = useId();

  const options: { id: GibsLayerId | null; label: string }[] = [
    { id: null, label: t("map.layers.none") },
    ...THEMATIC_LAYERS.map((id) => ({ id, label: t(`map.layers.${id}`) })),
  ];

  return (
    <div className="pointer-events-auto">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls={`${name}-panel`}
        className="flex min-h-11 items-center gap-2 rounded-control border border-phosphor/60 bg-panel/95 px-3 text-xs font-bold uppercase tracking-wider text-phosphor shadow-card lg:hidden"
      >
        {open ? <X aria-hidden size={16} /> : <Layers aria-hidden size={16} />}
        {t("map.layers.title")}
      </button>

      <div
        id={`${name}-panel`}
        className={`${open ? "mt-2 block" : "hidden"} w-64 max-w-[calc(100vw-2rem)] rounded-control border border-line bg-panel/95 p-3 text-xs shadow-card backdrop-blur-sm lg:mt-0 lg:block`}
      >
        <fieldset>
          <legend className="mb-1.5 text-[11px] font-bold uppercase tracking-wider text-amber">
            {t("map.layers.base")}
          </legend>
          <div className="space-y-0.5">
            {BASE_LAYERS.map((id) => (
              <label
                key={id}
                className="flex min-h-9 cursor-pointer items-center gap-2 rounded px-1 hover:bg-phosphor/5"
              >
                <input
                  type="radio"
                  name={baseName}
                  checked={props.base === id}
                  onChange={() => props.onBase(id)}
                  className="accent-[var(--phosphor)]"
                />
                <span className="leading-tight">{t(`map.layers.${id}`)}</span>
                {GIBS_LAYERS[id].time && (
                  <span className="ml-auto text-[10px] tabular-nums text-dim">{GIBS_LAYERS[id].time}</span>
                )}
              </label>
            ))}
          </div>
        </fieldset>

        <fieldset className="mt-2 border-t border-line pt-2">
          <legend className="sr-only">{t("map.layers.thematic")}</legend>
          <p aria-hidden className="mb-1.5 text-[11px] font-bold uppercase tracking-wider text-amber">
            {t("map.layers.thematic")}
          </p>
          <div className="space-y-0.5">
            {options.map((o) => (
              <label
                key={o.id ?? "none"}
                className="flex min-h-9 cursor-pointer items-center gap-2 rounded px-1 hover:bg-phosphor/5"
              >
                <input
                  type="radio"
                  name={name}
                  checked={props.thematic === o.id}
                  onChange={() => props.onThematic(o.id)}
                  className="accent-[var(--phosphor)]"
                />
                <span>{o.label}</span>
                {o.id && (
                  <span className="ml-auto text-[10px] tabular-nums text-dim">{GIBS_LAYERS[o.id].time?.slice(0, 7)}</span>
                )}
              </label>
            ))}
          </div>
        </fieldset>

        <div className="mt-2 border-t border-line pt-2">
          <label className="flex min-h-9 cursor-pointer items-center gap-2 px-1">
            <input
              type="checkbox"
              checked={props.showScan && props.overlayAvailable === true}
              disabled={props.overlayAvailable !== true}
              onChange={(e) => props.onShowScan(e.target.checked)}
              className="accent-[var(--phosphor)]"
            />
            <span className={props.overlayAvailable === true ? "" : "text-dim"}>{t("map.layers.scan")}</span>
          </label>
          {props.overlayAvailable === false && <p className="px-1 text-[10px] text-amber">{t("map.layers.scanPending")}</p>}
          {props.overlayAvailable === true && props.showScan && (
            <div className="px-1 pt-1">
              <div aria-hidden className="h-2 rounded-pill" style={{ background: VIRIDIS }} />
              <div className="mt-0.5 flex justify-between text-[10px] text-dim">
                <span>{t("map.layers.legendLow")}</span>
                <span>{t("map.layers.legendHigh")}</span>
              </div>
              {props.transparentBelow !== undefined && (
                <p className="mt-1 text-[10px] leading-snug text-dim">
                  {t("map.layers.legendCutoff", { n: Math.round(props.transparentBelow * 100) })}
                </p>
              )}
            </div>
          )}
        </div>

        <fieldset className="mt-2 border-t border-line pt-2">
          <legend className="mb-1 text-[11px] font-bold uppercase tracking-wider text-amber">{t("map.layers.pins")}</legend>
          <label className="flex min-h-9 cursor-pointer items-start gap-2 px-1 pt-1">
            <input
              type="checkbox"
              checked={props.showAll}
              onChange={(e) => props.onShowAll(e.target.checked)}
              className="mt-0.5 accent-[var(--phosphor)]"
            />
            <span>
              {t("map.layers.showAll")}
              <span className="block text-[10px] text-dim">{t("map.layers.showAllHint", { n: DEFAULT_TOP_N })}</span>
            </span>
          </label>
          <label className="flex min-h-9 cursor-pointer items-start gap-2 px-1 pt-1">
            <input
              type="checkbox"
              checked={props.hideIce}
              onChange={(e) => props.onHideIce(e.target.checked)}
              className="mt-0.5 accent-[var(--phosphor)]"
            />
            <span>
              {t("map.layers.hideIce")}
              <span className="block text-[10px] text-dim">{t("map.layers.hideIceHint")}</span>
            </span>
          </label>
        </fieldset>

        <div className="mt-2 border-t border-line pt-2">
          <label htmlFor={sliderId} className="flex justify-between px-1 text-[11px] uppercase tracking-wider text-dim">
            <span>{t("map.layers.opacity")}</span>
            <span className="tabular-nums text-fg">{Math.round(props.opacity * 100)}%</span>
          </label>
          <input
            id={sliderId}
            type="range"
            min={0.1}
            max={1}
            step={0.05}
            value={props.opacity}
            onChange={(e) => props.onOpacity(Number(e.target.value))}
            className="mt-1 w-full accent-[var(--phosphor)]"
          />
        </div>
      </div>
    </div>
  );
}
