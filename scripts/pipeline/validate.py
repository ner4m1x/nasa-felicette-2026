"""Validation against known analog sites -> validation_report.json + docs/VALIDATION_REPORT.md."""
from __future__ import annotations

import numpy as np

from .common import (CONFIG, DOCS, LATS, LONS, OUT, TARGET_IDS, config_git_state, haversine_km, latlon_to_idx,
                     load_json, log, now_iso, save_json)
from .scoring import load_config, load_scores

REPORT_JSON = OUT / "validation_report.json"
REPORT_MD = DOCS / "VALIDATION_REPORT.md"


def require_frozen_config() -> dict:
    st = config_git_state()
    if not st["commit"]:
        raise SystemExit("PRE-REGISTRATION GUARD: scripts/config/targets.json has never been committed. "
                         "Commit it ('freeze scoring config v1') before running validate.")
    if st["dirty"]:
        raise SystemExit("PRE-REGISTRATION GUARD: scripts/config/targets.json has uncommitted changes. "
                         "Bump the version, log the change in docs/METHOD_LOG.md and commit before validating.")
    return st


class Percentiles:
    """Percentile rank among scored land cells: 100 * (n_below + 0.5 * n_equal) / n."""

    def __init__(self, scores):
        self.sorted = {t: np.sort(v[np.isfinite(v)]) for t, v in scores.items()}

    def __call__(self, t: str, s: float) -> float:
        a = self.sorted[t]
        if not np.isfinite(s) or a.size == 0:
            return float("nan")
        lo = np.searchsorted(a, s, "left")
        hi = np.searchsorted(a, s, "right")
        return float(100.0 * (lo + 0.5 * (hi - lo)) / a.size)


def cells_within(lat: float, lon: float, radius_km: float):
    """(rows, cols) of 0.25 deg cell centres within radius_km of a point (always incl. the containing cell)."""
    dlat = radius_km / 111.0 + 0.5
    rows = np.where(np.abs(LATS - lat) <= dlat)[0]
    out_r, out_c = [], []
    for r in rows:
        d = haversine_km(lat, lon, LATS[r], LONS)
        cs = np.where(d <= radius_km)[0]
        out_r += [r] * len(cs)
        out_c += list(cs)
    i, j = latlon_to_idx(lat, lon)
    out_r.append(i)
    out_c.append(j)
    return np.array(out_r), np.array(out_c)


def cell_flag(S, name: str, r: int, c: int) -> bool:
    """Provenance flag (e.g. ndvi_imputed) of one cell; False if the scores file has no such flag."""
    k = f"flag__{name}"
    return bool(S[k].values[r, c]) if k in S.data_vars else False


def site_analog(S, cfg, pct: Percentiles, lat, lon, radius_km) -> dict:
    """Per target: max total score within the radius, its dims, limiting dimension and percentile.

    `ndvi_imputed` says whether the cell that produced the site score had its NDVI imputed under the
    missing-data policy of targets.json (v2)."""
    rr, cc = cells_within(lat, lon, radius_km)
    res = {}
    for t in TARGET_IDS:
        tot = S[f"{t}__total"].values[rr, cc]
        if not np.isfinite(tot).any():
            res[t] = None
            continue
        k = int(np.nanargmax(tot))
        r, c = int(rr[k]), int(cc[k])
        dims = [d.get("id", d["feature"]) for d in cfg["targets"][t]["dims"]]
        li = int(S[f"{t}__limiting"].values[r, c])
        res[t] = {
            "total": float(tot[k]),
            "dims": {d: float(S[f"{t}__dim__{d}"].values[r, c]) for d in dims},
            "limiting": dims[li] if li >= 0 else None,
            "percentile": pct(t, float(tot[k])),
            "cell": {"lat": float(LATS[r]), "lon": float(LONS[c]),
                     "dist_km": float(haversine_km(lat, lon, LATS[r], LONS[c]))},
            "n_cells_considered": int(np.isfinite(tot).sum()),
            "ndvi_imputed": cell_flag(S, "ndvi_imputed", r, c),
        }
    return res


