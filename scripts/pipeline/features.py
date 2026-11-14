"""Feature extraction onto the 0.25 deg land grid -> scripts/out/features_0p25.nc."""
from __future__ import annotations

import calendar
import os
import re
import time
import warnings
import zipfile
from pathlib import Path

import numpy as np

from .common import (CONFIG, LATS, LONS, NLAT, NLON, OUT, RAW, latlon_to_idx, load_json, log, mem_peak_mb,
                     mem_reset_peak, now_iso, save_json)
from .regrid import (cmg_to_grid, dem_features, glim_fractions_0p5, glim_fractions_full, list_sds,
                     merra_to_grid, read_modis_sds)

FEATURES_NC = OUT / "features_0p25.nc"
PARTS = OUT / "features_parts"
SANITY_JSON = OUT / "sanity_checks.json"

UNITS = {
    "precip_mm_yr": "mm yr-1", "ndvi_mean": "1", "ndvi_max": "1", "lst_day_mean_c": "degC",
    "lst_night_mean_c": "degC", "lst_diurnal_range_k": "K", "lst_night_min_c": "degC",
    "lst_allmonth_mean_c": "degC", "barren_frac": "%",
    "snowice_frac": "%", "water_frac": "%", "unvegetated_frac": "%", "dust_aod": "1", "relief_std_m": "m",
    "slope_mean_deg": "degree", "slope_p90_deg": "degree", "trafficable_frac": "1", "elev_mean_m": "m",
    "basalt_frac": "%", "pb_frac": "%", "polar_day_frac": "1", "ice_proxy": "1",
}
SOURCE = {
    "precip_mm_yr": "M2TMNXFLX PRECTOTCORR", "ndvi_mean": "MOD13C2", "ndvi_max": "MOD13C2",
    "lst_day_mean_c": "MOD11C3", "lst_night_mean_c": "MOD11C3", "lst_diurnal_range_k": "MOD11C3",
    "lst_night_min_c": "MOD11C3", "lst_allmonth_mean_c": "MOD11C3", "barren_frac": "MCD12C1 IGBP class 16", "snowice_frac": "MCD12C1 IGBP class 15",
    "water_frac": "MCD12C1 IGBP class 0", "unvegetated_frac": "derived: barren_frac + snowice_frac",
    "dust_aod": "M2TMNXAER DUEXTTAU", "relief_std_m": "ETOPO 2022 60s", "slope_mean_deg": "ETOPO 2022 60s",
    "slope_p90_deg": "ETOPO 2022 60s", "trafficable_frac": "ETOPO 2022 60s", "elev_mean_m": "ETOPO 2022 60s",
    "basalt_frac": "GLiM class vb", "pb_frac": "GLiM class pb", "polar_day_frac": "computed from latitude",
    "ice_proxy": "derived (see scripts/config/mission_features.json)",
}
DESCRIPTION = {
    "precip_mm_yr": "annual total precipitation (bias-corrected), mean across years",
    "ndvi_mean": "mean of monthly NDVI", "ndvi_max": "max of monthly NDVI (cell block means)",
    "lst_day_mean_c": "annual mean of monthly daytime LST (months with data only)",
    "lst_night_mean_c": "annual mean of monthly night-time LST",
    "lst_diurnal_range_k": "mean of monthly (day - night) LST where both exist",
    "lst_night_min_c": "coldest monthly night-time LST mean",
    "lst_allmonth_mean_c": "mean over months of monthly LST; each month = mean(day, night) if both exist, else whichever exists",
    "barren_frac": "IGBP barren percentage", "snowice_frac": "IGBP permanent snow & ice percentage",
    "water_frac": "IGBP water percentage", "unvegetated_frac": "barren + snow/ice percentage",
    "dust_aod": "annual mean dust extinction AOD at 550 nm", "relief_std_m": "std of DEM elevation in cell (land px)",
    "slope_mean_deg": "mean DEM slope (land px)", "slope_p90_deg": "90th percentile DEM slope (land px)",
    "trafficable_frac": "fraction of land DEM px with slope < threshold (mission_features.json)",
    "elev_mean_m": "mean DEM elevation (land px)",
    "basalt_frac": "percentage of GLiM land area mapped as basic volcanics (vb)",
    "pb_frac": "percentage of GLiM land area mapped as basic plutonics (pb); reported only",
    "polar_day_frac": "fraction of the year with 24 h geometric daylight at cell centre (no refraction)",
    "ice_proxy": "PROXY 0..1, not a measurement of subsurface ice (see mission_features.json)",
}
MISSION_ONLY = ["trafficable_frac", "slope_p90_deg", "ice_proxy"]


