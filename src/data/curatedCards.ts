/**
 * Hand-written cards, always merged into the deck (src/lib/deck.ts).
 *
 * Numeric fields stay `null` + TODO_VERIFY until sourced. Coordinates are representative points
 * taken from OpenStreetMap Nominatim (source "osm-nominatim", accessed 2026-11-14), not survey data.
 * Breakdown texts are qualitative and contain no numbers.
 */
import type { DeckCard } from "@/lib/types";

export const LUNARES_CARD_ID = "curated-lunares";

const NO_MISSION_FEATURES: DeckCard["mission"] = {
  slopeMeanDeg: null, // TODO_VERIFY
  trafficableFrac: null, // TODO_VERIFY
  reliefStdM: null, // TODO_VERIFY
  iceProxy: null, // TODO_VERIFY
  basaltFrac: null, // TODO_VERIFY
};

export const CURATED_CARDS: readonly DeckCard[] = [
  {
    id: "curated-lake-salda",
    kind: "curated",
    name: "Lake Salda",
    country: "Türkiye",
    // OSM way 852912181 ("Salda Gölü"), Nominatim representative point.
    lat: 37.5476,
    lon: 29.6816,
    scale: "site",
    regionAreaKm2: null, // TODO_VERIFY
    // Mineralogical analog: the global grid cannot see carbonate mineralogy, so it is not scorable.
    analog: null,
    mission: NO_MISSION_FEATURES,
    stability: null,
    known: true, // TODO_VERIFY: cite source "lake-salda-jezero-analog"
    breakdown: {
      matches: {
        en: ["Carbonate shoreline deposits, compared with the marginal carbonates of Jezero crater"], // TODO_VERIFY
        pl: ["Węglanowe osady brzegowe, porównywane z węglanami na obrzeżu krateru Jezero"], // TODO_VERIFY
      },
      breaksDown: {
        en: ["Liquid water, a living lake ecosystem and Earth's thick atmosphere"],
        pl: ["Woda w stanie ciekłym, żywy ekosystem jeziora i gęsta atmosfera Ziemi"],
      },
      utility: {
        en: ["Test carbonate detection and biosignature sampling workflows"],
        pl: ["Testy wykrywania węglanów i procedur pobierania próbek pod kątem biosygnatur"],
      },
    },
    sourceIds: ["lake-salda-jezero-analog", "osm-nominatim"],
  },
  {
    id: "curated-ostrzyca",
    kind: "trap",
    name: "Ostrzyca / Kaczawskie Foothills",
    country: "Poland",
    // OSM node 1200805353 ("Ostrzyca Proboszczowicka", natural=peak).
    lat: 51.056,
    lon: 15.7633,
    scale: "site",
    regionAreaKm2: null, // TODO_VERIFY
    analog: null, // TODO_VERIFY: replace with pipeline score once the global scan is published
    mission: NO_MISSION_FEATURES,
    stability: null,
    known: false,
    breakdown: {
      matches: {
        en: ["Volcanic basalt: the right rock family for lunar mare comparisons"], // TODO_VERIFY
        pl: ["Wulkaniczny bazalt: właściwa rodzina skał do porównań z księżycowymi morzami"], // TODO_VERIFY
      },
      breaksDown: {
        en: ["Honest fail: forested, vegetated and deeply weathered — nothing like bare regolith"],
        pl: ["Uczciwa porażka: zalesiony, porośnięty i silnie zwietrzały — zupełnie nie jak goły regolit"],
      },
      utility: {
        en: ["Teaching case: why rock type alone does not make a planetary analog"],
        pl: ["Przykład dydaktyczny: sam typ skały nie czyni miejsca analogiem planetarnym"],
      },
    },
    sourceIds: ["osm-nominatim"],
  },
  {
    id: "curated-central-amazon",
    kind: "trap",
    name: "Central Amazon",
    country: "Brazil",
    // Representative point: OSM way 161393396 ("Reserva Florestal Adolpho Ducke", Manaus). TODO_VERIFY choice of point.
    lat: -2.9489,
    lon: -59.9299,
    scale: "regional",
    regionAreaKm2: null, // TODO_VERIFY
    analog: null, // TODO_VERIFY: replace with pipeline score once the global scan is published
    mission: NO_MISSION_FEATURES,
    stability: null,
    known: false,
    breakdown: {
      matches: {
        en: ["Radar roughness looks rocky, like a boulder field"], // TODO_VERIFY with pipeline radar layer
        pl: ["Szorstkość radarowa wygląda na skalistą, jak pole głazów"], // TODO_VERIFY with pipeline radar layer
      },
      breaksDown: {
        en: ["Trap: vegetation index and rainfall show the 'roughness' is tree canopy"],
        pl: ["Pułapka: wskaźnik roślinności i opady pokazują, że ta „szorstkość” to korony drzew"],
      },
      utility: {
        en: ["Sanity check: a single remote-sensing dimension can fool an analog search"],
        pl: ["Test zdrowego rozsądku: pojedynczy wymiar teledetekcyjny może oszukać wyszukiwanie analogów"],
      },
    },
    sourceIds: ["osm-nominatim"],
  },
  {
    id: LUNARES_CARD_ID,
    kind: "operational",
    name: "LunAres Research Station, Piła",
    country: "Poland",
    // OSM relation 946849 (town of Piła). TODO_VERIFY exact station location.
    lat: 53.1511,
    lon: 16.738,
    scale: "site",
    regionAreaKm2: null,
    // Analog of human operations, not geology: never ranked by the Analog Score.
    analog: null,
    mission: NO_MISSION_FEATURES,
    stability: null,
    known: true,
    breakdown: {
      matches: {
        en: ["Isolated habitat for simulated crewed missions"],
        pl: ["Izolowany habitat do symulowanych misji załogowych"],
      },
      breaksDown: {
        en: ["Not a geological analog: terrain, gravity and radiation are all Earth-normal"],
        pl: ["To nie analog geologiczny: teren, grawitacja i promieniowanie są ziemskie"],
      },
      utility: {
        en: ["Crew procedures, isolation, communication delay and habitat operations"],
        pl: ["Procedury załogi, izolacja, opóźnienie łączności i obsługa habitatu"],
      },
    },
    sourceIds: ["lunares-station", "osm-nominatim"],
  },
];
