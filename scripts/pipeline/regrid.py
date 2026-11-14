"""Readers and regridding onto the common 0.25 deg grid.

Scale factors, offsets and fill values are always read from file metadata.
"""
from __future__ import annotations

from pathlib import Path

import numpy as np

from .common import LATS, LONS, NLAT, NLON, block_reduce, log


# ------------------------------------------------------------------ MODIS HDF4
def _sds_attrs(sds) -> dict:
    a = sds.attributes()
    vr = a.get("valid_range")
    return {
        "scale_factor": a.get("scale_factor"),
        "add_offset": a.get("add_offset", 0.0),
        "fill": a.get("_FillValue"),
        "valid_range": list(vr) if vr is not None else None,
        "units": a.get("units"),
        "long_name": a.get("long_name"),
    }


def apply_scale(raw: np.ndarray, meta: dict) -> tuple[np.ndarray, str]:
    """Convert stored integers to physical values using the file's own attributes.

    Two conventions exist in MODIS land products:
      * HDF4 SD standard (e.g. MOD11 LST, scale_factor = 0.02):  phys = scale_factor * (raw - add_offset)
      * MODIS VI products (MOD13, scale_factor = 10000):           phys = (raw - add_offset) / scale_factor
    The VI convention is recognised by scale_factor > 1, which only makes sense as a divisor here.
    """
    raw = raw.astype(np.float64)
    out = raw.copy()
    mask = np.zeros(raw.shape, bool)
    if meta.get("fill") is not None:
        mask |= raw == float(meta["fill"])
    if meta.get("valid_range"):
        lo, hi = meta["valid_range"]
        mask |= (raw < float(lo)) | (raw > float(hi))
    sf = meta.get("scale_factor")
    off = float(meta.get("add_offset") or 0.0)
    if sf is None:
        conv = "no scale_factor attribute: raw values used"
    elif float(sf) > 1.0:
        out = (raw - off) / float(sf)
        conv = f"(raw - {off}) / {sf}  [MODIS VI convention]"
    else:
        out = float(sf) * (raw - off)
        conv = f"{sf} * (raw - {off})  [HDF4 SD convention]"
    out[mask] = np.nan
    return out.astype(np.float32), conv


def read_modis_sds(path: Path, name: str, layer: int | None = None) -> tuple[np.ndarray, dict]:
    from pyhdf.SD import SD, SDC

    f = SD(str(path), SDC.READ)
    try:
        sds = f.select(name)
        meta = _sds_attrs(sds)
        raw = sds[:, :, layer] if layer is not None else sds[:]
        sds.endaccess()
    finally:
        f.end()
    arr, conv = apply_scale(np.asarray(raw), meta)
    meta["convention"] = conv
    return arr, meta


def list_sds(path: Path) -> dict:
    from pyhdf.SD import SD, SDC

    f = SD(str(path), SDC.READ)
    try:
        return {k: v for k, v in f.datasets().items()}
    finally:
        f.end()


def cmg_to_grid(a005: np.ndarray, how: str = "mean") -> np.ndarray:
    """0.05 deg CMG (3600 x 7200, north-up from 90N/-180) -> 0.25 deg (720 x 1440)."""
    if a005.shape != (3600, 7200):
        raise ValueError(f"unexpected CMG shape {a005.shape}")
    return block_reduce(a005, 5, how).astype(np.float32)


# ------------------------------------------------------------------ MERRA-2
def merra_to_grid(field: np.ndarray, lat: np.ndarray, lon: np.ndarray) -> np.ndarray:
    """Bilinear interpolation of a MERRA-2 (lat, lon) field to the 0.25 deg cell centres (lon wraps)."""
    from scipy.interpolate import RegularGridInterpolator

    if lat[0] > lat[-1]:
        lat = lat[::-1]
        field = field[::-1]
    lon = np.asarray(lon, float)
    lon_p = np.concatenate([lon[-1:] - 360.0, lon, lon[:1] + 360.0])
    f_p = np.concatenate([field[:, -1:], field, field[:, :1]], axis=1)
    it = RegularGridInterpolator((lat, lon_p), f_p, method="linear", bounds_error=False, fill_value=None)
    la, lo = np.meshgrid(LATS, LONS, indexing="ij")
    return it(np.stack([la.ravel(), lo.ravel()], -1)).reshape(NLAT, NLON).astype(np.float32)