def _files(sn: str, years: list[int]) -> list[Path]:
    d = RAW / sn
    fs = sorted(d.glob("*.hdf")) + sorted(d.glob("*.nc4"))
    keep = []
    for f in fs:
        m = re.search(r"\.A(\d{4})\d{3}\.", f.name) or re.search(r"\.(\d{4})\d{2}\.nc4$", f.name)
        if m and int(m.group(1)) in years:
            keep.append(f)
    if not keep:
        raise SystemExit(f"no {sn} files for {years} in {d}; run download first")
    return keep


def _nanmean(stack, axis=0):
    with warnings.catch_warnings():
        warnings.simplefilter("ignore", RuntimeWarning)
        return np.nanmean(stack, axis=axis)


def _nanmax(stack, axis=0):
    with warnings.catch_warnings():
        warnings.simplefilter("ignore", RuntimeWarning)
        return np.nanmax(stack, axis=axis)


def _nanmin(stack, axis=0):
    with warnings.catch_warnings():
        warnings.simplefilter("ignore", RuntimeWarning)
        return np.nanmin(stack, axis=axis)


# ------------------------------------------------------------------ per-dataset
def landcover(years, meta_log):
    """IGBP percent layers -> 0.25 deg fractions, plus the 0.05 deg water >= 50 % mask used by the DEM.

    Memory: each 0.05 deg class layer is read, block-aggregated and dropped immediately; the 0.05 deg
    water percentage is kept only as a running (sum, count) for the multi-year nanmean."""
    water, snow, barren = [], [], []
    w_sum = w_cnt = None
    for f in _files("MCD12C1", years):
        sds = list_sds(f)
        name = "Land_Cover_Type_1_Percent"  # IGBP scheme, one percent layer per class value 0..16
        if name not in sds:
            raise SystemExit(f"{f.name}: SDS {name} not found; available: {sorted(sds)}")
        shape = sds[name][1]
        if len(shape) != 3 or shape[2] != 17:
            raise SystemExit(f"{f.name}: {name} has shape {shape}, expected (3600, 7200, 17)")
        for cls, dest in ((0, water), (15, snow), (16, barren)):
            a, m = read_modis_sds(f, name, layer=cls)
            dest.append(cmg_to_grid(a))
            if cls == 0:
                fin = np.isfinite(a)
                if w_sum is None:
                    w_sum, w_cnt = np.zeros(a.shape, np.float64), np.zeros(a.shape, np.uint16)
                w_sum += np.where(fin, a, 0.0)
                w_cnt += fin
            del a
        meta_log["MCD12C1"] = {"sds": name, **{k: m[k] for k in ("scale_factor", "add_offset", "fill", "valid_range", "units", "convention")}}
        log(f"  MCD12C1 {f.name}: {name}")
    with np.errstate(invalid="ignore", divide="ignore"):
        water005_ge50 = (w_cnt > 0) & (w_sum / np.maximum(w_cnt, 1) >= 50)
    return _nanmean(np.stack(water)), _nanmean(np.stack(snow)), _nanmean(np.stack(barren)), water005_ge50


def ndvi(years, meta_log):
    per_year_mean, per_year_max = [], []
    for y in years:
        months = []  # 0.25 deg monthly grids only (12 x 4 MB); each 0.05 deg granule is dropped at once
        for f in _files("MOD13C2", [y]):
            a, m = read_modis_sds(f, "CMG 0.05 Deg Monthly NDVI")
            months.append(cmg_to_grid(a))
            del a
        meta_log["MOD13C2"] = {"sds": "CMG 0.05 Deg Monthly NDVI", **{k: m[k] for k in ("scale_factor", "add_offset", "fill", "valid_range", "units", "convention")}}
        st = np.stack(months)
        log(f"  MOD13C2 {y}: {len(months)} months")
        per_year_mean.append(_nanmean(st))
        per_year_max.append(_nanmax(st))
    return _nanmean(np.stack(per_year_mean)), _nanmean(np.stack(per_year_max))


