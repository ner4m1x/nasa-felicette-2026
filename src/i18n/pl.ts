import type { Dictionary } from "./types";

/** Polish dictionary. Typed against `en`, so a missing or extra key is a TypeScript error. */
export const pl: Dictionary = {
  app: {
    title: "P.U.R.R. Command Center",
    subtitle: "Planetarne Urządzenie Rozpoznania Regolitu",
  },
  nav: {
    swipe: "Przesuwaj",
    map: "Mapa",
    report: "Raport",
  },
  fixture: {
    banner: "DANE TESTOWE (FIXTURE) — to nie są prawdziwe pomiary",
  },
  deck: {
    scanNotPublished: "Globalny skan nie został jeszcze opublikowany",
    rejectedPile: "Odrzucone przez specyfikację misji",
  },
  kinds: {
    benchmark: "Wzorzec",
    discovery: "Odkrycie",
    trap: "Pułapka",
    curated: "Wybrane",
    operational: "Operacyjny",
  },
  targets: {
    moon_shackleton: {
      label: "Księżyc — biegun (krawędź Shackletona)",
      cat: "Polarna zamrażarka i nasłoneczniony drapak",
    },
    moon_tranquillitatis_pit: {
      label: "Księżyc — tunel lawowy / morze (jama w Mare Tranquillitatis)",
      cat: "Wulkaniczna jaskinia na drzemkę",
    },
    mars_jezero: {
      label: "Mars — basen / delta (Jezero)",
      cat: "Imperialna czerwona kuweta",
    },
    mars_arcadia: {
      label: "Mars — lodowe równiny (Arcadia Planitia)",
      cat: "Płaska podkładka z lodem pod spodem",
    },
  },
  options: {
    footprint: {
      title: "Powierzchnia bazy",
      compact: { label: "Kompaktowa", desc: "< 2 km² (jaskinie, małe kratery)" },
      medium: { label: "Średnia", desc: "10–50 km²" },
      mega: { label: "Mega", desc: "> 100 km² (dalekie trasy łazików)" },
    },
    mobility: {
      title: "Flota łazików",
      climber: {
        label: "Wspinacz",
        desc: "Jeden mały łazik wspinaczkowy (radzi sobie ze stromym, nierównym terenem)",
      },
      heavy: {
        label: "Ciężkie",
        desc: "Ciężkie ciśnieniowe łaziki załogowe (potrzebują łagodnego, gładkiego terenu)",
      },
    },
    crew: {
      title: "Załoga i czas trwania",
      robotic: { label: "Robotyczna", desc: "0 osób" },
      short: { label: "Krótki pobyt", desc: "4 astronautów, krótki pobyt" },
      permanent: {
        label: "Stała baza",
        desc: "12+ osób; potrzebny lokalny lód (ISRU) lub naturalna osłona (tunele lawowe)",
      },
    },
    target: {
      title: "Cel i środowisko",
    },
  },
  fit: {
    constraint: {
      trafficabilityFail:
        "HISS: {pct}% terenu przejezdnego, twoje ciężkie łaziki potrzebują ≥ {minPct}% (najlepiej ≥ {fullPct}%)",
      trafficabilityLow:
        "{pct}% terenu przejezdnego; ciężkie łaziki dostają pełną ocenę dopiero przy ≥ {fullPct}%",
      footprintFail:
        "HISS: ~{areaKm2} km² terenu przejezdnego, twoja baza potrzebuje ≥ {minKm2} km²",
      footprintTight:
        "~{areaKm2} km² terenu przejezdnego; komfortowo dopiero przy ≥ {fullKm2} km²",
      iceMissing:
        "HISS: brak pomiaru wskaźnika lodu, stała załoga potrzebuje lokalnego lodu (ISRU)",
      iceLow: "HISS: wskaźnik lodu {value}, stała załoga potrzebuje ≥ {min}",
      basaltMissing:
        "HISS: brak pomiaru podłoża bazaltowego, stała załoga potrzebuje osłony tunelu lawowego",
      basaltLow: "HISS: udział bazaltu {value}, stała załoga potrzebuje ≥ {min}",
    },
    note: {
      footprintBelowGrid:
        "Powierzchnia bazy jest poniżej rozdzielczości siatki (~25 km). Ostateczny wybór miejsca wymaga DEM/zdjęć wysokiej rozdzielczości.",
      trafficabilityUnknown:
        "Przejezdność nie została zmierzona dla tego miejsca; ograniczenia nachylenia są niezweryfikowane.",
      areaUnknown:
        "Użyteczna powierzchnia nie została zmierzona; ograniczenie powierzchni jest niezweryfikowane.",
      reliefBonus: "Urozmaicona rzeźba terenu: dobry poligon dla twojego łazika wspinaczkowego.",
      hydratedMineralsNotCaptured:
        "Minerały zawierające wodę nie są widoczne w globalnym skanie; sprawdź lokalną mineralogię.",
      operationalNotGeology:
        "Analog operacyjny: testuje działania ludzi, nie teren. Ograniczenia terenowe pominięto.",
      honesty:
        "Nośność gruntu i lokalne nachylenia nie są mierzone przez dane globalne; nachylenia regionalne zaniżają lokalne.",
    },
  },
};
