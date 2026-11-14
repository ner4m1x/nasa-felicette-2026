/**
 * English dictionary — the source of truth for every UI string.
 * `pl.ts` is typed against this shape, so a missing key is a TypeScript error.
 * Placeholders use `{name}` and are filled by `t(key, params)`.
 */
export const en = {
  app: {
    title: "P.U.R.R. Command Center",
    subtitle: "Planetary Utility for Regolith Reconnaissance",
  },
  nav: {
    swipe: "Swipe",
    map: "Map",
    report: "Report",
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