def allmonth_mean(day: np.ndarray, night: np.ndarray) -> np.ndarray:
    """Mean over months of the monthly surface temperature.

    Each month uses mean(day, night) where both exist, otherwise whichever exists (polar night ->
    night only, polar day -> day only). Months with neither are skipped. Inputs: (months, H, W)."""
    d, n = np.asarray(day, np.float64), np.asarray(night, np.float64)
    both = np.isfinite(d) & np.isfinite(n)
    monthly = np.where(both, 0.5 * (d + n), np.where(np.isfinite(d), d, n))
    return _nanmean(monthly)


def lst(years, meta_log):
    out = {k: [] for k in ("day", "night", "range", "nmin", "allmonth")}
    for y in years:
        days, nights = [], []
        for f in _files("MOD11C3", [y]):
            d, md = read_modis_sds(f, "LST_Day_CMG")
            n, mn = read_modis_sds(f, "LST_Night_CMG")
            for mm in (md, mn):
                if (mm["units"] or "").strip().lower() not in ("k", "kelvin"):
                    raise SystemExit(f"MOD11C3 LST units are {mm['units']!r}, expected Kelvin")
            days.append(cmg_to_grid(d) - 273.15)
            nights.append(cmg_to_grid(n) - 273.15)
            del d, n
        meta_log["MOD11C3"] = {"sds": ["LST_Day_CMG", "LST_Night_CMG"], **{k: md[k] for k in ("scale_factor", "add_offset", "fill", "valid_range", "units", "convention")}}
        D, N = np.stack(days), np.stack(nights)
        log(f"  MOD11C3 {y}: {len(days)} months")
        out["day"].append(_nanmean(D))
        out["night"].append(_nanmean(N))
        out["range"].append(_nanmean(D - N))
        out["nmin"].append(_nanmin(N))
        out["allmonth"].append(allmonth_mean(D, N))
    return {k: _nanmean(np.stack(v)) for k, v in out.items()}


def merra(sn, var, years, meta_log, how):
    import xarray as xr

    per_year = []
    for y in years:
        fs = _files(sn, [y])
        acc = []
        for f in fs:
            with xr.open_dataset(f, engine="netcdf4", mask_and_scale=True) as ds:
                da = ds[var]
                units = da.attrs.get("units", "")
                arr = da.isel(time=0).values.astype(np.float64)
                lat, lon = ds["lat"].values, ds["lon"].values
                t = np.datetime64(ds["time"].values[0], "D").astype(object)
            if how == "precip":
                if units.replace(" ", "") not in ("kgm-2s-1", "kgm**-2s**-1"):
                    raise SystemExit(f"{sn}.{var} units {units!r}: expected kg m-2 s-1")
                ndays = calendar.monthrange(t.year, t.month)[1]
                arr = arr * 86400.0 * ndays  # kg m-2 s-1 == mm s-1 -> mm per month
            acc.append(merra_to_grid(arr, lat, lon))
        meta_log[sn] = {"var": var, "units_in_file": units, "months": len(fs)}
        if len(acc) != 12:
            log(f"  WARNING {sn} {y}: {len(acc)} months (expected 12)")
        st = np.stack(acc)
        per_year.append(st.sum(0) if how == "precip" else st.mean(0))
        log(f"  {sn} {y}: {len(acc)} months")
    return _nanmean(np.stack(per_year))