def run():
    st = require_frozen_config()
    cfg = load_config()
    S = load_scores()
    if int(S.attrs.get("config_version", -1)) != int(cfg["version"]):
        raise SystemExit("scores were computed with a different config version; re-run score")
    radius = float(cfg["method"]["site_radius_km"])
    sites = load_json(CONFIG / "known_sites.json")["sites"]
    pct = Percentiles({t: S[f"{t}__total"].values for t in TARGET_IDS})
    rows = []
    for s in sites:
        a = site_analog(S, cfg, pct, s["lat"], s["lon"], radius)
        rows.append({**{k: s[k] for k in ("id", "name", "lat", "lon", "category", "relevant_targets")},
                     "ndvi_imputed": any(v["ndvi_imputed"] for v in a.values() if v), "analog": a})
    summary = {}
    for t in TARGET_IDS:
        def med(cat):
            v = [r["analog"][t]["percentile"] for r in rows
                 if r["category"] == cat and t in r["relevant_targets"] and r["analog"].get(t)]
            return {"n": len(v), "median_percentile": float(np.median(v)) if v else None}
        b, tr = med("benchmark"), med("trap")
        summary[t] = {"benchmarks": b, "traps": tr,
                      "pattern_holds": (b["median_percentile"] is not None and tr["median_percentile"] is not None
                                        and b["median_percentile"] > tr["median_percentile"])}
    rep = {"generated": now_iso(), "config_version": cfg["version"], "config_git": st,
           "method": {"site_radius_km": radius,
                      "percentile": "100 * (n_below + 0.5 * n_equal) / n over scored land cells of the 0.25 deg grid",
                      "site_score": "maximum total score among cells whose centre lies within the radius"},
           "n_land_scored": {t: int(pct.sorted[t].size) for t in TARGET_IDS},
           "missing_data_imputation": {
               "rules": [r["id"] for r in cfg["scoring"].get("missing_data_imputation", [])],
               "ndvi_imputed_land_cells": int(S["flag__ndvi_imputed"].values.sum()) if "flag__ndvi_imputed" in S.data_vars else 0,
               "ui_label": "NDVI imputed (no MODIS coverage)"},
           "sites": rows, "summary": summary}
    save_json(REPORT_JSON, rep)
    write_markdown(rep, cfg)
    log(f"wrote {REPORT_JSON} and {REPORT_MD}")
    for t, s in summary.items():
        log(f"  {t}: benchmarks median {s['benchmarks']['median_percentile']} (n={s['benchmarks']['n']}) vs "
            f"traps {s['traps']['median_percentile']} (n={s['traps']['n']}) -> pattern holds: {s['pattern_holds']}")
    return rep


def _f(v, nd=1):
    return "—" if v is None or (isinstance(v, float) and not np.isfinite(v)) else f"{v:.{nd}f}"


def write_markdown(rep: dict, cfg: dict):
    L = ["# Validation report", "",
         "> Generated by `python scripts/global_scan.py validate`. Do not edit by hand; re-run the pipeline.", "",
         f"- Generated: {rep['generated']}",
         f"- Scoring config: v{rep['config_version']}, commit `{rep['config_git']['commit']}` "
         f"(\"{rep['config_git']['subject']}\", {rep['config_git']['date']})",
         f"- Site score: {rep['method']['site_score']} ({rep['method']['site_radius_km']:.0f} km)",
         f"- Percentile: {rep['method']['percentile']}", "",
         "## Summary: median percentile, benchmarks vs traps", "",
         "| target | benchmarks (n) | traps (n) | benchmarks > traps |", "|---|---|---|---|"]
    for t, s in rep["summary"].items():
        L.append(f"| `{t}` | {_f(s['benchmarks']['median_percentile'])} ({s['benchmarks']['n']}) | "
                 f"{_f(s['traps']['median_percentile'])} ({s['traps']['n']}) | {'yes' if s['pattern_holds'] else '**no**'} |")
    mi = rep.get("missing_data_imputation") or {}
    L += ["", "Benchmarks count only for the targets listed in their `relevant_targets`.", ""]
    for ru in cfg["scoring"].get("missing_data_imputation", []):
        c = ru["condition"]
        n = mi.get("ndvi_imputed_land_cells", 0) if ru["flag"] == "ndvi_imputed" else "?"
        L += [f"Missing-data policy (targets.json v{rep['config_version']}, rule `{ru['id']}`): "
              f"{', '.join(ru['features'])} set to {ru['set_to']} where missing and `{c['feature']}` {c['op']} "
              f"{c['value']} ({n} land cells, flagged `{ru['flag']}`).", ""]
    L += [
          "## All sites × relevant targets", "",
          "| site | category | target | score | percentile | limiting dimension | cell used (lat, lon, km) | NDVI imputed |",
          "|---|---|---|---|---|---|---|---|"]
    for r in rep["sites"]:
        for t in r["relevant_targets"]:
            a = r["analog"].get(t)
            if not a:
                L.append(f"| {r['name']} | {r['category']} | `{t}` | — | — | not scorable | — | — |")
                continue
            c = a["cell"]
            L.append(f"| {r['name']} | {r['category']} | `{t}` | {a['total']:.3f} | {a['percentile']:.1f} | "
                     f"`{a['limiting']}` | {c['lat']:.3f}, {c['lon']:.3f}, {c['dist_km']:.0f} | "
                     f"{'yes (no MODIS coverage)' if a.get('ndvi_imputed') else 'no'} |")
    L += ["", "## All sites × all targets (percentiles)", "", "| site | " + " | ".join(f"`{t}`" for t in TARGET_IDS) + " |",
          "|---|" + "---|" * len(TARGET_IDS)]
    for r in rep["sites"]:
        L.append(f"| {r['name']} | " + " | ".join(_f((r['analog'].get(t) or {}).get('percentile')) for t in TARGET_IDS) + " |")
    L += ["", "## Not captured by the global scan", ""]
    for b in cfg.get("not_captured", []):
        L.append(f"- {b}")
    REPORT_MD.parent.mkdir(parents=True, exist_ok=True)
    REPORT_MD.write_text("\n".join(L) + "\n", encoding="utf-8")
