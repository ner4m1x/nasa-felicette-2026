/**
 * Planetary reference values ("where's the Moon/Mars data?").
 *
 * Every value comes from a peer-reviewed analysis of LRO / Mars 2020 / MRO data archived in the
 * NASA PDS, or from the NASA NSSDC fact sheets. Numbers are copied as given in the sources — do not
 * change them. Citations live in src/data/sources.ts (`sourceId`).
 *
 * `earthFeature` is the scan_grid feature band the planetary value is compared against, or null
 * when Earth global data cannot see the property at all (caves, subsurface ice, …).
 */

import type { I18nKey } from "@/i18n/types";
import type { TargetId } from "@/lib/types";

export type PlanetaryRef = {
  id: string;
  target: TargetId;
  /** i18n key (EN/PL) of the short label */
  labelKey: I18nKey;
  /** single value or [min, max] range; null for purely qualitative entries */
  value: number | [number, number] | null;
  /** display unit */
  unit: string;
  /** feature id in scan_grid this compares to, or null if Earth data can't see it */
  earthFeature: string | null;
  /** e.g. "LRO Diviner", "LRO LOLA", "Mars 2020 MEDA", "MRO SHARAD + HiRISE" */
  instrument: string;
  /** key in sources.ts */
  sourceId: string;
  /** i18n key of an explanatory note */
  noteKey?: I18nKey;
  /** i18n key of the value for qualitative entries (value === null) */
  qualitativeKey?: I18nKey;
  /** "upTo" → "up to ≈ v", "approx" → "≈ v" */
  qualifier?: "upTo" | "approx";
  /** how to render `value`: a range (default for pairs) or coordinates */
  display?: "coords";
  /**
   * How to express the Earth feature for the comparison (display only):
   * - "daysPerYear": fraction × 365 → days
   * - "percent": fraction × 100 → %
   */
  earthTransform?: "daysPerYear" | "percent";
};

export const PLANETARY_REFERENCE: readonly PlanetaryRef[] = [
  // ---- Moon: Shackleton (south pole) ----
  {
    id: "psr_coldtrap_temp",
    target: "moon_shackleton",
    labelKey: "planetary.ref.psr_coldtrap_temp",
    value: 37,
    unit: "K",
    earthFeature: "lst_night_min_c",
    instrument: "LRO Diviner",
    sourceId: "paige-2010-diviner-coldtraps",
    noteKey: "planetary.note.psr_coldtrap_temp",
  },
  {
    id: "rim_continuous_sunlight",
    target: "moon_shackleton",
    labelKey: "planetary.ref.rim_continuous_sunlight",
    value: 240,
    unit: "days",
    earthFeature: "polar_day_frac",
    instrument: "LRO LOLA",
    sourceId: "mazarico-2011-lola-illumination",
    noteKey: "planetary.note.rim_continuous_sunlight",
    earthTransform: "daysPerYear",
  },
  {
    id: "rim_illumination_pct",
    target: "moon_shackleton",
    labelKey: "planetary.ref.rim_illumination_pct",
    value: 85.5,
    unit: "%",
    earthFeature: "polar_day_frac",
    instrument: "LRO LOLA DTMs",
    sourceId: "glaser-2018-lunar-pole-illumination",
    earthTransform: "percent",
  },
  // ---- Moon: Mare Tranquillitatis pit ----
  {
    id: "pit_shade_temp",
    target: "moon_tranquillitatis_pit",
    labelKey: "planetary.ref.pit_shade_temp",
    value: 17,
    unit: "°C",
    earthFeature: null,
    instrument: "LRO Diviner",
    sourceId: "horvath-2022-lunar-pits",
    noteKey: "planetary.note.pit_shade_temp",
  },
  {
    id: "surface_temp_range",
    target: "moon_tranquillitatis_pit",
    labelKey: "planetary.ref.surface_temp_range",
    value: [-173, 127],
    unit: "°C",
    earthFeature: null,
    instrument: "LRO Diviner",
    sourceId: "horvath-2022-lunar-pits",
    noteKey: "planetary.note.surface_temp_range",
  },
  {
    id: "pit_depth",
    target: "moon_tranquillitatis_pit",
    labelKey: "planetary.ref.pit_depth",
    value: 100,
    unit: "m",
    qualifier: "approx",
    earthFeature: null,
    instrument: "LROC + Diviner",
    sourceId: "horvath-2022-lunar-pits",
    noteKey: "planetary.note.pit_depth",
  },
  {
    id: "substrate",
    target: "moon_tranquillitatis_pit",
    labelKey: "planetary.ref.substrate",
    value: null,
    unit: "",
    earthFeature: "basalt_frac",
    instrument: "LROC",
    sourceId: "horvath-2022-lunar-pits",
    qualitativeKey: "planetary.qual.mare_basalt",
  },
  // ---- Mars: Jezero crater ----
  {
    id: "air_temp_mean",
    target: "mars_jezero",
    labelKey: "planetary.ref.air_temp_mean",
    value: -55,
    unit: "°C",
    earthFeature: "lst_allmonth_mean_c",
    instrument: "Mars 2020 MEDA",
    sourceId: "rodriguez-manfredi-2023-jezero-meda",
    noteKey: "planetary.note.surfaceVsAir",
  },
  {
    id: "air_temp_diurnal_swing",
    target: "mars_jezero",
    labelKey: "planetary.ref.air_temp_diurnal_swing",
    value: [50, 60],
    unit: "K",
    earthFeature: "lst_diurnal_range_k",
    instrument: "Mars 2020 MEDA",
    sourceId: "rodriguez-manfredi-2023-jezero-meda",
    noteKey: "planetary.note.surfaceVsAir",
  },
  {
    id: "landing_site",
    target: "mars_jezero",
    labelKey: "planetary.ref.landing_site",
    value: [18.44, 77.45],
    unit: "",
    earthFeature: null,
    instrument: "Mars 2020",
    sourceId: "rodriguez-manfredi-2023-jezero-meda",
    display: "coords",
    noteKey: "planetary.note.displayOnly",
  },
  // ---- Mars: Arcadia Planitia ----
  {
    id: "excess_ice_thickness",
    target: "mars_arcadia",
    labelKey: "planetary.ref.excess_ice_thickness",
    value: 40,
    unit: "m",
    qualifier: "upTo",
    earthFeature: null,
    instrument: "MRO SHARAD + HiRISE",
    sourceId: "bramson-2015-arcadia-ice",
    noteKey: "planetary.note.excess_ice_thickness",
  },
  {
    id: "mars_mean_surface_temp",
    target: "mars_arcadia",
    labelKey: "planetary.ref.mars_mean_surface_temp",
    value: -59,
    unit: "°C",
    qualifier: "approx",
    earthFeature: "lst_allmonth_mean_c",
    instrument: "NSSDC",
    sourceId: "nssdc-mars-factsheet",
    noteKey: "planetary.note.mars_mean_surface_temp",
  },
  {
    id: "viking1_diurnal_range",
    target: "mars_arcadia",
    labelKey: "planetary.ref.viking1_diurnal_range",
    value: [-89, -31],
    unit: "°C",
    earthFeature: "lst_diurnal_range_k",
    instrument: "Viking 1 Lander",
    sourceId: "nssdc-mars-factsheet",
    noteKey: "planetary.note.viking1_diurnal_range",
  },
];

export function planetaryRefsFor(target: TargetId): PlanetaryRef[] {
  return PLANETARY_REFERENCE.filter((r) => r.target === target);
}
