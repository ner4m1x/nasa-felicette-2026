/**
 * Citations for every scientific value or factual claim shown in the app (ground rule 1).
 *
 * - `verified: false` = the URL was reachable when added, but a human has not reviewed the content.
 * - `doi` stays null until copied from the publisher's page. Never write DOIs from memory.
 * - `values` holds numbers exactly as read from the source on `accessed`, with the source's units.
 */

export interface SourceValue {
  value: number;
  unit: string;
  /** the label exactly as it appears in the source */
  label: string;
}

export interface SourceEntry {
  id: string;
  title: string;
  publisher: string;
  url: string | null;
  doi: string | null;
  /** ISO date the source was accessed */
  accessed: string | null;
  verified: boolean;
  values?: Record<string, SourceValue>;
  note?: string;
}

export const SOURCES = {
  "nssdc-moon-factsheet": {
    id: "nssdc-moon-factsheet",
    title: "Moon Fact Sheet",
    publisher: "NASA Space Science Data Coordinated Archive (NSSDCA)",
    url: "https://nssdc.gsfc.nasa.gov/planetary/factsheet/moonfact.html",
    doi: null,
    accessed: "2026-11-14",
    verified: false,
    values: {
      surfaceGravity: { value: 1.62, unit: "m/s2", label: "Surface gravity (m/s2)" },
      surfaceGravityRatioToEarth: { value: 0.165, unit: "Earth = 1", label: "Surface gravity (Ratio Moon/Earth)" },
      surfacePressureNight: { value: 3e-15, unit: "bar", label: "Surface pressure (night)" },
    },
  },
  "nssdc-mars-factsheet": {
    id: "nssdc-mars-factsheet",
    title: "Mars Fact Sheet",
    publisher: "NASA Space Science Data Coordinated Archive (NSSDCA)",
    url: "https://nssdc.gsfc.nasa.gov/planetary/factsheet/marsfact.html",
    doi: null,
    accessed: "2026-11-14",
    verified: false,
    values: {
      surfaceGravityMean: { value: 3.73, unit: "m/s2", label: "Surface gravity (mean) (m/s2)" },
      surfaceGravityRatioToEarth: { value: 0.38, unit: "Earth = 1", label: "Surface gravity (mean) (Ratio Mars/Earth)" },
      surfacePressureMean: { value: 6.36, unit: "mb", label: "Surface pressure (at mean radius)" },
    },
    note: "Surface pressure varies from 4.0 to 8.7 mb depending on season (same page).",
  },
  "nasa-power": {
    id: "nasa-power",
    title: "NASA POWER — Prediction Of Worldwide Energy Resources",
    publisher: "NASA Langley Research Center",
    url: "https://power.larc.nasa.gov/",
    doi: null,
    accessed: "2026-11-14",
    verified: false,
    note: "Live API used by the point inspector; parameters and units are read from each response.",
  },
  "nasa-gibs": {
    id: "nasa-gibs",
    title: "Global Imagery Browse Services (GIBS) API documentation",
    publisher: "NASA ESDIS",
    url: "https://nasa-gibs.github.io/gibs-api-docs/",
    doi: null,
    accessed: "2026-11-14",
    verified: false,
  },
  "osm-nominatim": {
    id: "osm-nominatim",
    title: "OpenStreetMap Nominatim geocoder (search API)",
    publisher: "OpenStreetMap contributors (ODbL)",
    url: "https://nominatim.openstreetmap.org/",
    doi: null,
    accessed: "2026-11-14",
    verified: false,
    note:
      "Coordinates of curated cards come from Nominatim search results; each card's comment names the OSM object.",
  },
  "lunares-station": {
    id: "lunares-station",
    title: "LunAres Research Station",
    publisher: "LunAres",
    url: "https://lunares.space/",
    doi: null,
    accessed: "2026-11-14",
    verified: false,
  },
  "lake-salda-jezero-analog": {
    id: "lake-salda-jezero-analog",
    title: "Lake Salda as a mineralogical analog of Jezero crater", // TODO_VERIFY: find and cite primary source
    publisher: "TODO_VERIFY",
    url: null,
    doi: null,
    accessed: null,
    verified: false,
  },
} as const satisfies Record<string, SourceEntry>;

export type SourceId = keyof typeof SOURCES;

export function getSource(id: string): SourceEntry | null {
  return (SOURCES as Record<string, SourceEntry>)[id] ?? null;
}
