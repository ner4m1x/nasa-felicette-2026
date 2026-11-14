"""Candidate regions: top fraction of land cells -> 8-connected regions -> candidates_{target}.geojson."""
from __future__ import annotations

import zipfile

import numpy as np

from .common import (CONFIG, LATS, LONS, NLON, OUT, RAW, RES, TARGET_IDS, cell_area_km2, haversine_km, load_json,
                     log, now_iso, save_json)

AREA = cell_area_km2()


# ------------------------------------------------------------------ regions
def label_wrap(mask: np.ndarray) -> tuple[np.ndarray, int]:
    """8-connected component labels with the antimeridian treated as connected."""
    from scipy import ndimage

    lab, n = ndimage.label(mask, structure=np.ones((3, 3), int))
    parent = list(range(n + 1))

    def find(a):
        while parent[a] != a:
            parent[a] = parent[parent[a]]
            a = parent[a]
        return a

    H = mask.shape[0]
    for i in range(H):
        a = lab[i, 0]
        if not a:
            continue
        for di in (-1, 0, 1):
            k = i + di
            if 0 <= k < H and lab[k, NLON - 1]:
                ra, rb = find(a), find(lab[k, NLON - 1])
                if ra != rb:
                    parent[max(ra, rb)] = min(ra, rb)
    roots = np.array([find(a) for a in range(n + 1)])
    uniq = {r: k for k, r in enumerate(sorted(set(roots[1:])), start=1)}
    remap = np.array([0] + [uniq[r] for r in roots[1:]])
    return remap[lab], len(uniq)


def top_threshold(total: np.ndarray, top_fraction: float) -> float:
    v = total[np.isfinite(total)]
    return float(np.quantile(v, 1.0 - top_fraction))


def find_regions(total: np.ndarray, top_fraction: float, min_cells: int) -> list[np.ndarray]:
    """Return a list of (rows, cols) index arrays, one per region with >= min_cells cells.

    Deterministic order: by region key (smallest flat index of its cells)."""
    thr = top_threshold(total, top_fraction)
    mask = np.isfinite(total) & (total >= thr)
    lab, n = label_wrap(mask)
    regions = []
    flat = lab.ravel()
    order = np.argsort(flat, kind="stable")
    bounds = np.searchsorted(flat[order], np.arange(1, n + 2))
    for k in range(n):
        idx = order[bounds[k]:bounds[k + 1]]
        if idx.size >= min_cells:
            regions.append(np.sort(idx))
    regions.sort(key=lambda a: int(a[0]))
    return regions


def region_key(idx: np.ndarray) -> int:
    return int(idx.min())


def centroid(rows, cols, w):
    lat = float(np.average(LATS[rows], weights=w))
    th = np.radians(LONS[cols])
    lon = float(np.degrees(np.arctan2(np.average(np.sin(th), weights=w), np.average(np.cos(th), weights=w))))
    return lat, lon


# ------------------------------------------------------------------ naming
class Namer:
    def __init__(self):
        import geopandas as gpd

        def load(key, fname):
            zp = RAW / key / fname
            ex = RAW / key / "extracted"
            if not ex.exists():
                with zipfile.ZipFile(zp) as z:
                    z.extractall(ex)
            return gpd.read_file(next(ex.rglob("*.shp"))).to_crs("EPSG:4326")

        self.reg = load("NE_geography_regions", "ne_10m_geography_regions_polys.zip")
        self.adm = load("NE_admin0", "ne_10m_admin_0_countries.zip")
        cols = {c.lower(): c for c in self.reg.columns}
        self.reg_name = cols.get("name_en") or cols.get("name")
        self.reg_class = cols.get("featurecla")
        acols = {c.lower(): c for c in self.adm.columns}
        self.adm_name = acols.get("name_en") or acols.get("name") or acols.get("admin")
        if self.reg_class:
            self.reg = self.reg[self.reg[self.reg_class].astype(str).str.lower() != "continent"]
        self.reg = self.reg.assign(_area=self.reg.geometry.to_crs("EPSG:6933").area)
        self.reg_sidx = self.reg.sindex
        self.adm_sidx = self.adm.sindex

    def _hits(self, gdf, sidx, pts):
        import geopandas as gpd

        g = gpd.GeoDataFrame(geometry=gpd.points_from_xy(*zip(*pts)), crs="EPSG:4326")
        return gpd.sjoin(g, gdf, predicate="within", how="inner")

    def name(self, clat, clon, rows, cols):
        pts = [(clon, clat)] + [(float(LONS[c]), float(LATS[r])) for r, c in zip(rows, cols)]
        hits = self._hits(self.reg, self.reg_sidx, pts)
        region = None
        if len(hits):
            at_c = hits[hits.index == 0]
            if len(at_c):
                region = at_c.sort_values("_area").iloc[0][self.reg_name]
            else:
                smallest = hits.sort_values("_area").groupby(level=0).head(1)
                region = smallest[self.reg_name].value_counts().index[0]
        ah = self._hits(self.adm, self.adm_sidx, pts)
        country = None
        if len(ah):
            at_c = ah[ah.index == 0]
            country = at_c.iloc[0][self.adm_name] if len(at_c) else ah[self.adm_name].value_counts().index[0]
        region = str(region).strip().title() if region and str(region).isupper() else (str(region).strip() if region else None)
        name = region or f"Unnamed region near ({clat:.2f}, {clon:.2f})"
        return name, (str(country) if country else None), bool(region)


