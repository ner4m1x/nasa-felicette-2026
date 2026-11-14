# Method log

Chronological log of methodological decisions (pre-registration, frozen configs, changes and why).

- 2026-11-14 — Project structure created. Analog Score (pipeline, frozen config) and Mission Fit
  (browser, configurator-driven) are kept as two separate numbers; deck order = Analog × Fit.
- 2026-11-14 — **Pre-freeze review of `scripts/config/targets.json` (v1)**, decided by the reviewer before any
  validation run and before any score was inspected. Changes to the initial proposal in PROMPT_02:
  - a) `moon_shackleton.snowice_frac` band → `zero_low -5, full_low 5, full_high 60, zero_high 95`.
    Ice-free cells should be neutral (0.5), not disqualified; partial ice = full; ice sheet = 0.
  - b) `mars_jezero.dust_aod` → weight 0.05, full 0.15, zero 0.02; the removed 0.05 weight goes to
    `lst_diurnal_range_k` (0.15 → 0.20). Column AOD is largely transported dust, not a local surface
    property, so it is a weak analog dimension.
  - c) `mars_arcadia`: `lst_day_mean_c` replaced by the new feature `lst_allmonth_mean_c` (mean over all
    months of the monthly surface temperature; each month = mean(day, night) if both exist, otherwise
    whichever exists), `lower_better full -10, zero 0`. Removes the warm bias from missing polar-night
    daytime LST; mean annual surface temperature < 0 °C is the permafrost-relevant quantity.
  - d) `deck.json` breakdown text is generated per target (`breakdown: Partial<Record<TargetId, …>>`).
  - e) `known_sites.json`: Yungay stays flagged as unverified; `relevant_targets` accepted.
  - Also filled the eight empty `rationale` fields and added the `scoring`, `method` (radii, top fraction,
    Monte Carlo settings incl. seed) and `not_captured` sections, so they are pre-registered too.
  - Not changed: `ice_proxy` (mission-only, `mission_features.json`) still uses `lst_day_mean_c`.
