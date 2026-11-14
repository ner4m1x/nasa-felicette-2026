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


def apply_scale(raw: np.ndarray, meta: dict, block_rows: int = 600) -> tuple[np.ndarray, str]:
    """Convert stored integers to physical values using the file's own attributes.

    Two conventions exist in MODIS land products:
      * HDF4 SD standard (e.g. MOD11 LST, scale_factor = 0.02):  phys = scale_factor * (raw - add_offset)
      * MODIS VI products (MOD13, scale_factor = 10000):           phys = (raw - add_offset) / scale_factor
    The VI convention is recognised by scale_factor > 1, which only makes sense as a divisor here.

    Memory: the arithmetic is done in float64 on blocks of `block_rows` rows and written into a
    float32 output, so a 0.05 deg CMG field never exists as a full float64 copy. Values are
    identical to scaling the whole array at once.
    """
    raw = np.asarray(raw)
    sf = meta.get("scale_factor")
    off = float(meta.get("add_offset") or 0.0)
    if sf is None:
        conv = "no scale_factor attribute: raw values used"
    elif float(sf) > 1.0:
        conv = f"(raw - {off}) / {sf}  [MODIS VI convention]"
    else:
        conv = f"{sf} * (raw - {off})  [HDF4 SD convention]"
    fill = float(meta["fill"]) if meta.get("fill") is not None else None
    vr = meta.get("valid_range")

    def _scale(r: np.ndarray) -> np.ndarray:
        r = r.astype(np.float64)
        mask = np.zeros(r.shape, bool)
        if fill is not None:
            mask |= r == fill
        if vr:
            mask |= (r < float(vr[0])) | (r > float(vr[1]))
        if sf is None:
            o = r
        elif float(sf) > 1.0:
            o = (r - off) / float(sf)
        else:
            o = float(sf) * (r - off)
        o[mask] = np.nan
        return o.astype(np.float32)

    if raw.ndim < 2:
        return _scale(raw), conv
    out = np.empty(raw.shape, np.float32)
    for s in range(0, raw.shape[0], block_rows):
        out[s:s + block_rows] = _scale(raw[s:s + block_rows])
    return out, conv


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
    # latitude bands of 600 rows (120 output rows): identical result, bounded temporaries
    out = np.empty((NLAT, NLON), np.float32)
    for s in range(0, 3600, 600):
        out[s // 5:(s + 600) // 5] = block_reduce(a005[s:s + 600], 5, how)
    return out


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
def dem_features(etopo: Path, water_pct_005: np.ndarray, slope_flat_deg: float = 5.0, min_px: int = 20,
                 band_rows: int = 24) -> dict:
    """Block statistics of a 60 arc-second DEM inside each 0.25 deg cell.

    DEM pixels whose 0.05 deg MCD12C1 water fraction is >= 50 % are excluded, so coastal cells do
    not mix in bathymetry. Slope uses the latitude-dependent east-west pixel width.

    `water_pct_005` is either the 0.05 deg water percentage or an already-thresholded boolean mask
    (water >= 50 %). The DEM is processed in latitude bands of `band_rows` output rows (plus a
    one-pixel halo for the N-S gradient), so only ~1 % of the DEM is in memory at a time. Every
    output cell sees exactly the same pixels and gradients as a whole-array computation.
    """
    import warnings

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
        water_px = water_pct_005 if water_pct_005.dtype == bool else water_pct_005 >= 50  # (3600, 7200)

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

        for i0 in tqdm(range(0, NLAT, band_rows), desc="DEM band", unit="band"):
            i1 = min(i0 + band_rows, NLAT)
            nb = i1 - i0
            a, b = i0 * f, i1 * f
            zz = read_rows(a - 1, b + 1)
            top_pad = 1 if a > 0 else 0
            # north-up latitude of each row in zz
            rows = np.arange(a - top_pad, a - top_pad + zz.shape[0])
            plat = 90.0 - (rows + 0.5) * res
            dx = (np.radians(res) * R * np.cos(np.radians(plat)))[:, None]
            dzdx = (np.roll(zz, -1, axis=1) - np.roll(zz, 1, axis=1)) / (2 * dx)
            dzdy = np.gradient(zz, axis=0) / dlat
            slope = np.degrees(np.arctan(np.hypot(dzdx, dzdy)))
            del dzdx, dzdy
            sl = slope[top_pad:top_pad + nb * f]
            el = zz[top_pad:top_pad + nb * f]
            # DEM north-up row r lies in CMG row r // 3 (3 x 3 DEM pixels per 0.05 deg cell)
            cm_rows = np.arange(a, b) // 3
            wm = np.repeat(water_px[cm_rows], 3, axis=1)
            el = np.where(wm, np.nan, el)
            sl = np.where(wm | ~np.isfinite(el), np.nan, sl)
            del slope, zz, wm
            # (nb*f, NLON*f) -> (nb, NLON, f*f): one row of f*f pixels per 0.25 deg cell
            eb = el.reshape(nb, f, NLON, f).transpose(0, 2, 1, 3).reshape(nb, NLON, f * f)
            sb = sl.reshape(nb, f, NLON, f).transpose(0, 2, 1, 3).reshape(nb, NLON, f * f)
            n = np.isfinite(sb).sum(2)
            ok = n >= min_px
            if not ok.any():
                continue
            ii, jj = np.nonzero(ok)
            e_ok, s_ok, n_ok = eb[ok], sb[ok], n[ok]
            with np.errstate(all="ignore"), warnings.catch_warnings():
                warnings.simplefilter("ignore", RuntimeWarning)
                out["relief_std_m"][i0 + ii, jj] = np.nanstd(e_ok, axis=1)
                out["elev_mean_m"][i0 + ii, jj] = np.nanmean(e_ok, axis=1)
                out["slope_mean_deg"][i0 + ii, jj] = np.nanmean(s_ok, axis=1)
                out["slope_p90_deg"][i0 + ii, jj] = np.nanpercentile(s_ok, 90, axis=1)
                out["trafficable_frac"][i0 + ii, jj] = (np.nan_to_num(s_ok, nan=999) < slope_flat_deg).sum(1) / n_ok
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


def glim_fractions_full(gdb_dir: Path, sub: int = 10, chunk: int = 20000) -> tuple[dict, dict]:
    """Rasterise full-resolution GLiM polygons at 0.25/sub deg and compute class fractions (%) per cell.

    Memory-safe: polygons are streamed from the FileGDB in chunks of `chunk` features (pyogrio
    skip_features/max_features), reprojected per chunk and burnt into one uint8 class raster
    (0.025 deg, ~104 MB) in file order. Later polygons overwrite earlier ones exactly as in a single
    rasterize call over all features. Fractions are then counted per 0.25 deg cell in latitude bands.
    """
    import warnings

    import geopandas as gpd
    import pyogrio
    from rasterio import features
    from rasterio.transform import from_origin

    from .common import mem_rss_mb

    layers = pyogrio.list_layers(str(gdb_dir))
    poly_layers = [l[0] for l in layers if l[1] and "Polygon" in str(l[1])]
    if not poly_layers:
        raise ValueError(f"no polygon layer in {gdb_dir}: {layers}")
    layer = poly_layers[0]
    info = pyogrio.read_info(str(gdb_dir), layer=layer)
    fields = list(info["fields"])
    nfeat = int(info["features"])
    # read a sample to find the class column without loading everything
    sample = gpd.read_file(str(gdb_dir), layer=layer, max_features=500, engine="pyogrio")
    col = _find_class_column(sample)
    del sample
    log(f"GLiM: layer={layer!r}, features={nfeat}, class column={col!r}, streaming in chunks of {chunk}")
    code_id = {c: k + 1 for k, c in enumerate(GLIM_CODES)}
    res = 0.25 / sub
    H, W = int(round(180 / res)), int(round(360 / res))
    transform = from_origin(-180, 90, res, res)
    ras = np.zeros((H, W), np.uint8)
    burnt = 0
    for k in range(0, nfeat, chunk):
        with warnings.catch_warnings():
            warnings.simplefilter("ignore", RuntimeWarning)  # GDAL organizePolygons "may be slow" notice
            gdf = pyogrio.read_dataframe(str(gdb_dir), layer=layer, columns=[col],
                                         skip_features=k, max_features=chunk)
        if gdf.crs is not None and not gdf.crs.equals("EPSG:4326"):
            gdf = gdf.to_crs("EPSG:4326")
        vals = gdf[col].astype(str).str.strip().str.lower().map(code_id).fillna(0).astype(np.uint8)
        shapes = [(g, int(v)) for g, v in zip(gdf.geometry.values, vals.values) if g is not None and v > 0]
        if shapes:
            features.rasterize(shapes, out=ras, transform=transform)
            burnt += len(shapes)
        del gdf, vals, shapes
        if (k // chunk) % 10 == 0:
            log(f"  GLiM: {min(k + chunk, nfeat)}/{nfeat} features, rss {mem_rss_mb():.0f} MB")

    land_ids = np.array([code_id[c] for c in GLIM_CODES if c not in GLIM_NOT_LAND], np.uint8)
    n_land = np.zeros((NLAT, NLON), np.int32)
    hits = {c: np.zeros((NLAT, NLON), np.int32) for c in ("vb", "pb")}
    band = 60 * sub  # 60 output rows per band
    for s in range(0, H, band):
        r = ras[s:s + band]
        nb = r.shape[0] // sub
        o = slice(s // sub, s // sub + nb)
        n_land[o] = np.isin(r, land_ids).reshape(nb, sub, NLON, sub).sum(axis=(1, 3))
        for c in hits:
            hits[c][o] = (r == code_id[c]).reshape(nb, sub, NLON, sub).sum(axis=(1, 3))
    del ras
    out = {}
    for c in ("vb", "pb"):
        with np.errstate(invalid="ignore", divide="ignore"):
            out[c] = np.where(n_land > 0, 100.0 * hits[c] / n_land, np.nan).astype(np.float32)
    meta = {"mode": "full-resolution polygons (streamed in chunks)", "layer": layer, "class_column": col,
            "fields": fields, "raster_res_deg": res, "features": nfeat, "features_burnt": burnt,
            "chunk_features": chunk}
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
