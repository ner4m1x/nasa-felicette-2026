import type { Dictionary } from "./types";

/** Polish dictionary. Typed against `en`, so a missing or extra key is a TypeScript error. */
export const pl: Dictionary = {
  app: {
    title: "P.U.R.R. Command Center",
    short: "P.U.R.R.",
    subtitle: "Planetarne Urządzenie Rozpoznania Regolitu",
  },
  nav: {
    swipe: "Przesuwaj",
    map: "Mapa",
    report: "Raport",
    aria: "Główne sekcje",
  },
  topbar: {
    limits: "Granice Ziemi",
    limitsAria: "Otwórz fundamentalne granice Ziemi",
  },
  lang: {
    groupAria: "Język interfejsu",
    en: "EN",
    pl: "PL",
    enName: "English",
    plName: "Polski",
  },
  limits: {
    title: "Fundamentalne granice Ziemi",
    intro:
      "Żadne miejsce na Ziemi nie odtworzy tych warunków. Są identyczne dla każdej karty, więc nie wchodzą do żadnego wyniku.",
    close: "Zamknij",
    sources: "Źródła",
    unverified: "jeszcze niezweryfikowane przez człowieka",
    gravity: {
      title: "Grawitacja",
      body: "Księżyc {moon} m/s² (≈ {moonRatio} g) · Mars {mars} m/s² (≈ {marsRatio} g). Każdy ziemski analog ma 1 g.",
    },
    atmosphere: {
      title: "Atmosfera",
      body: "Mars: ciśnienie przy powierzchni ≈ {marsKpa} kPa ({marsMb} mb, {minMb}–{maxMb} mb zależnie od pory roku). Księżyc: tylko egzosfera (nocne ciśnienie przy powierzchni {moonBar} bar).",
    },
    radiation: {
      title: "Promieniowanie",
      body: "Brak globalnego pola magnetycznego i znikoma atmosfera (lub żadna): załoga i sprzęt są wystawione na galaktyczne promieniowanie kosmiczne (GCR) i słoneczne zdarzenia cząstkowe (SPE).",
    },
    dust: {
      title: "Pył księżycowy",
      body: "Pył księżycowy jest lepki, ostry i naładowany elektrostatycznie: przywiera do uszczelek, skafandrów i optyki.",
    },
    cat: "Nawet dziewięć żyć nie naprawi grawitacji.",
  },
  tabs: {
    mapOffline: "Globalna mapa skanu: moduł jeszcze niezainstalowany.",
    reportOffline: "Raport misji: moduł jeszcze niezainstalowany.",
  },
  config: {
    heading: "Konfigurator misji",
    stepOf: "Pytanie {n} z {total}",
    progressAria: "Postęp konfiguratora",
    back: "Wstecz",
    next: "Dalej",
    launch: "Uruchom skan",
    reconfigure: "Zmień konfigurację",
    briefTitle: "Odprawa misji",
    shareHint: "Ta misja jest zapisana w adresie strony: skopiuj link, żeby ją udostępnić.",
  },
  felicette: {
    name: "Félicette",
    intro: "Félicette online. Powiedz, jaką bazę planujesz, a wywęszę najlepsze ziemskie analogi.",
    launch: "Wąsy skalibrowane. Skanuję całą planetę dla ciebie…",
    deckDocking: "Talia Orbital Swipe jeszcze dokuje. Przechowam twoją misję, aż dotrze.",
    choice: {
      target: {
        moon_shackleton:
          "Biegun południowy Księżyca: wieczny cień dla lodu, nasłonecznione krawędzie na moją drzemkę. Zimne łapki, ciepłe serce.",
        moon_tranquillitatis_pit:
          "Jama prowadząca do tunelu lawowego. Jaskinia ze skalnym sufitem to najlepsze miejsce na drzemkę w Układzie Słonecznym.",
        mars_jezero: "Dawne jezioro i jego delta. Najbardziej naukowa kuweta na Marsie.",
        mars_arcadia: "Płaskie równiny z lodem tuż pod pyłem. Już słyszę, jak mruczą wiertła.",
      },
      footprint: {
        compact:
          "Mała i przytulna. Uwaga: to poniżej rozdzielczości mojego skanu, więc ostateczny wybór miejsca wymaga bystrzejszych oczu.",
        medium: "Rozsądne terytorium. Jest gdzie się przeciągnąć, a nie za dużo do patrolowania.",
        mega: "Całe królestwo! Na te trasy potrzebujesz ogromnych obszarów gładkiego terenu.",
      },
      mobility: {
        climber: "Wspinacz! Strome, nierówne zbocza to plac zabaw, a nie problem.",
        heavy: "Ciężkie łaziki ciśnieniowe: wygodne dla załogi, wybredne co do nachyleń. Tylko gładki teren.",
      },
      crew: {
        robotic: "Same roboty. Bez pakowania przekąsek i bez sporów o osłony.",
        short: "Czworo astronautów na krótki pobyt. Wypatrzę też miejsca do treningu załóg.",
        permanent:
          "Stała baza! Potrzebny będzie lokalny lód do wydobycia albo skała nad głową jako osłona. Będę surowa.",
      },
    },
  },
  fixture: {
    banner: "DANE TESTOWE (FIXTURE) — to nie są prawdziwe pomiary",
  },
  deck: {
    scanNotPublished: "Globalny skan nie został jeszcze opublikowany",
    rejectedPile: "Odrzucone przez specyfikację misji",
    stackAria: "Talia Orbital Swipe",
    loading: "Dokowanie talii…",
    loadError: "Nie udało się wczytać talii: {error}",
    rejectedButton: "Odrzucone ({n})",
    rejectedIntro:
      "Te miejsca nie spełniają twardego wymogu twojej misji. Oba wyniki są nadal widoczne, bez zmian.",
    rejectedEmpty: "Żadne miejsce nie łamie twardego wymogu twojej misji.",
    progress: "Zostało {left} z {total}",
    doneTitle: "Talia ukończona",
    doneBody: "Oceniono wszystkie karty dla tej misji. Twoje PURR trafią do Raportu misji.",
    emptyTitle: "Brak kart dla tej misji",
    emptyBody: "Każde miejsce łamie twardy wymóg. Otwórz stos odrzuconych, aby zobaczyć dlaczego, albo zmień konfigurację.",
    restart: "Zacznij talię od nowa",
    keysLabel: "Klawisze",
    dragHint: "Przeciągnij kartę w prawo, aby dać PURR, w lewo, aby dać HISS.",
    stats: "PURR {purr} · HISS {hiss}",
  },
  swipe: {
    purr: "PURR",
    hiss: "HISS",
    skip: "Pomiń",
    purrAria: "PURR: akceptuj to miejsce",
    hissAria: "HISS: odrzuć to miejsce",
    skipAria: "Pomiń: przenieś kartę na spód talii",
    cardAria: "{name}, {kind}. Przeciągnij w prawo dla PURR, w lewo dla HISS albo użyj przycisków poniżej.",
  },
  card: {
    analog: "Wynik analogii",
    analogHint: "podobieństwo planetarne · zamrożony pipeline",
    fit: "Dopasowanie misji",
    fitHint: "specyfikacja twojej misji",
    outOf: "/100",
    percentile: "percentyl {p} wśród komórek lądu",
    limiting: "Najsłabszy wymiar: {dim}",
    unscored: "Nie do ocenienia przez globalną siatkę",
    noCountry: "—",
    regional: "Regionalna · siatka 0,25°",
    site: "Punktowa · poniżej rozdzielczości siatki",
    known: "Znany analog",
    teaser: {
      benchmark: "Znany analog: miarka, którą mierzę każdą inną kuwetę.",
      discovery: "Świeżo z globalnego skanu. Nikt tu jeszcze nie węszył.",
      trap: "Z orbity pachnie dobrze… ale wąsy mi drgają.",
      curated: "Wybrane ręcznie: to, co tu wyjątkowe, jest niewidoczne dla mojej siatki.",
      operational: "Nie chodzi o skały: tu załogi uczą się żyć jak astronauci.",
    },
    scan: "Skanuj wąsami",
    scanning: "Węszę w NASA POWER…",
    retry: "Ponów skan",
  },
  scan: {
    title: "Kontrola na żywo: NASA POWER",
    queried: "Zapytanie dla {lat}°, {lon}° (siatka 0,5°)",
    period: "Okres: {range}",
    unavailable: "NASA POWER niedostępne. Spróbuj później.",
    annual: "rocznie",
    source: "Źródło: API klimatologii NASA POWER (na żywo)",
    radarTitle: "Wymiary analogii",
    radarHint:
      "Atrakcyjność w każdym wymiarze (0–100) z zamrożonego pipeline'u. Wynik analogii je łączy; najsłabszy go ogranicza.",
    radarNone: "Brak wyników wymiarów: to miejsce nie jest oceniane przez globalną siatkę.",
    radarFew: "Za mało wymiarów na wykres radarowy; wartości są wypisane poniżej.",
    limitingTag: "ogranicza",
  },
  breakdown: {
    matches: "Gdzie pasuje",
    breaksDown: "Gdzie analogia się załamuje",
    utility: "Co tu testować",
    fit: "Werdykt dopasowania misji",
    sources: "Źródła",
    empty: "—",
    allPassed: "Wszystkie wymogi misji spełnione.",
    hard: "twardy wymóg",
    soft: "kara",
    next: "Następna karta",
    close: "Zamknij",
    verdictTitle: "Werdykt Félicette kontra twój",
    youPurred: "Dałeś/aś PURR",
    youHissed: "Dałeś/aś HISS",
    agreement: "Zgodność do tej pory: {agreed}/{counted} ({pct}%)",
    agreementNone: "Zgodność do tej pory: — (brak porównywalnych ocen)",
    unverified: "jeszcze niezweryfikowane przez człowieka",
  },
  verdict: {
    agreePurr: "Zgadzamy się: PURR!",
    agreeHiss: "Zgadzamy się: HISS.",
    purrVsHiss: "Ty dałeś/aś PURR, ja dałabym HISS:",
    hissVsPurr: "Ty dałeś/aś HISS, ja dałabym PURR:",
    abstain: "Wstrzymuję się:",
    reason: {
      strong: "analogia {analog}/100 i dopasowanie misji {fit}/100 przekraczają mój próg.",
      weakAnalog: "wynik analogii {analog}/100 jest poniżej mojego progu {min}; najsłabszy wymiar: {dim}.",
      weakFit: "dopasowanie misji {fit}/100 jest poniżej mojego progu {min}.",
      trap: "to pułapka: tylko z orbity wygląda na analog.",
      operationalCrew: "twoja załoga potrzebuje miejsca do ćwiczenia procedur.",
      operationalRobotic: "to trening dla ludzi, a twoja misja jest robotyczna.",
      unscored: "globalna siatka nie oceni tego miejsca, więc decyzja należy do ciebie.",
    },
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
  dims: {
    aridity: { sci: "Suchość (roczne opady)", cat: "Suchość kuwety" },
    precip_mm_yr: { sci: "Suchość (roczne opady)", cat: "Suchość kuwety" },
    ndvi_max: { sci: "Goły grunt (maks. NDVI)", cat: "Brak trawy do skubania" },
    barren_frac: { sci: "Udział terenu jałowego", cat: "Pokrycie piaskownicy" },
    unvegetated_frac: { sci: "Udział terenu bez roślinności", cat: "Łyse placki" },
    lst_diurnal_range_k: { sci: "Dobowa amplituda temperatury powierzchni", cat: "Gorące łapki, zimne łapki" },
    lst_day_mean_c: { sci: "Dzienna temperatura powierzchni", cat: "Upał do opalania" },
    lst_night_min_c: { sci: "Nocna minimalna temperatura powierzchni", cat: "Polarna zamrażarka" },
    relief_std_m: { sci: "Rzeźba terenu (odch. std. wysokości)", cat: "Garby drapaka" },
    dust_aod: { sci: "Zapylenie (grubość optyczna aerozolu)", cat: "Indeks kąpieli w pyle" },
    snowice_frac: { sci: "Pokrywa śniegu i lodu", cat: "Zapas kostek lodu" },
    polar_day_frac: { sci: "Udział dnia polarnego", cat: "Czas na słonecznym parapecie" },
    basalt_frac: { sci: "Udział podłoża bazaltowego", cat: "Wulkaniczna skała do drzemki" },
    fixture_dim_a: { sci: "WYMIAR TESTOWY A", cat: "Dane testowe, nie prawdziwy wymiar" },
    fixture_dim_b: { sci: "WYMIAR TESTOWY B", cat: "Dane testowe, nie prawdziwy wymiar" },
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
