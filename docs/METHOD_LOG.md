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
- 2026-11-14 — **Memory refactor, no change to feature definitions.** The first full `features` run
  ran the laptop out of memory (14 GB RAM + 8 GB swap). Cause: `glim_fractions_full` loaded all
  1,235,259 GLiM MultiPolygons into one GeoDataFrame and reprojected them in one go (Eckert IV → EPSG:4326).
  `scripts/config/` is untouched (still v1 from 4cfc24a). Code changes:
  - `regrid.glim_fractions_full`: polygons are streamed from the FileGDB in chunks of 20,000 features
    (pyogrio `skip_features`/`max_features`), reprojected per chunk and burnt in file order into one
    uint8 class raster at 0.025° (`rasterize(..., out=...)`). Later polygons overwrite earlier ones,
    as in the former single `rasterize` call. vb/pb/land pixels are then counted per 0.25° cell in
    latitude bands (integer counts; fraction = 100 · count_class / count_land, the same quantity as
    before, up to float32 rounding).
  - `regrid.dem_features`: ETOPO processed in latitude bands of 24 output rows (+1-pixel halo for the
    N–S gradient) instead of one row at a time; per-cell pixels and gradients unchanged.
  - `regrid.apply_scale` scales in float64 blocks of 600 rows into a float32 output; `regrid.cmg_to_grid`
    block-aggregates in 600-row bands. Each 0.05° granule is aggregated to 0.25° immediately and
    dropped; only 0.25° monthly grids are stacked. `features.landcover` keeps the 0.05° water
    percentage only as a running sum/count and stores the thresholded mask (water ≥ 50 %) for the DEM.
  - `features.run`: each source (`landcover ndvi lst precip dust dem glim`) is cached separately in
    `scripts/out/features_parts/<source>.npz` + `.json` (atomic write), with runtime and peak RSS
    (`/proc/self/status` VmHWM, reset per stage). `features --sources <s>` computes one part;
    `features` with no `--sources` computes missing parts and assembles `features_0p25.nc`.
    `--force` recomputes. Stage resources are written to `sanity_checks.json` (`stage_resources`).
  - Heavy commands now run in a memory-capped scope: `systemd-run --user --scope -p MemoryMax=7G -p MemorySwapMax=1G`.
  - Equivalence check: landcover, NDVI, LST, MERRA-2 precip/dust and all DEM features from the
    refactored code were compared with the pre-refactor code (HEAD fc3d146) on the real 2023 data:
    **bit-identical** (max abs diff 0.0, identical NaN masks). New unit tests check banded
    `apply_scale` and `cmg_to_grid` against whole-array results.
  - Result: all seven parts plus the assembly ran under the cap. Largest stage was GLiM, at 1.46 GB peak RSS and 115 s.
    All 8 sanity checks PASS, and `score` ran. GLiM was not compared with the pre-refactor code, because that code
    ran out of memory; its Iceland check passes (basalt_frac median 100 %).
- 2026-11-14 — **Observation (no change made):** MOD13C2 NDVI is missing for every land cell south of
  60° S (96,802 cells, all of them Antarctic). So `mars_jezero`, `mars_arcadia` and `moon_tranquillitatis_pit`,
  which use `ndvi_max`, leave all of Antarctica unscored (NaN). Only `moon_shackleton` scores it.
  This is how v1 behaves when a feature is missing, and it is reported before any validation run.
