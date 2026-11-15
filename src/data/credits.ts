/**
 * "About & credits": who made the data this app shows. Display only — no values here.
 *
 * Links: either reused from src/data/sources.ts (literature DOIs, already verified there) or a
 * dataset landing page checked with curl on 2026-11-15 (HTTP 200, page title matches the product).
 * The pipeline's own dataset DOIs stay in public/data/manifest.json and are listed by the Report.
 * Names are proper nouns (same in every language); the "what for" line is i18n (about.credits.*).
 */
import type { I18nKey } from "@/i18n/types";
import { getSource } from "./sources";

export interface Credit {
  id: string;
  /** dataset / mission / service name, as published */
  name: string;
  /** who provides it */
  by: string;
  /** what the app uses it for */
  roleKey: I18nKey;
  url: string;
  /** literature behind the planetary values (ids in sources.ts) */
  papers?: string[];
}

const src = (id: string) => getSource(id)?.url ?? "";

export const EARTH_CREDITS: Credit[] = [
  {
    id: "modis",
    name: "MODIS MOD11C3 · MOD13C2 · MCD12C1 (Collection 6.1)",
    by: "NASA LP DAAC / Earthdata",
    roleKey: "about.credits.modis",
    // curl: earthdata.nasa.gov/data/catalog/lpcloud-mod11c3-061 (redirect target of the LP DAAC page)
    url: "https://www.earthdata.nasa.gov/data/catalog/lpcloud-mod11c3-061",
  },
  {
    id: "merra2",
    name: "MERRA-2 M2TMNXFLX · M2TMNXAER (V5.12.4)",
    by: "NASA GMAO",
    roleKey: "about.credits.merra2",
    url: "https://gmao.gsfc.nasa.gov/gmao-products/merra-2/",
  },
  {
    id: "power",
    name: "NASA POWER",
    by: "NASA Langley Research Center",
    roleKey: "about.credits.power",
    url: src("nasa-power"),
  },
  {
    id: "gibs",
    name: "NASA GIBS (Blue Marble, MODIS, VIIRS imagery)",
    by: "NASA ESDIS",
    roleKey: "about.credits.gibs",
    url: src("nasa-gibs"),
  },
  {
    id: "s2cloudless",
    // attribution verbatim from the EOX WMTS capabilities abstract (see src/lib/gibs.ts)
    name: "Sentinel-2 cloudless 2025 (ESA Copernicus)",
    by: "EOX IT Services GmbH · Contains modified Copernicus Sentinel data 2025 · CC BY-NC-SA 4.0",
    roleKey: "about.credits.s2cloudless",
    // curl 2026-11-15: HTTP 200, title "EOxCloudless"
    url: "https://cloudless.eox.at/",
  },
  {
    id: "etopo",
    name: "ETOPO 2022 Global Relief Model (60 arc-second)",
    by: "NOAA NCEI",
    roleKey: "about.credits.etopo",
    url: "https://www.ncei.noaa.gov/products/etopo-global-relief-model",
  },
  {
    id: "glim",
    name: "GLiM — Global Lithological Map v1.0",
    by: "Hartmann & Moosdorf (2012)",
    roleKey: "about.credits.glim",
    // curl: PANGAEA landing page, title "Global Lithological Map Database v1.0 …"
    url: "https://doi.pangaea.de/10.1594/PANGAEA.788537",
  },
  {
    id: "naturalearth",
    name: "Natural Earth 1:10m",
    by: "Natural Earth (public domain)",
    roleKey: "about.credits.naturalearth",
    url: "https://www.naturalearthdata.com/",
  },
  {
    id: "osm",
    name: "Nominatim — © OpenStreetMap contributors",
    by: "OpenStreetMap Foundation",
    roleKey: "about.credits.osm",
    url: src("osm-nominatim"),
  },
];

export const PLANETARY_CREDITS: Credit[] = [
  {
    id: "lro",
    name: "LRO Diviner & LOLA",
    by: "NASA Lunar Reconnaissance Orbiter",
    roleKey: "about.credits.lro",
    url: "https://science.nasa.gov/mission/lro/",
    papers: ["paige-2010-diviner-coldtraps", "mazarico-2011-lola-illumination", "glaser-2018-lunar-pole-illumination", "horvath-2022-lunar-pits"],
  },
  {
    id: "meda",
    name: "Mars 2020 MEDA",
    by: "NASA Mars 2020 Perseverance",
    roleKey: "about.credits.meda",
    url: "https://science.nasa.gov/mission/mars-2020-perseverance/",
    papers: ["rodriguez-manfredi-2023-jezero-meda"],
  },
  {
    id: "mro",
    name: "MRO SHARAD & HiRISE",
    by: "NASA Mars Reconnaissance Orbiter",
    roleKey: "about.credits.mro",
    url: "https://science.nasa.gov/mission/mars-reconnaissance-orbiter/",
    papers: ["bramson-2015-arcadia-ice"],
  },
];
