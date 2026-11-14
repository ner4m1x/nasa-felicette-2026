"""Exports for the web app (scripts/out/ -> --publish -> public/data/)."""
from __future__ import annotations

import gzip
import hashlib
import shutil

import numpy as np

from .common import (CONFIG, LATS, LONS, NLAT, NLON, OUT, PIPELINE_VERSION, PUBLIC, RAW, RES, ROOT, TARGET_IDS,
                     block_reduce, config_git_state, latlon_to_idx, load_json, log, now_iso, save_json)

MERC_LAT = 85.0511
PNG_WIDTH = 2048
PNG_CUTOFF = 0.2
CMAP = "viridis"
GRID_RES = 0.5
LIMITS_MB = {"png": 2.0, "grid": 8.0}


# ------------------------------------------------------------------ PNG overlays
def png_overlay(total: np.ndarray, path):
    from matplotlib import colormaps
    from PIL import Image
    from pyproj import Transformer
    from rasterio.transform import from_bounds, from_origin
    from rasterio.warp import Resampling, reproject

    tr = Transformer.from_crs("EPSG:4326", "EPSG:3857", always_xy=True)
    xmax, _ = tr.transform(180.0, 0.0)
    _, ymax = tr.transform(0.0, MERC_LAT)
    W = PNG_WIDTH
    H = int(round(W * ymax / xmax))
    dst = np.full((H, W), np.nan, np.float32)
    reproject(source=total.astype(np.float32), destination=dst,
              src_transform=from_origin(-180.0, 90.0, RES, RES), src_crs="EPSG:4326",
              dst_transform=from_bounds(-xmax, -ymax, xmax, ymax, W, H), dst_crs="EPSG:3857",
              resampling=Resampling.nearest, src_nodata=np.nan, dst_nodata=np.nan)
    idx = np.where(np.isfinite(dst) & (dst >= PNG_CUTOFF), 1 + np.round(np.clip(dst, 0, 1) * 254), 0).astype(np.uint8)
    cm = colormaps[CMAP]
    pal = [0, 0, 0] + [int(round(c * 255)) for v in np.linspace(0, 1, 255) for c in cm(v)[:3]]
    img = Image.fromarray(idx, mode="P")
    img.putpalette(pal)
    img.save(path, optimize=True, transparency=0)
    return {"width": W, "height": H, "bounds_lonlat": [[-MERC_LAT, -180.0], [MERC_LAT, 180.0]],
            "bounds_3857": [-xmax, -ymax, xmax, ymax], "crs": "EPSG:3857", "colormap": CMAP, "vmin": 0.0, "vmax": 1.0,
            "transparent_below": PNG_CUTOFF, "resampling": "nearest"}


# ------------------------------------------------------------------ 0.5 deg click grid
def _quantize(a: np.ndarray, lo: float, hi: float):
    scale = (hi - lo) / 254.0 if hi > lo else 1.0
    q = np.where(np.isfinite(a), np.clip(np.round((a - lo) / scale), 0, 254), 255).astype(np.uint8)
    return q, float(scale), float(lo)