# ------------------------------------------------------------------ DEM
def dem_features(etopo: Path, water_pct_005: np.ndarray, slope_flat_deg: float = 5.0, min_px: int = 20) -> dict:
    """Block statistics of a 60 arc-second DEM inside each 0.25 deg cell.

    DEM pixels whose 0.05 deg MCD12C1 water fraction is >= 50 % are excluded, so coastal cells do
    not mix in bathymetry. Slope uses the latitude-dependent east-west pixel width.
    """
    import netCDF4
    from tqdm import tqdm

    R = 6371008.8
    ds = netCDF4.Dataset(str(etopo))
    try:
        zname = "z" if "z" in ds.variables else [v for v in ds.variables if ds.variables[v].ndim == 2][0]
        z = ds.variables[zname]
        z.set_auto_maskandscale(True)
        lat = ds.variables["lat"][:].astype(float)
        lon = ds.variables["lon"][:].astype(float)
        H, W = z.shape
        if (H, W) != (10800, 21600):
            raise ValueError(f"unexpected DEM shape {(H, W)}")
        if not (lon[0] < -179.9 and lon[-1] > 179.9):
            raise ValueError("DEM longitudes do not start at -180")
        ascending = lat[0] < lat[-1]
        f = H // NLAT  # 15 DEM rows per output row
        res = 180.0 / H
        dlat = np.radians(res) * R
        water_px = water_pct_005 >= 50  # (3600, 7200), 3 DEM px per CMG px

        out = {k: np.full((NLAT, NLON), np.nan, np.float32) for k in
               ("relief_std_m", "slope_mean_deg", "slope_p90_deg", "trafficable_frac", "elev_mean_m")}

        def read_rows(a: int, b: int) -> np.ndarray:
            """north-up DEM rows [a, b)"""
            a, b = max(a, 0), min(b, H)
            if ascending:
                blk = z[H - b:H - a, :][::-1]
            else:
                blk = z[a:b, :]
            return np.ma.filled(blk.astype(np.float64), np.nan)

        for i in tqdm(range(NLAT), desc="DEM", unit="row"):
            a, b = i * f, (i + 1) * f
            zz = read_rows(a - 1, b + 1)
            top_pad = 1 if a > 0 else 0
            # north-up latitude of each row in zz
            rows = np.arange(a - top_pad, a - top_pad + zz.shape[0])
            plat = 90.0 - (rows + 0.5) * res
            dx = (np.radians(res) * R * np.cos(np.radians(plat)))[:, None]
            dzdx = (np.roll(zz, -1, axis=1) - np.roll(zz, 1, axis=1)) / (2 * dx)
            dzdy = np.gradient(zz, axis=0) / dlat
            slope = np.degrees(np.arctan(np.hypot(dzdx, dzdy)))
            sl = slope[top_pad:top_pad + f]
            el = zz[top_pad:top_pad + f]
            # DEM north-up row r lies in CMG row r // 3 (3 x 3 DEM pixels per 0.05 deg cell)
            cm_rows = np.arange(a, b) // 3
            wm = np.repeat(water_px[cm_rows], 3, axis=1)
            el = np.where(wm, np.nan, el)
            sl = np.where(wm | ~np.isfinite(el), np.nan, sl)
            eb = el.reshape(f, NLON, f).transpose(1, 0, 2).reshape(NLON, f * f)
            sb = sl.reshape(f, NLON, f).transpose(1, 0, 2).reshape(NLON, f * f)
            n = np.isfinite(sb).sum(1)
            ok = n >= min_px
            if not ok.any():
                continue
            with np.errstate(all="ignore"):
                import warnings

                with warnings.catch_warnings():
                    warnings.simplefilter("ignore", RuntimeWarning)
                    out["relief_std_m"][i, ok] = np.nanstd(eb[ok], axis=1)
                    out["elev_mean_m"][i, ok] = np.nanmean(eb[ok], axis=1)
                    out["slope_mean_deg"][i, ok] = np.nanmean(sb[ok], axis=1)
                    out["slope_p90_deg"][i, ok] = np.nanpercentile(sb[ok], 90, axis=1)
                    out["trafficable_frac"][i, ok] = (np.nan_to_num(sb[ok], nan=999) < slope_flat_deg).sum(1) / n[ok]
    finally:
        ds.close()
    return out


# ------------------------------------------------------------------ GLiM
GLIM_CODES = ["su", "vb", "ss", "pb", "sm", "sc", "va", "mt", "pa", "vi", "wb", "py", "pi", "ev", "nd", "ig"]
GLIM_NOT_LAND = {"wb", "nd"}