def glim(meta_log):
    full = RAW / "GLiM" / "LiMW_GIS_2015.gdb.zip"
    if full.exists():
        ex = RAW / "GLiM" / "extracted"
        if not ex.exists():
            with zipfile.ZipFile(full) as z:
                z.extractall(ex)
        gdbs = [p for p in ex.rglob("*.gdb") if p.is_dir()]
        if gdbs:
            try:
                fr, m = glim_fractions_full(gdbs[0])
                meta_log["GLiM"] = m
                return fr
            except Exception as e:  # noqa: BLE001
                log(f"  GLiM full-resolution failed: {e!r}; using 0.5 deg fallback")
                meta_log["GLiM_full_error"] = repr(e)
    zp = RAW / "GLiM_0p5" / "hartmann-moosdorf_2012.zip"
    if not zp.exists():
        raise SystemExit("no GLiM data; run download")
    ex = RAW / "GLiM_0p5" / "extracted"
    if not ex.exists():
        with zipfile.ZipFile(zp) as z:
            z.extractall(ex)
    fr, m = glim_fractions_0p5(next(ex.rglob("*.asc")), next(ex.rglob("Classnames.txt")))
    meta_log["GLiM"] = m
    return fr


def polar_day_fraction(lats: np.ndarray = LATS) -> np.ndarray:
    """Fraction of a 365-day year with the geometric sun centre above the horizon all day.

    Declination from Spencer (1971) Fourier series; no refraction or terrain horizon.
    """
    n = np.arange(1, 366)
    g = 2 * np.pi * (n - 1) / 365.0
    dec = np.degrees(0.006918 - 0.399912 * np.cos(g) + 0.070257 * np.sin(g) - 0.006758 * np.cos(2 * g)
                     + 0.000907 * np.sin(2 * g) - 0.002697 * np.cos(3 * g) + 0.00148 * np.sin(3 * g))
    lat = lats[:, None]
    polar_day = ((lat > 0) & (lat > 90 - dec[None, :])) | ((lat < 0) & (lat < -90 - dec[None, :]))
    return polar_day.mean(1).astype(np.float32)


def ice_proxy(lst_day_c, snowice_pct, cfg) -> np.ndarray:
    from .scoring import desirability

    parts = [desirability(dict(p), {"lst_day_mean_c": lst_day_c, "snowice_frac": snowice_pct}[p["feature"]])
             for p in cfg["components"]]
    out = np.ones_like(lst_day_c, dtype=np.float64)
    for p in parts:
        out = out * p
    out[~np.isfinite(lst_day_c) | ~np.isfinite(snowice_pct)] = np.nan
    return out.astype(np.float32)


_OPS = {">=": np.greater_equal, ">": np.greater, "<=": np.less_equal, "<": np.less}


def nonveg_land_share(F: dict) -> np.ndarray:
    """(barren + snow/ice) / (100 - water): non-vegetated share of the LAND part of a cell (0..1).

    NaN where water_frac >= 100 or any input is missing (targets.json condition_definition)."""
    b, s, w = (np.asarray(F[k], np.float64) for k in ("barren_frac", "snowice_frac", "water_frac"))
    with np.errstate(invalid="ignore", divide="ignore"):
        out = (b + s) / (100.0 - w)
    return np.where(np.isfinite(w) & (w < 100.0), out, np.nan)


# condition quantities that are derived on the fly rather than stored as features
DERIVED_CONDITIONS = {"nonveg_land_share": nonveg_land_share}


def apply_imputation(F: dict, land: np.ndarray, rules: list[dict]) -> tuple[dict, dict]:
    """Apply the pre-registered missing-data rules of targets.json (scoring.missing_data_imputation).

    For each rule: on land cells where any of rule["features"] is NaN and the condition holds,
    every feature of the rule is set to rule["set_to"] and the cell is flagged. Cells that miss the
    feature but fail the condition stay NaN (unscored). Present values are never changed.
    Returns (flags {flag_name: bool array}, counts {rule id: n_cells}). F is modified in place."""
    flags, counts = {}, {}
    for r in rules:
        feats = r["features"]
        missing = np.zeros(land.shape, bool)
        for f in feats:
            missing |= ~np.isfinite(F[f])
        c = r["condition"]
        cv = (DERIVED_CONDITIONS[c["feature"]](F) if c["feature"] in DERIVED_CONDITIONS
              else np.asarray(F[c["feature"]], np.float64))
        with np.errstate(invalid="ignore"):
            cond = np.isfinite(cv) & _OPS[c["op"]](cv, float(c["value"]))
        hit = land & missing & cond
        for f in feats:
            F[f] = np.where(hit, np.float32(r["set_to"]), F[f]).astype(np.float32)
        flags[r["flag"]] = flags.get(r["flag"], np.zeros(land.shape, bool)) | hit
        counts[r["id"]] = int(hit.sum())
    return flags, counts


