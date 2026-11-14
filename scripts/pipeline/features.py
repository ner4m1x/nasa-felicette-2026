"""Feature extraction onto the 0.25 deg land grid -> scripts/out/features_0p25.nc."""
from __future__ import annotations

import calendar
import re
import warnings
import zipfile
from pathlib import Path

import numpy as np

from .common import CONFIG, LATS, LONS, NLAT, NLON, OUT, RAW, latlon_to_idx, load_json, log, now_iso, save_json
from .regrid import (apply_scale, cmg_to_grid, dem_features, glim_fractions_0p5, glim_fractions_full, list_sds,
                     merra_to_grid, read_modis_sds)

FEATURES_NC = OUT / "features_0p25.nc"
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
    water, snow, barren, water005 = [], [], [], []
    for f in _files("MCD12C1", years):
        sds = list_sds(f)
        name = "Land_Cover_Type_1_Percent"  # IGBP scheme, one percent layer per class value 0..16
        if name not in sds:
            raise SystemExit(f"{f.name}: SDS {name} not found; available: {sorted(sds)}")
        shape = sds[name][1]
        if len(shape) != 3 or shape[2] != 17:
            raise SystemExit(f"{f.name}: {name} has shape {shape}, expected (3600, 7200, 17)")
        layers = {}
        for cls in (0, 15, 16):
            a, m = read_modis_sds(f, name, layer=cls)
            layers[cls] = a
        meta_log["MCD12C1"] = {"sds": name, **{k: m[k] for k in ("scale_factor", "add_offset", "fill", "valid_range", "units", "convention")}}
        water005.append(layers[0])
        water.append(cmg_to_grid(layers[0]))
        snow.append(cmg_to_grid(layers[15]))
        barren.append(cmg_to_grid(layers[16]))
        log(f"  MCD12C1 {f.name}: {name}")
    return _nanmean(np.stack(water)), _nanmean(np.stack(snow)), _nanmean(np.stack(barren)), _nanmean(np.stack(water005))


def ndvi(years, meta_log):
    per_year_mean, per_year_max = [], []
    for y in years:
        months = []
        for f in _files("MOD13C2", [y]):
            a, m = read_modis_sds(f, "CMG 0.05 Deg Monthly NDVI")
            months.append(cmg_to_grid(a))
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


# ------------------------------------------------------------------ main
def run(years: list[int]):
    import xarray as xr

    OUT.mkdir(parents=True, exist_ok=True)
    meta_log: dict = {}
    mcfg = load_json(CONFIG / "mission_features.json")
    log("land cover (MCD12C1) ...")
    water, snowice, barren, water005 = landcover(years, meta_log)
    log("NDVI (MOD13C2) ...")
    ndvi_mean, ndvi_max = ndvi(years, meta_log)
    log("LST (MOD11C3) ...")
    L = lst(years, meta_log)
    log("MERRA-2 precipitation / dust ...")
    precip = merra("M2TMNXFLX", "PRECTOTCORR", years, meta_log, "precip")
    dust = merra("M2TMNXAER", "DUEXTTAU", years, meta_log, "mean")
    log("DEM (ETOPO 2022 60s) ...")
    etopo = RAW / "ETOPO_2022_60s" / "ETOPO_2022_v1_60s_N90W180_surface.nc"
    dem = dem_features(etopo, water005, slope_flat_deg=mcfg["trafficable_frac"]["slope_threshold_deg"])
    log("GLiM lithology ...")
    gl = glim(meta_log)

    F = {
        "precip_mm_yr": precip, "ndvi_mean": ndvi_mean, "ndvi_max": ndvi_max,
        "lst_day_mean_c": L["day"], "lst_night_mean_c": L["night"], "lst_diurnal_range_k": L["range"],
        "lst_night_min_c": L["nmin"], "lst_allmonth_mean_c": L["allmonth"], "barren_frac": barren, "snowice_frac": snowice, "water_frac": water,
        "unvegetated_frac": barren + snowice, "dust_aod": dust, **dem,
        "basalt_frac": gl["vb"], "pb_frac": gl["pb"],
        "polar_day_frac": np.repeat(polar_day_fraction()[:, None], NLON, axis=1),
    }
    F["ice_proxy"] = ice_proxy(F["lst_day_mean_c"], F["snowice_frac"], mcfg["ice_proxy"])
    land = np.isfinite(water) & (water < 50)

    ds = xr.Dataset(
        {k: (("lat", "lon"), np.asarray(v, np.float32),
             {"units": UNITS[k], "source": SOURCE[k], "description": DESCRIPTION[k],
              "analog_score_input": "no" if k in MISSION_ONLY else "allowed"})
         for k, v in F.items()},
        coords={"lat": ("lat", LATS, {"units": "degrees_north"}), "lon": ("lon", LONS, {"units": "degrees_east"})},
    )
    ds["land_mask"] = (("lat", "lon"), land.astype(np.uint8), {"description": "1 where MCD12C1 water fraction < 50 %"})
    ds.attrs.update({"title": "Felicette global scan features, 0.25 deg", "years": ",".join(map(str, years)),
                     "created": now_iso(), "read_metadata": str(meta_log)})
    ds.to_netcdf(FEATURES_NC)
    log(f"wrote {FEATURES_NC} ({FEATURES_NC.stat().st_size/1e6:.1f} MB), land cells: {int(land.sum())}")

    # coverage per feature on land
    cov = {k: float(np.isfinite(np.asarray(v))[land].mean()) for k, v in F.items()}
    checks = sanity_checks(F, land, load_json(CONFIG / "sanity_checks.json"))
    for c in checks:
        log(f"  [{c['result']}] {c['region']}: {c['feature']} = {c['value']:.4g} ({c['condition']}; {c['where']})")
    save_json(SANITY_JSON, {"generated": now_iso(), "years": years, "checks": checks, "land_coverage": cov,
                            "read_metadata": meta_log})
    if any(c["result"] == "FAIL" for c in checks):
        raise SystemExit("sanity check FAILED: stop and inspect (likely a unit/scale bug)")
    return ds