def build_grid(F, land, S, cfg, encoding: str):
    f = int(round(GRID_RES / RES))
    bands, arrays = [], []

    def agg(a):
        return block_reduce(np.where(land, a, np.nan), f, "mean")

    feat_names = [k for k in F if k not in ("land_mask",)]
    for k in feat_names:
        a = agg(F[k])
        v = a[np.isfinite(a)]
        lo, hi = (float(v.min()), float(v.max())) if v.size else (0.0, 1.0)
        q, sc, off = _quantize(a, lo, hi)
        bands.append({"name": k, "kind": "feature", "units": F.attrs_units.get(k), "scale": sc, "offset": off})
        arrays.append(q)
    floor = float(cfg["scoring"]["floor"])
    for t in TARGET_IDS:
        dims = [d.get("id", d["feature"]) for d in cfg["targets"][t]["dims"]]
        q, sc, off = _quantize(agg(S[f"{t}__total"].values), 0.0, 1.0)
        bands.append({"name": f"{t}.total", "kind": "score", "target": t, "units": "1", "scale": sc, "offset": off})
        arrays.append(q)
        dm = []
        for d in dims:
            a = agg(S[f"{t}__dim__{d}"].values)
            dm.append(a)
            q, sc, off = _quantize(a, 0.0, 1.0)
            bands.append({"name": f"{t}.dim.{d}", "kind": "dim", "target": t, "dim": d, "units": "1", "scale": sc, "offset": off})
            arrays.append(q)
        st = np.stack(dm)
        ok = np.all(np.isfinite(st), axis=0)
        lim = np.where(ok, np.argmin(np.where(np.isfinite(st), np.maximum(st, floor), np.inf), axis=0), 255).astype(np.uint8)
        bands.append({"name": f"{t}.limiting", "kind": "limiting", "target": t, "categories": dims, "scale": 1.0, "offset": 0.0})
        arrays.append(lim)
    lm = (block_reduce(land.astype(np.float32), f, "max") > 0).astype(np.uint8)
    bands.append({"name": "land", "kind": "mask", "scale": 1.0, "offset": 0.0})
    arrays.append(lm)
    raw = np.stack(arrays).astype(np.uint8).tobytes(order="C")
    data = gzip.compress(raw, compresslevel=9, mtime=0) if encoding == "gzip" else raw
    nlat, nlon = NLAT // f, NLON // f
    meta = {
        "generated": now_iso(), "config_version": cfg["version"],
        "file": grid_filename(encoding), "encoding": encoding,
        "decompress": "gzip (e.g. new DecompressionStream('gzip') in the browser) before reading bytes" if encoding == "gzip" else None,
        "layout": "band-sequential uint8; index = band * nlat * nlon + row * nlon + col",
        "nlat": nlat, "nlon": nlon, "step_deg": GRID_RES,
        "origin": {"lat_north": 90.0, "lon_west": -180.0},
        "row_col": "row = floor((90 - lat) / step), col = floor((lon + 180) / step); row 0 = north",
        "nodata": 255, "decode": "value = offset + scale * q (q != 255); limiting: categories[q]",
        "aggregation": "mean of the 0.25 deg land cells inside each 0.5 deg cell (ocean excluded); "
                       "limiting = argmin of the aggregated dimension scores (floored)",
        "bands": [{"index": i, **b} for i, b in enumerate(bands)],
        "bytes_uncompressed": len(raw),
    }
    return data, meta


def grid_filename(encoding: str) -> str:
    return "scan_grid.bin.gz" if encoding == "gzip" else "scan_grid.bin"


# ------------------------------------------------------------------ deck
def _fmt(v: float, decimals: int) -> str:
    return f"{v:.{decimals}f}" if np.isfinite(v) else "n/a"


def _feature_line(tmpl: str, lang: str, feat: str, value: float, score: float, T: dict) -> str:
    fm = T["features"][feat]
    v = value * fm.get("display_scale", 1)
    return tmpl.format(label=fm[lang], value=_fmt(v, fm["decimals"]), unit=fm["unit"][lang], score=f"{score:.2f}")


def breakdown(target: str, cfg: dict, T: dict, dims: dict, values: dict, limiting: str) -> dict:
    dl = cfg["targets"][target]["dims"]
    ids = [d.get("id", d["feature"]) for d in dl]
    feat_of = {d.get("id", d["feature"]): d["feature"] for d in dl}
    order = sorted(ids, key=lambda k: (-dims[k], ids.index(k)))
    strong = [k for k in order[:3] if dims[k] >= T["rules"]["match_min_score"]]
    if len(strong) < 2:
        strong = order[:2]
    weak = [limiting] + [k for k in order[::-1] if k != limiting and dims[k] < T["rules"]["weak_below_score"]][:1]
    out = {"matches": {}, "breaksDown": {}, "utility": {}}
    for lang in ("en", "pl"):
        tm = T["templates"]
        out["matches"][lang] = [_feature_line(tm["match"][lang], lang, feat_of[k], values[feat_of[k]], dims[k], T) for k in strong]
        bd = [_feature_line(tm["limiting" if k == limiting else "weak"][lang], lang, feat_of[k], values[feat_of[k]], dims[k], T)
              for k in weak]
        bd += [tm["not_captured_prefix"][lang] + x for x in T["not_captured"][target][lang]]
        out["breaksDown"][lang] = bd
        out["utility"][lang] = list(T["utility"][target][lang])
    return out