- 2026-11-14 — **Config v2 (pre-validation).** `scripts/config/targets.json` goes from `version` 1 to 2
  (`config_id` `targets-v2`). It is frozen by the commit `freeze scoring config v2`.
  - **Reason:** MOD13C2 NDVI is missing for all 96,802 land cells south of 60° S (see the observation above).
    Under v1, `mars_jezero`, `mars_arcadia` and `moon_tranquillitatis_pit` left all of Antarctica unscored.
  - **Rule** (`scoring.missing_data_imputation`, id `ndvi_no_modis_coverage`; generic, not region-specific):
    on a land cell, if `ndvi_mean`/`ndvi_max` is missing AND the MCD12C1 non-vegetated share of the cell's
    LAND part, `nonveg_land_share = (barren_frac + snowice_frac) / (100 - water_frac)`, is >= 0.95, then
    `ndvi_mean` = `ndvi_max` = 0.0 and the cell is flagged `ndvi_imputed`. The share is undefined (no
    imputation) where `water_frac` >= 100 or an input is missing. Otherwise the cell stays unscored, as
    before. Present NDVI values are never changed, and no other feature is imputed. `missing_feature_policy`
    now points to this rule.
  - **Rationale:** MOD13C2 is not produced over Antarctica. A missing product is not evidence of vegetation,
    and land cover independently shows a non-vegetated surface. The share is taken over land only because
    open water is not vegetation and must not block imputation in coastal cells.
  - **Refinement before the freeze:** a first draft of v2, never committed, used `unvegetated_frac` >= 95 %
    over the whole cell. That draft imputed 94,565 cells and left 2,237 Antarctic coastal cells without NDVI,
    because their remainder was water, not vegetation. The condition was changed to the land-only share
    before `freeze scoring config v2`. Nothing beyond land-cell counts had been looked at.
  - **Unchanged:** every target, dimension, weight, threshold and rationale, plus `method` and `not_captured`
    (checked by a diff of the parsed JSON: only `scoring.missing_feature_policy` and
    `scoring.missing_data_imputation` differ).
  - **Effect:** all 96,802 land cells without NDVI are imputed. All lie south of 60° S, 4,114 of them
    coastal (water_frac > 0), and the lowest `nonveg_land_share` among them is 0.9555. No land cell
    remains without NDVI.
    Scored land cells (of 341,212), v1 → v2: `moon_shackleton` 341,204 → 341,204;
    `moon_tranquillitatis_pit` 244,243 → 340,922; `mars_jezero` 244,402 → 341,204; `mars_arcadia` 244,402 → 341,204.
    The rest are unscored for other missing inputs: 8 cells without MOD11C3 night LST, and on the pit
    target also cells without GLiM lithology. The McMurdo Dry Valleys site now has scored cells within its
    25 km radius for both relevant targets (`mars_arcadia`, `moon_shackleton`): 15 of 15, all imputed.
    Only cell presence was checked; no score or percentile was looked at.
  - **Provenance in outputs:** `ndvi_imputed` (uint8) is stored in `features_0p25.nc` and copied to
    `scores_0p25.nc` (`flag__ndvi_imputed`). It is carried as follows:
    - `validation_report.json`: per site and target (`ndvi_imputed`), per site, and as a cell count;
    - `deck.json`: optional `ndviImputed` on each card, added to `deck.schema.json` (the TS type needs
      `ndviImputed?: boolean`);
    - `curated_grid_values.json`;
    - `scan_grid.bin`: a `flag` band.
    UI label: "NDVI imputed (no MODIS coverage)".
  - **Guard:** `score` refuses to run if `features_0p25.nc` was assembled under a different config version.
  - **At the time of this change, no validation, percentile, sensitivity or candidate result had been
    computed under v1 or v2.** `validate` had never run. Only the feature sanity checks and the
    land-cell counts per target had been seen.
- 2026-11-14 — **First validation run** on config v2 (de66a69, clean), followed by sensitivity (200 runs,
  seed 20261114), candidates and `export --publish`. No config change was made after seeing the results.
  For every target, the benchmark median percentile is above the trap median (see docs/VALIDATION_REPORT.md).
  Lanzarote cannot be scored on the 0.25° grid: only two cell centres lie within 25 km, and both count as
  ocean (MCD12C1 water 50.2 % and 74.1 %, land mask < 50 %). It is reported as "not scorable", and the
  radius and land mask were not changed.