# ------------------------------------------------------------------ sanity checks
def _box(feat, lat0, lat1, lon0, lon1, land):
    rows = (LATS >= lat0) & (LATS <= lat1)
    cols = (LONS >= lon0) & (LONS <= lon1)
    sub = feat[np.ix_(rows, cols)]
    lm = land[np.ix_(rows, cols)]
    v = sub[lm & np.isfinite(sub)]
    return float(np.median(v)) if v.size else float("nan"), int(v.size)


def sanity_checks(F: dict, land: np.ndarray, cfg: dict) -> list[dict]:
    res = []
    for chk in cfg["checks"]:
        if "box" in chk:
            b = chk["box"]
            val, n = _box(F[chk["feature"]], b["lat"][0], b["lat"][1], b["lon"][0], b["lon"][1], land)
            where = f"median of {n} land cells in lat {b['lat']} lon {b['lon']}"
        else:
            i, j = latlon_to_idx(chk["point"]["lat"], chk["point"]["lon"])
            val, where = float(F[chk["feature"]][i, j]), f"cell containing ({chk['point']['lat']}, {chk['point']['lon']})"
        ok = np.isfinite(val) and (val < chk["lt"] if "lt" in chk else val > chk["gt"])
        res.append({"region": chk["region"], "feature": chk["feature"], "value": val,
                    "condition": (f"< {chk['lt']}" if "lt" in chk else f"> {chk['gt']}"), "where": where,
                    "result": "PASS" if ok else "FAIL"})
    return res


# ------------------------------------------------------------------ per-source parts (cached)
# Each source's 0.25 deg result is cached in scripts/out/features_parts/<source>.npz (+ .json meta),
# written atomically, so a crash never redoes a finished source. Order matters only for "dem",
# which needs the 0.05 deg water mask from "landcover".
SOURCES = ["landcover", "ndvi", "lst", "precip", "dust", "dem", "glim"]


def _part_paths(name: str) -> tuple[Path, Path]:
    return PARTS / f"{name}.npz", PARTS / f"{name}.json"


def load_part(name: str, years: list[int]) -> tuple[dict, dict] | None:
    npz, js = _part_paths(name)
    if not (npz.exists() and js.exists()):
        return None
    meta = load_json(js)
    if name not in ("dem", "glim") and meta.get("years") != list(years):
        log(f"  part {name}: cached for years {meta.get('years')}, need {years} -> recompute")
        return None
    with np.load(npz) as z:
        arrays = {k: z[k] for k in z.files}
    return arrays, meta


def _save_part(name: str, arrays: dict, meta: dict):
    PARTS.mkdir(parents=True, exist_ok=True)
    npz, js = _part_paths(name)
    tmp = npz.with_name(npz.stem + ".tmp.npz")
    np.savez(tmp, **{k: np.asarray(v) for k, v in arrays.items()})
    os.replace(tmp, npz)
    save_json(js.with_suffix(".tmp.json"), meta)
    os.replace(js.with_suffix(".tmp.json"), js)


