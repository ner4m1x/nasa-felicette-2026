# Mission Fit

Mission Fit is the **engineering and operational suitability** of a site for the mission the user
configures. It is computed in the browser (`src/lib/missionFit.ts`) and is **separate from the
Analog Score**, which comes from the Python pipeline with a frozen config and is never changed by
configurator settings (covered by a unit test in `tests/ranking.test.ts`).

> **Every threshold on this page is an engineering assumption of this app, stated openly. None of
> them is planetary data.** Keep this file in sync with the constants in the code.

## Formula

```
fit = mobilityFactor × footprintFactor × resourceFactor     (each 0..1)
fit = 0 if any hard constraint fails → card goes to "Rejected by your mission specs"
deck order = analog.total × fit                              (src/lib/ranking.ts)
```

Soft constraints use linear partial credit from `PARTIAL_CREDIT_FLOOR` (just above the hard-fail
threshold) to `1` (at the full-credit threshold).

Missing terrain data (`null`) is neither a pass nor a fail: the constraint is skipped and an
"unverified" note is shown. The one exception is the permanent-crew resource requirement, which
fails when the resource is not measured.

## Constants

### Mobility (`src/lib/missionFit.ts`)

| Constant | Value | Meaning |
|---|---|---|
| `HEAVY_TRAFFICABLE_FULL` | 0.6 | Heavy rovers: full credit when ≥ 60 % of DEM pixels have slope < 5° |
| `HEAVY_TRAFFICABLE_FAIL` | 0.2 | Heavy rovers: hard fail below 20 % trafficable terrain |
| `PARTIAL_CREDIT_FLOOR` | 0.25 | Credit just above a hard-fail threshold; keeps passing sites > 0 |
| `CLIMBER_BASE_FACTOR` | 0.9 | Climber: factor on flat terrain; slopes are never penalised |
| `CLIMBER_RELIEF_FULL_BONUS_M` | 200 m | Climber: relief std. dev. at which the +0.1 bonus is fully reached |

### Footprint (`src/data/missionOptions.ts`)

Usable area for `regional` cards = `trafficableFrac × regionAreaKm2`.

| Option | Hard fail below | Full credit from | Source of the number |
|---|---|---|---|
| `compact` | 2 km² (`COMPACT_MIN_KM2`) | 2 km² | option definition "< 2 km²" |
| `medium` | 10 km² (`MEDIUM_MIN_KM2`) | 50 km² (`MEDIUM_FULL_KM2`) | option definition "10–50 km²" |
| `mega` | 100 km² (`MEGA_MIN_KM2`) | 100 km² | option definition "> 100 km²" |

- `compact` adds the note *"Footprint is below grid resolution (~25 km). Final site selection
  needs high-resolution DEM/imagery."* for regional cards.
- `site` cards with `compact` get no footprint penalty.

### Permanent crew resources (`src/lib/missionFit.ts`, `src/data/targets.ts`)

| Target | Resource | Constant | Value |
|---|---|---|---|
| `moon_shackleton`, `mars_arcadia` | ice proxy (ISRU) | `PERMANENT_ICE_PROXY_MIN` | 0.5 |
| `moon_tranquillitatis_pit` | basalt / lava-tube substrate (shielding) | `PERMANENT_BASALT_FRAC_MIN` | 0.5 |
| `mars_jezero` | water-bearing minerals | — | not captured globally → note only, no fail |

Robotic and short-stay crews have no resource requirement.

### Ranking (`src/lib/ranking.ts`)

| Constant | Value | Meaning |
|---|---|---|
| `INTERLEAVE_EVERY` | 3 | Unscored cards (curated / trap, `analog: null`) are placed at positions 3, 6, 9, … |

- Operational cards (LunAres) skip terrain and resource constraints, and are boosted to the top of
  the deck for `short` and `permanent` crews.
- Pipeline cards without a score for the selected target are omitted.

## Félicette's verdict (`src/lib/verdict.ts`) — UI assumptions

> **These thresholds are UI/UX assumptions of this app. They are NOT part of the frozen Analog
> Score method** (`scripts/config/targets.json`, pre-registered and committed as
> `freeze scoring config v1`) and they are not planetary data. They only decide whether Félicette
> *recommends* a card, for the "Félicette's verdict vs yours" comparison and the agreement score.
> They never change the Analog Score, the Mission Fit or the deck order.

| Constant | Value | Meaning |
|---|---|---|
| `FELICETTE_MIN_ANALOG` | 0.6 | Minimum Analog Score (0..1) for a recommendation: clearly better than "half-desirable" on balance |
| `FELICETTE_MIN_FIT` | 0.75 | Minimum Mission Fit (0..1): at most a mild soft penalty is acceptable |

Decision order (the first rule that applies wins):

1. Any **hard-failed** mission constraint → HISS, with that constraint's reason.
2. `kind: "trap"` → HISS ("it only looks like an analog from orbit").
3. `kind: "operational"` → PURR for crewed missions (`short`, `permanent`), HISS for `robotic`.
4. `analog: null` (unscored, e.g. a mineralogy-only curated site) → **abstain**; abstentions are not
   counted in the agreement score.
5. `analog.total < FELICETTE_MIN_ANALOG` → HISS, naming the limiting dimension.
6. `fit < FELICETTE_MIN_FIT` → HISS, with the first soft-penalty reason.
7. Otherwise → PURR.

Agreement score = agreed swipes / swipes where Félicette had an opinion (PURR or HISS). Confetti
fires only when the user PURRs a card Félicette also recommends.

## User scans (`src/lib/userCards.ts`)

Cards the user adds from the map ("Add to Félicette's deck") have kind `user` and scale `site`. They are
built from one scan-grid cell through the same path as the Hammaguir card (`src/lib/gridCard.ts`), so every
score comes from the grid. The breakdown text uses the pipeline's templates (`scripts/config/deck_text.json`).

- Félicette always **abstains** on user cards, so they never count toward the agreement score.
- Footprint: a clicked point has no measured area, so the footprint constraint is never applied. It is
  reported as "unverified (site-scale)" (factor 1, no penalty, no hard fail).
- Mobility and permanent-crew constraints apply as for any other card.
- User cards are stored per mission configuration in `localStorage` (`purr.userCards`). They are inserted as the
  next card of the current deck, are always pinned on the map, and can be removed.

## Honesty note (shown in the UI)

Bearing capacity and local slopes are not measured by global data; regional slopes underestimate
local ones.
