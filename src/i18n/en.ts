/**
 * English dictionary — the source of truth for every UI string.
 * `pl.ts` is typed against this shape, so a missing key is a TypeScript error.
 * Placeholders use `{name}` and are filled by `t(key, params)`.
 */
export const en = {
  app: {
    title: "P.U.R.R. Command Center",
    short: "P.U.R.R.",
    subtitle: "Planetary Utility for Regolith Reconnaissance",
  },
  nav: {
    swipe: "Swipe",
    map: "Map",
    report: "Report",
    aria: "Main sections",
  },
  topbar: {
    limits: "Earth limits",
    limitsAria: "Open Earth's fundamental limits",
  },
  lang: {
    groupAria: "Interface language",
    en: "EN",
    pl: "PL",
    enName: "English",
    plName: "Polski",
  },
  limits: {
    title: "Earth's fundamental limits",
    intro:
      "No Earth site can reproduce these. They are identical for every card, so they are kept out of all scores.",
    close: "Close",
    sources: "Sources",
    unverified: "not yet human-verified",
    gravity: {
      title: "Gravity",
      body: "Moon {moon} m/s² (≈ {moonRatio} g) · Mars {mars} m/s² (≈ {marsRatio} g). Every Earth analog sits at 1 g.",
    },
    atmosphere: {
      title: "Atmosphere",
      body: "Mars: surface pressure ≈ {marsKpa} kPa ({marsMb} mb, {minMb}–{maxMb} mb by season). Moon: exosphere only (night surface pressure {moonBar} bar).",
    },
    radiation: {
      title: "Radiation",
      body: "No global magnetic field and little or no atmosphere: crews and hardware are exposed to galactic cosmic rays (GCR) and solar particle events (SPE).",
    },
    dust: {
      title: "Lunar dust",
      body: "Lunar dust is sticky, sharp and electrostatically charged: it clings to seals, suits and optics.",
    },
    cat: "Even nine lives can't fix gravity.",
  },
  tabs: {
    mapOffline: "Global Scan Map: module not installed yet.",
    reportOffline: "Mission Report: module not installed yet.",
  },
  config: {
    heading: "Mission Configurator",
    stepOf: "Question {n} of {total}",
    progressAria: "Configurator progress",
    back: "Back",
    next: "Next",
    launch: "Launch scan",
    reconfigure: "Reconfigure",
    briefTitle: "Mission brief",
    shareHint: "This mission is encoded in the page URL: copy the link to share it.",
  },
  felicette: {
    name: "Félicette",
    intro: "Félicette online. Tell me what base you're planning and I'll sniff out Earth's best analogs.",
    launch: "Whiskers calibrated. Scanning the whole planet for you…",
    deckDocking: "The Orbital Swipe deck is still docking. I'll hold your mission until it arrives.",
    choice: {
      target: {
        moon_shackleton:
          "The lunar south pole: eternal shadow for ice, sunlit rims for my nap. Cold paws, warm heart.",
        moon_tranquillitatis_pit:
          "A pit into a lava tube. A cave with a ceiling of solid rock is the best nap spot in the Solar System.",
        mars_jezero:
          "An ancient lake and its delta. The most scientific litterbox on Mars.",
        mars_arcadia:
          "Flat plains with ice just below the dust. I can already hear the drills purring.",
      },
      footprint: {
        compact:
          "Small and cozy. Careful: that's below my scan resolution, so final siting needs sharper eyes.",
        medium: "A sensible territory. Room to stretch, not too much to patrol.",
        mega: "A whole kingdom! You'll need huge areas of smooth ground for those traverses.",
      },
      mobility: {
        climber: "A climber! Steep, rough slopes become a playground instead of a problem.",
        heavy: "Heavy pressurized rovers: comfy for the crew, picky about slopes. Smooth ground only.",
      },
      crew: {
        robotic: "Robots only. No snacks to pack, and no shielding to argue about.",
        short: "Four astronauts for a short stay. I'll keep an eye out for crew-training sites too.",
        permanent:
          "A permanent base! You'll need local ice to mine or rock overhead for shielding. I'll be strict.",
      },
    },
  },
  fixture: {
    banner: "DEV FIXTURE DATA — not real measurements",
  },
  deck: {
    scanNotPublished: "Global scan not yet published",
    rejectedPile: "Rejected by your mission specs",
  },
  kinds: {
    benchmark: "Benchmark",
    discovery: "Discovery",
    trap: "Trap",
    curated: "Curated",
    operational: "Operational",
  },
  targets: {
    moon_shackleton: {
      label: "Moon — polar (Shackleton rim)",
      cat: "Polar Freezer & Sunlit Scratching Post",
    },
    moon_tranquillitatis_pit: {
      label: "Moon — lava tube / mare (Tranquillitatis pit)",
      cat: "Volcanic Nap Cave",
    },
    mars_jezero: {
      label: "Mars — basin / delta (Jezero)",
      cat: "Imperial Red Litterbox",
    },
    mars_arcadia: {
      label: "Mars — ice plains (Arcadia Planitia)",
      cat: "Flat Subsurface Ice Pad",
    },
  },
  options: {
    footprint: {
      title: "Base footprint",
      compact: { label: "Compact", desc: "< 2 km² (caves, small craters)" },
      medium: { label: "Medium", desc: "10–50 km²" },
      mega: { label: "Mega", desc: "> 100 km² (long-range rover traverse)" },
    },
    mobility: {
      title: "Rover fleet",
      climber: {
        label: "Climber",
        desc: "One small climbing rover (tolerates steep, rough terrain)",
      },
      heavy: {
        label: "Heavy",
        desc: "Heavy pressurized crew rovers (need gentle, smooth terrain)",
      },
    },
    crew: {
      title: "Crew & duration",
      robotic: { label: "Robotic", desc: "0 crew" },
      short: { label: "Short stay", desc: "4 astronauts, short stay" },
      permanent: {
        label: "Permanent base",
        desc: "12+ crew; needs local ice (ISRU) or natural shielding (lava tubes)",
      },
    },
    target: {
      title: "Target body & environment",
    },
  },
  dims: {
    aridity: { sci: "Aridity (annual precipitation)", cat: "Litterbox dryness" },
    fixture_dim_a: { sci: "FIXTURE DIMENSION A", cat: "Dev fixture, not a real dimension" },
    fixture_dim_b: { sci: "FIXTURE DIMENSION B", cat: "Dev fixture, not a real dimension" },
  },
  fit: {
    constraint: {
      trafficabilityFail:
        "HISS: {pct}% trafficable terrain, your heavy rovers need ≥ {minPct}% (ideally ≥ {fullPct}%)",
      trafficabilityLow:
        "{pct}% trafficable terrain; heavy rovers get full credit only at ≥ {fullPct}%",
      footprintFail:
        "HISS: ~{areaKm2} km² of trafficable terrain, your base needs ≥ {minKm2} km²",
      footprintTight:
        "~{areaKm2} km² of trafficable terrain; comfortable only at ≥ {fullKm2} km²",
      iceMissing:
        "HISS: no ice proxy measured here, a permanent crew needs local ice (ISRU)",
      iceLow: "HISS: ice proxy {value}, a permanent crew needs ≥ {min}",
      basaltMissing:
        "HISS: no basalt substrate measured here, a permanent crew needs lava-tube shielding",
      basaltLow: "HISS: basalt fraction {value}, a permanent crew needs ≥ {min}",
    },
    note: {
      footprintBelowGrid:
        "Footprint is below grid resolution (~25 km). Final site selection needs high-resolution DEM/imagery.",
      trafficabilityUnknown:
        "Trafficability not measured for this site; slope constraints are unverified.",
      areaUnknown:
        "Usable area not measured for this site; footprint constraint is unverified.",
      reliefBonus: "Rugged relief: good test terrain for your climbing rover.",
      hydratedMineralsNotCaptured:
        "Water-bearing minerals are not captured by the global scan; check local mineralogy.",
      operationalNotGeology:
        "Operational analog: it tests human operations, not terrain. Terrain constraints were skipped.",
      honesty:
        "Bearing capacity and local slopes are not measured by global data; regional slopes underestimate local ones.",
    },
  },
} as const;