def _compute_part(name: str, years: list[int]) -> tuple[dict, dict]:
    ml: dict = {}
    if name == "landcover":
        log("land cover (MCD12C1) ...")
        water, snowice, barren, w005 = landcover(years, ml)
        arrays = {"water_frac": water, "snowice_frac": snowice, "barren_frac": barren, "water005_ge50": w005}
    elif name == "ndvi":
        log("NDVI (MOD13C2) ...")
        m, x = ndvi(years, ml)
        arrays = {"ndvi_mean": m, "ndvi_max": x}
    elif name == "lst":
        log("LST (MOD11C3) ...")
        L = lst(years, ml)
        arrays = {"lst_day_mean_c": L["day"], "lst_night_mean_c": L["night"], "lst_diurnal_range_k": L["range"],
                  "lst_night_min_c": L["nmin"], "lst_allmonth_mean_c": L["allmonth"]}
    elif name == "precip":
        log("MERRA-2 precipitation ...")
        arrays = {"precip_mm_yr": merra("M2TMNXFLX", "PRECTOTCORR", years, ml, "precip")}
    elif name == "dust":
        log("MERRA-2 dust ...")
        arrays = {"dust_aod": merra("M2TMNXAER", "DUEXTTAU", years, ml, "mean")}
    elif name == "dem":
        lc = load_part("landcover", years)
        if lc is None:
            raise SystemExit("features: 'dem' needs the 'landcover' part (0.05 deg water mask); run it first")
        w005 = lc[0]["water005_ge50"].astype(bool)
        del lc
        log("DEM (ETOPO 2022 60s) ...")
        mcfg = load_json(CONFIG / "mission_features.json")
        etopo = RAW / "ETOPO_2022_60s" / "ETOPO_2022_v1_60s_N90W180_surface.nc"
        arrays = dem_features(etopo, w005, slope_flat_deg=mcfg["trafficable_frac"]["slope_threshold_deg"])
    elif name == "glim":
        log("GLiM lithology ...")
        gl = glim(ml)
        arrays = {"basalt_frac": gl["vb"], "pb_frac": gl["pb"]}
    else:
        raise ValueError(name)
    arrays = {k: (v if v.dtype == bool else np.asarray(v, np.float32)) for k, v in arrays.items()}
    return arrays, ml


def run_part(name: str, years: list[int], force: bool = False) -> dict:
    if not force:
        cached = load_part(name, years)
        if cached is not None:
            m = cached[1]
            log(f"part {name}: cached ({m.get('runtime_s')} s, peak RSS {m.get('peak_rss_mb')} MB when computed)")
            return m
    mem_reset_peak()
    t0 = time.time()
    arrays, ml = _compute_part(name, years)
    meta = {"source": name, "years": list(years), "created": now_iso(), "runtime_s": round(time.time() - t0, 1),
            "peak_rss_mb": round(mem_peak_mb(), 1), "read_metadata": ml, "arrays": sorted(arrays)}
    _save_part(name, arrays, meta)
    log(f"part {name}: done in {meta['runtime_s']} s, peak RSS {meta['peak_rss_mb']} MB -> {_part_paths(name)[0]}")
    return meta