def _find_class_column(gdf) -> str:
    import pandas as pd

    codes = set(GLIM_CODES)
    for c in gdf.columns:
        # pandas >= 3 stores text as the 'str' dtype, not object
        if c == "geometry" or not (gdf[c].dtype == object or pd.api.types.is_string_dtype(gdf[c].dtype)):
            continue
        vals = set(str(v).strip().lower() for v in gdf[c].dropna().unique()[:200])
        if vals and vals <= codes:
            return c
    raise ValueError(f"no GLiM first-level class column among {list(gdf.columns)}")


def glim_fractions_full(gdb_dir: Path, sub: int = 10) -> tuple[dict, dict]:
    """Rasterise full-resolution GLiM polygons at 0.25/sub deg and compute class fractions (%) per cell."""
    import geopandas as gpd
    import pyogrio
    from rasterio import features
    from rasterio.transform import from_origin

    layers = pyogrio.list_layers(str(gdb_dir))
    poly_layers = [l[0] for l in layers if l[1] and "Polygon" in str(l[1])]
    if not poly_layers:
        raise ValueError(f"no polygon layer in {gdb_dir}: {layers}")
    layer = poly_layers[0]
    info = pyogrio.read_info(str(gdb_dir), layer=layer)
    fields = list(info["fields"])
    # read a sample to find the class column without loading everything
    sample = gpd.read_file(str(gdb_dir), layer=layer, max_features=500, engine="pyogrio")
    col = _find_class_column(sample)
    log(f"GLiM: layer={layer!r}, features={info['features']}, crs={info['crs']}, class column={col!r}")
    gdf = gpd.read_file(str(gdb_dir), layer=layer, columns=[col], engine="pyogrio")
    if gdf.crs is not None and not gdf.crs.equals("EPSG:4326"):
        log(f"GLiM: reprojecting {len(gdf)} polygons to EPSG:4326 ...")
        gdf = gdf.to_crs("EPSG:4326")
    code_id = {c: k + 1 for k, c in enumerate(GLIM_CODES)}
    vals = gdf[col].astype(str).str.strip().str.lower().map(code_id).fillna(0).astype(np.uint8)
    res = 0.25 / sub
    H, W = int(round(180 / res)), int(round(360 / res))
    log(f"GLiM: rasterising to {W}x{H} ({res} deg) ...")
    ras = features.rasterize(
        ((g, int(v)) for g, v in zip(gdf.geometry.values, vals.values) if g is not None and v > 0),
        out_shape=(H, W), transform=from_origin(-180, 90, res, res), fill=0, dtype="uint8",
    )
    land = np.isin(ras, [code_id[c] for c in GLIM_CODES if c not in GLIM_NOT_LAND])
    n_land = block_reduce(land.astype(np.float32), sub, "mean")
    out = {}
    for c in ("vb", "pb"):
        hit = block_reduce((ras == code_id[c]).astype(np.float32), sub, "mean")
        with np.errstate(invalid="ignore", divide="ignore"):
            out[c] = np.where(n_land > 0, 100.0 * hit / n_land, np.nan).astype(np.float32)
    meta = {"mode": "full-resolution polygons", "layer": layer, "class_column": col, "fields": fields,
            "raster_res_deg": res, "features": int(info["features"])}
    return out, meta


def glim_fractions_0p5(asc: Path, classnames: Path) -> tuple[dict, dict]:
    """Fallback: 0.5 deg dominant-class grid. Each 0.25 cell inherits its parent class (0 or 100 %)."""
    code_of = {}
    with open(classnames) as fh:
        next(fh)
        for line in fh:
            parts = [p.strip().strip('"') for p in line.strip().split(";")]
            if len(parts) >= 4:
                code_of[parts[3].lower()] = int(parts[1])
    hdr = {}
    with open(asc) as fh:
        for _ in range(6):
            k, v = fh.readline().split()
            hdr[k.lower()] = float(v)
    g = np.loadtxt(asc, skiprows=6)
    g = np.repeat(np.repeat(g, 2, axis=0), 2, axis=1)  # 0.5 -> 0.25
    nod = hdr.get("nodata_value", -9999)
    out = {}
    land = (g != nod) & (g != code_of["wb"]) & (g != code_of["nd"])
    for c in ("vb", "pb"):
        out[c] = np.where(land, np.where(g == code_of[c], 100.0, 0.0), np.nan).astype(np.float32)
    return out, {"mode": "0.5 deg dominant class (fallback): fractions are 0 or 100 %"}