def source_ids(targets: list[str], cfg: dict, man: dict) -> list[str]:
    feat_src = load_json(CONFIG / "deck_text.json")["feature_sources"]
    keys = {"MCD12C1"}
    for target in targets:
        for d in cfg["targets"][target]["dims"]:
            keys.update(feat_src[d["feature"]])
    ids = []
    for k in sorted(keys):
        e = man["datasets"].get(k)
        if e:
            ids.append(e["source_id"])
    return ids


def build_deck(F, S, cfg, man):
    from .validate import Percentiles, site_analog

    T = load_json(CONFIG / "deck_text.json")
    m = cfg["method"]
    pct = Percentiles({t: S[f"{t}__total"].values for t in TARGET_IDS})
    floor = float(cfg["scoring"]["floor"])
    cards = []

    def mission_at(rows, cols):
        def mv(k, scale=1.0):
            v = np.nanmean(F[k][rows, cols]) if np.isfinite(F[k][rows, cols]).any() else np.nan
            return float(v * scale) if np.isfinite(v) else None
        return {"slopeMeanDeg": mv("slope_mean_deg"), "trafficableFrac": mv("trafficable_frac"),
                "reliefStdM": mv("relief_std_m"), "iceProxy": mv("ice_proxy"), "basaltFrac": mv("basalt_frac", 0.01)}

    def region_analog(rows, cols):
        res = {}
        for t in TARGET_IDS:
            tot = S[f"{t}__total"].values[rows, cols]
            if not np.isfinite(tot).any():
                continue
            dims = [d.get("id", d["feature"]) for d in cfg["targets"][t]["dims"]]
            dm = {d: float(np.nanmean(S[f"{t}__dim__{d}"].values[rows, cols])) for d in dims}
            lim = min(dims, key=lambda d: (max(dm[d], floor), dims.index(d)))
            mt = float(np.nanmean(tot))
            res[t] = {"total": mt, "dims": dm, "limiting": lim, "percentile": pct(t, mt)}
        return res

    # candidate regions
    for t in TARGET_IDS:
        gj = load_json(OUT / f"candidates_{t}.geojson")
        for ft in gj["features"]:
            p = ft["properties"]
            rows, cols = _cells_of(ft["geometry"])
            an = region_analog(rows, cols)
            values = {k: float(np.nanmean(F[k][rows, cols])) for k in F if k != "land_mask"}
            cards.append({
                "id": p["id"], "kind": "benchmark" if p["known"] else "discovery", "name": p["name"],
                "country": p["country"], "lat": p["centroid"]["lat"], "lon": p["centroid"]["lon"], "scale": "regional",
                "regionAreaKm2": p["area_km2"], "analog": an, "mission": mission_at(rows, cols),
                "stability": p["stability"], "known": bool(p["known"]),
                "breakdown": {tt: breakdown(tt, cfg, T, e["dims"], values, e["limiting"]) for tt, e in an.items()},
                "sourceIds": source_ids(list(an), cfg, man),
            })
    # benchmark and trap sites
    from .candidates import Namer

    namer = Namer()
    for s in load_json(CONFIG / "known_sites.json")["sites"]:
        if s["category"] not in ("benchmark", "trap"):
            continue
        a = site_analog(S, cfg, pct, s["lat"], s["lon"], m["site_radius_km"])
        an = {t: {k: v[k] for k in ("total", "dims", "limiting", "percentile")} for t, v in a.items() if v}
        primary = next((t for t in s["relevant_targets"] if a.get(t)), None)
        if primary:
            c = a[primary]["cell"]
            r, cidx = latlon_to_idx(c["lat"], c["lon"])
        else:
            r, cidx = latlon_to_idx(s["lat"], s["lon"])
        rows, cols = np.array([r]), np.array([cidx])
        _, country, _ = namer.name(s["lat"], s["lon"], [], [])
        bd = {}
        for tt, e in an.items():
            # feature values at the cell that produced this target's site score
            ri, ci = latlon_to_idx(a[tt]["cell"]["lat"], a[tt]["cell"]["lon"])
            values = {k: float(F[k][ri, ci]) for k in F if k != "land_mask"}
            bd[tt] = breakdown(tt, cfg, T, e["dims"], values, e["limiting"])
        cards.append({
            "id": f"site-{s['id']}", "kind": s["category"], "name": s["name"], "country": country,
            "lat": s["lat"], "lon": s["lon"], "scale": "regional", "regionAreaKm2": None,
            "analog": an or None, "mission": mission_at(rows, cols), "stability": None,
            "known": s["category"] == "benchmark", "breakdown": bd,
            "sourceIds": source_ids(list(an), cfg, man),
        })
    return {"generatedAt": now_iso(), "configId": f"targets-v{cfg['version']}@{(config_git_state()['commit'] or 'uncommitted')[:12]}",
            "cards": cards}