# ------------------------------------------------------------------ main
def run():
    import shapely.geometry as sg
    from shapely.ops import unary_union

    from .features import FEATURES_NC  # noqa: F401
    from .scoring import load_config, load_features, load_scores

    cfg = load_config()
    m = cfg["method"]
    S = load_scores()
    F, land, _ = load_features()
    sites = load_json(CONFIG / "known_sites.json")["sites"]
    bench = [s for s in sites if s["category"] == "benchmark"]
    sens_path = OUT / "sensitivity_report.json"
    sens = load_json(sens_path) if sens_path.exists() else None
    if sens is None:
        log("WARNING: sensitivity_report.json missing; stability will be null (run sensitivity first)")
    namer = Namer()
    land_frac = np.clip(1.0 - np.nan_to_num(F["water_frac"], nan=0.0) / 100.0, 0, 1)
    floor = float(cfg["scoring"]["floor"])
    summary = {}
    for t in TARGET_IDS:
        total = S[f"{t}__total"].values
        dims = [d.get("id", d["feature"]) for d in cfg["targets"][t]["dims"]]
        regions = find_regions(total, m["top_fraction"], m["min_region_cells"])
        stab = {}
        if sens:
            stab = {int(k): v for k, v in sens["targets"][t]["region_stability"].items()}
        recs = []
        for idx in regions:
            rows, cols = np.unravel_index(idx, total.shape)
            w = AREA[rows] * land_frac[rows, cols]
            clat, clon = centroid(rows, cols, np.maximum(w, 1e-9))
            dmeans = {d: float(np.nanmean(S[f"{t}__dim__{d}"].values[rows, cols])) for d in dims}
            lim = min(dims, key=lambda d: (max(dmeans[d], floor), dims.index(d)))
            dist = [float(np.min(haversine_km(s["lat"], s["lon"], LATS[rows], LONS[cols]))) for s in bench]
            nb = int(np.argmin(dist)) if dist else None
            recs.append({"key": region_key(idx), "rows": rows, "cols": cols,
                         "mean_score": float(np.nanmean(total[rows, cols])),
                         "max_score": float(np.nanmax(total[rows, cols])),
                         "area_km2": float(w.sum()), "n_cells": int(idx.size),
                         "centroid": {"lat": clat, "lon": clon}, "dims": dmeans, "limiting_dimension": lim,
                         "stability": stab.get(region_key(idx)),
                         "in_antarctica": bool(clat < -60.0),
                         "known": bool(dist and min(dist) <= m["known_radius_km"]),
                         "nearest_benchmark": bench[nb]["id"] if nb is not None else None,
                         "nearest_benchmark_km": dist[nb] if nb is not None else None})
        recs.sort(key=lambda r: (-r["mean_score"], -r["area_km2"]))
        top = recs[: m["export_top_regions"]]
        feats = []
        for rank, r in enumerate(top, start=1):
            name, country, named = namer.name(r["centroid"]["lat"], r["centroid"]["lon"], r["rows"], r["cols"])
            rows, cols = r["rows"], r["cols"]
            mission = {k: float(np.nanmean(F[k][rows, cols])) for k in
                       ("slope_mean_deg", "trafficable_frac", "relief_std_m", "ice_proxy", "basalt_frac")}
            boxes = [sg.box(LONS[c] - RES / 2, LATS[rr] - RES / 2, LONS[c] + RES / 2, LATS[rr] + RES / 2)
                     for rr, c in zip(rows, cols)]
            geom = sg.mapping(unary_union(boxes))
            props = {k: v for k, v in r.items() if k not in ("rows", "cols")}
            props.update({"id": f"scan-{t}-{rank:02d}", "rank": rank, "target": t, "name": name, "country": country,
                          "named_by": "Natural Earth 10m geography regions + admin-0" if named else "fallback",
                          "mission": mission})
            feats.append({"type": "Feature", "geometry": geom, "properties": props})
        gj = {"type": "FeatureCollection",
              "metadata": {"generated": now_iso(), "target": t, "config_version": cfg["version"],
                           "top_fraction": m["top_fraction"], "min_region_cells": m["min_region_cells"],
                           "n_regions_total": len(recs), "threshold_score": top_threshold(total, m["top_fraction"])},
              "features": feats}
        save_json(OUT / f"candidates_{t}.geojson", _round_geojson(gj), indent=None)
        summary[t] = {"n_regions": len(recs), "exported": len(feats)}
        log(f"{t}: {len(recs)} regions >= {m['min_region_cells']} cells; exported top {len(feats)}")
    return summary


def _round_geojson(gj):
    def rnd(o):
        if isinstance(o, float):
            return round(o, 4)
        if isinstance(o, (list, tuple)):
            return [rnd(x) for x in o]
        if isinstance(o, dict):
            return {k: rnd(v) for k, v in o.items()}
        return o
    return rnd(gj)
