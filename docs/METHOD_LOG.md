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
- 2026-11-14 — `freeze scoring config v1` committed (4cfc24a) before any real-data feature run.
- 2026-11-14 — **Post-freeze code fixes (no scoring rule changed):**
  - `pipeline/download.py`: `earthaccess.download()` stalled indefinitely (8 parallel connections to
    LP DAAC, no bytes received for >10 min). Replaced by a sequential streaming download over
    earthaccess's authenticated session, with read timeouts, `.part` files and up to 4 retries.
    One transient HTTP 502 (MOD13C2 July granule) was recovered by a retry.
  - `pipeline/features.py`: MERRA-2 files opened with xarray engine `netcdf4` instead of `h5netcdf`
    (`h5netcdf` needs `h5py`, which is not installed). Reader change only; values and units unchanged.
  - `pipeline/regrid.py`: GLiM class-column detection accepted only `object` dtype; pandas 3.1 stores
    text as the `str` dtype, so the full-resolution loader fell back to the 0.5 deg grid on the first
    features run. That run was stopped before scoring; detection now accepts string dtypes and finds
    column `xx`. features was re-run from scratch with full-resolution GLiM.