def _cells_of(geom) -> tuple[np.ndarray, np.ndarray]:
    """0.25 deg cells whose centres fall inside a candidate geometry (exact: geometry is a union of cells)."""
    import shapely.geometry as sg
    from shapely import contains_xy

    g = sg.shape(geom)
    minx, miny, maxx, maxy = g.bounds
    r = np.where((LATS > miny) & (LATS < maxy))[0]
    c = np.where((LONS > minx) & (LONS < maxx))[0]
    rr, cc = np.meshgrid(r, c, indexing="ij")
    inside = contains_xy(g, LONS[cc], LATS[rr])
    return rr[inside], cc[inside]


def validate_deck(deck: dict):
    import jsonschema

    schema = load_json(CONFIG / "deck.schema.json")
    jsonschema.validate(deck, schema)
    for c in deck["cards"]:
        for t, e in (c["analog"] or {}).items():
            if t not in TARGET_IDS:
                raise ValueError(f"{c['id']}: unknown target {t}")
            if e["limiting"] not in e["dims"]:
                raise ValueError(f"{c['id']}: limiting not among dims")
    ids = [c["id"] for c in deck["cards"]]
    if len(ids) != len(set(ids)):
        raise ValueError("duplicate card ids")


# ------------------------------------------------------------------ curated values
def curated_values(F, S, cfg):
    from .validate import Percentiles, site_analog

    cs = load_json(CONFIG / "curated_sites.json")
    ts = (ROOT / cs["mirror_of"]).read_text(encoding="utf-8")
    pct = Percentiles({t: S[f"{t}__total"].values for t in TARGET_IDS})
    out = {"generated": now_iso(), "note": cs["note"], "radius_km": cfg["method"]["site_radius_km"], "cards": {}}
    for s in cs["sites"]:
        if str(s["lat"]) not in ts or str(s["lon"]) not in ts or s["card_id"] not in ts:
            log(f"WARNING curated_sites.json entry {s['card_id']} no longer matches {cs['mirror_of']}")
        a = site_analog(S, cfg, pct, s["lat"], s["lon"], cfg["method"]["site_radius_km"])
        i, j = latlon_to_idx(s["lat"], s["lon"])
        land = bool(F["land_mask"][i, j])
        out["cards"][s["card_id"]] = {
            "lat": s["lat"], "lon": s["lon"], "containing_cell_is_land": land,
            "analog": {t: v for t, v in a.items() if v},
            "features_containing_cell": {k: (float(F[k][i, j]) if np.isfinite(F[k][i, j]) else None)
                                         for k in F if k != "land_mask"} if land else None,
        }
    return out


# ------------------------------------------------------------------ manifest
def build_manifest(years) -> dict:
    dm = load_json(RAW / "download_manifest.json")
    sanity = load_json(OUT / "sanity_checks.json")
    rm = sanity.get("read_metadata", {})
    glim_mode = (rm.get("GLiM") or {}).get("mode", "")
    ds = {}
    for k, v in dm["earthdata"].items():
        ds[k] = {"source_id": f"{v['short_name']}.{v['version']}", "short_name": v["short_name"], "version": v["version"],
                 "title": v["title"], "doi": v["doi"], "concept_id": v["concept_id"], "provider": v["provider"],
                 "temporal_range": v["temporal_range"], "granule_count": v["granule_count"],
                 "download_date": v.get("download_date"), "role": v["role"], "read_metadata": rm.get(k)}
    for k, v in dm["http"].items():
        if k == "GLiM_0p5" and "0.5 deg" not in glim_mode:
            continue
        if k == "GLiM" and "full-resolution" not in glim_mode:
            continue
        ds[k] = {"source_id": k, "short_name": k, "version": v.get("version"), "title": v.get("paper_title") or k,
                 "doi": v.get("doi"), "dataset_doi": v.get("dataset_doi"), "concept_id": None, "url": v["url"],
                 "landing_url": v.get("landing_url"), "license": v.get("license"), "license_note": v.get("license_note"), "temporal_range": None,
                 "granule_count": 1, "download_date": v.get("download_date"), "role": v["role"],
                 "read_metadata": rm.get("GLiM") if k.startswith("GLiM") else None}
    return {"pipeline_version": PIPELINE_VERSION, "run_timestamp": now_iso(), "years": years,
            "config": config_git_state(), "datasets": ds, "sanity_checks": sanity["checks"]}