# ------------------------------------------------------------------ main
def run(years: list[int], sources: list[str] | None = None, force: bool = False):
    """Compute the requested sources (default: all missing ones), then assemble features_0p25.nc.

    With an explicit `sources` list only those parts are computed and nothing is assembled; run
    without `sources` afterwards to assemble from the cache."""
    import xarray as xr

    OUT.mkdir(parents=True, exist_ok=True)
    if sources:
        bad = [s for s in sources if s not in SOURCES]
        if bad:
            raise SystemExit(f"unknown feature sources {bad}; choose from {SOURCES}")
        for s in sources:
            run_part(s, years, force=force)
        return None
    part_meta = {s: run_part(s, years, force=force) for s in SOURCES}

    mem_reset_peak()
    t0 = time.time()
    log("assembling features from cached parts ...")
    P = {}
    meta_log: dict = {}
    for s in SOURCES:
        arrays, m = load_part(s, years)
        P.update(arrays)
        meta_log.update(m.get("read_metadata") or {})
    mcfg = load_json(CONFIG / "mission_features.json")
    water, snowice, barren = P["water_frac"], P["snowice_frac"], P["barren_frac"]

    F = {
        "precip_mm_yr": P["precip_mm_yr"], "ndvi_mean": P["ndvi_mean"], "ndvi_max": P["ndvi_max"],
        "lst_day_mean_c": P["lst_day_mean_c"], "lst_night_mean_c": P["lst_night_mean_c"],
        "lst_diurnal_range_k": P["lst_diurnal_range_k"], "lst_night_min_c": P["lst_night_min_c"],
        "lst_allmonth_mean_c": P["lst_allmonth_mean_c"], "barren_frac": barren, "snowice_frac": snowice, "water_frac": water,
        "unvegetated_frac": barren + snowice, "dust_aod": P["dust_aod"],
        **{k: P[k] for k in ("relief_std_m", "slope_mean_deg", "slope_p90_deg", "trafficable_frac", "elev_mean_m")},
        "basalt_frac": P["basalt_frac"], "pb_frac": P["pb_frac"],
        "polar_day_frac": np.repeat(polar_day_fraction()[:, None], NLON, axis=1),
    }
    F["ice_proxy"] = ice_proxy(F["lst_day_mean_c"], F["snowice_frac"], mcfg["ice_proxy"])
    land = np.isfinite(water) & (water < 50)
    tcfg = load_json(CONFIG / "targets.json")
    rules = tcfg["scoring"].get("missing_data_imputation", [])
    flags, imputed = apply_imputation(F, land, rules)
    for r in rules:
        log(f"imputation {r['id']} (targets.json v{tcfg['version']}): {imputed[r['id']]} land cells -> {r['flag']}")

    ds = xr.Dataset(
        {k: (("lat", "lon"), np.asarray(v, np.float32),
             {"units": UNITS[k], "source": SOURCE[k], "description": DESCRIPTION[k],
              "analog_score_input": "no" if k in MISSION_ONLY else "allowed"})
         for k, v in F.items()},
        coords={"lat": ("lat", LATS, {"units": "degrees_north"}), "lon": ("lon", LONS, {"units": "degrees_east"})},
    )
    ds["land_mask"] = (("lat", "lon"), land.astype(np.uint8), {"description": "1 where MCD12C1 water fraction < 50 %"})
    for r in rules:
        ds[r["flag"]] = (("lat", "lon"), flags[r["flag"]].astype(np.uint8),
                         {"description": f"1 where {', '.join(r['features'])} were imputed by rule {r['id']} "
                                         f"(scripts/config/targets.json scoring.missing_data_imputation)",
                          "rule": r["id"], "set_to": float(r["set_to"]), "flag": "yes"})
    ds.attrs.update({"imputation_config_version": int(tcfg["version"]),
                     "imputation_rules": ",".join(r["id"] for r in rules) or "none",
                     "imputed_cells": str(imputed)})
    ds.attrs.update({"title": "Felicette global scan features, 0.25 deg", "years": ",".join(map(str, years)),
                     "created": now_iso(), "read_metadata": str(meta_log)})
    ds.to_netcdf(FEATURES_NC)
    log(f"wrote {FEATURES_NC} ({FEATURES_NC.stat().st_size/1e6:.1f} MB), land cells: {int(land.sum())}")

    # coverage per feature on land
    cov = {k: float(np.isfinite(np.asarray(v))[land].mean()) for k, v in F.items()}
    checks = sanity_checks(F, land, load_json(CONFIG / "sanity_checks.json"))
    for c in checks:
        log(f"  [{c['result']}] {c['region']}: {c['feature']} = {c['value']:.4g} ({c['condition']}; {c['where']})")
    part_stats = {s: {"runtime_s": m.get("runtime_s"), "peak_rss_mb": m.get("peak_rss_mb")} for s, m in part_meta.items()}
    part_stats["assemble"] = {"runtime_s": round(time.time() - t0, 1), "peak_rss_mb": round(mem_peak_mb(), 1)}
    log(f"assemble: {part_stats['assemble']['runtime_s']} s, peak RSS {part_stats['assemble']['peak_rss_mb']} MB")
    save_json(SANITY_JSON, {"generated": now_iso(), "years": years, "checks": checks, "land_coverage": cov,
                            "read_metadata": meta_log, "stage_resources": part_stats,
                            "imputation": {"config_version": tcfg["version"], "cells": imputed}})
    if any(c["result"] == "FAIL" for c in checks):
        raise SystemExit("sanity check FAILED: stop and inspect (likely a unit/scale bug)")
    return ds