# ------------------------------------------------------------------ main
def _sha(p):
    return hashlib.sha256(p.read_bytes()).hexdigest()


def run(publish: bool = False, grid_encoding: str = "gzip"):
    import xarray as xr

    from .scoring import load_config, load_scores
    from .features import FEATURES_NC

    cfg = load_config()
    S = load_scores()
    fds = xr.load_dataset(FEATURES_NC)
    F = {k: fds[k].values.astype(np.float64) for k in fds.data_vars}

    class _F(dict):
        pass

    Fd = _F(F)
    Fd.attrs_units = {k: fds[k].attrs.get("units") for k in fds.data_vars}
    land = F["land_mask"].astype(bool)
    years = [int(y) for y in str(fds.attrs["years"]).split(",")]
    files = []

    overlays = {}
    for t in TARGET_IDS:
        p = OUT / f"scan_{t}.png"
        overlays[t] = png_overlay(S[f"{t}__total"].values, p)
        files.append(p)
    data, meta = build_grid(_strip(Fd), land, S, cfg, grid_encoding)
    meta["overlays"] = {t: {"file": f"scan_{t}.png", **o} for t, o in overlays.items()}
    for old in ("scan_grid.bin", "scan_grid.bin.gz"):
        (OUT / old).unlink(missing_ok=True)
    gpath = OUT / grid_filename(grid_encoding)
    gpath.write_bytes(data)
    save_json(OUT / "scan_grid_meta.json", meta)
    files += [gpath, OUT / "scan_grid_meta.json"]
    files += [OUT / f"candidates_{t}.geojson" for t in TARGET_IDS]
    files += [OUT / "validation_report.json", OUT / "sensitivity_report.json"]
    shutil.copyfile(CONFIG / "targets.json", OUT / "scoring_config.json")
    files.append(OUT / "scoring_config.json")

    man = build_manifest(years)
    deck = build_deck(F, S, cfg, man)
    validate_deck(deck)
    save_json(OUT / "deck.json", deck)
    files.append(OUT / "deck.json")
    save_json(OUT / "curated_grid_values.json", curated_values(F, S, cfg))
    files.append(OUT / "curated_grid_values.json")

    missing = [p.name for p in files if not p.exists()]
    if missing:
        raise SystemExit(f"missing outputs: {missing}")
    man["outputs"] = {p.name: {"bytes": p.stat().st_size, "sha256": _sha(p)} for p in files}
    req = ("short_name", "version", "doi", "temporal_range", "granule_count", "download_date")
    gaps = [f"{k}.{f}" for k, v in man["datasets"].items() for f in req
            if v.get(f) is None and not (f == "temporal_range" and v.get("concept_id") is None)]
    man["missing_fields"] = gaps
    save_json(OUT / "manifest.json", man)
    files.append(OUT / "manifest.json")
    if gaps:
        log(f"WARNING manifest has missing fields: {gaps}")

    probs = []
    for p in files:
        mb = p.stat().st_size / 1e6
        if p.suffix == ".png" and mb > LIMITS_MB["png"]:
            probs.append(f"{p.name} {mb:.2f} MB > {LIMITS_MB['png']} MB")
        if p.name.startswith("scan_grid.bin") and mb > LIMITS_MB["grid"]:
            probs.append(f"{p.name} {mb:.2f} MB > {LIMITS_MB['grid']} MB")
        log(f"  {p.name:36s} {mb:8.3f} MB")
    if probs:
        raise SystemExit("size limits exceeded: " + "; ".join(probs))
    if publish:
        PUBLIC.mkdir(parents=True, exist_ok=True)
        for p in files:
            shutil.copyfile(p, PUBLIC / p.name)
        log(f"published {len(files)} files to {PUBLIC}")
    return files


def _strip(Fd):
    out = type(Fd)({k: v for k, v in Fd.items() if k != "land_mask"})
    out.attrs_units = Fd.attrs_units
    return out
