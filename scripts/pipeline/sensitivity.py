"""Monte Carlo sensitivity of the Analog Score to weights and thresholds -> sensitivity_report.json."""
from __future__ import annotations

import copy

import numpy as np

from .candidates import find_regions, region_key, top_threshold
from .common import CONFIG, OUT, TARGET_IDS, load_json, log, now_iso, save_json
from .scoring import geometric_mean, load_config, load_features, load_scores, desirability
from .validate import cells_within

REPORT = OUT / "sensitivity_report.json"
BREAKS = {"lower_better": ("full", "zero"), "higher_better": ("full", "zero"),
          "band": ("zero_low", "full_low", "full_high", "zero_high")}


def perturb_target(tcfg: dict, rng: np.random.Generator, w_rel: float, t_rel: float) -> dict:
    """Weights x U(1-w_rel, 1+w_rel), renormalised. Each breakpoint shifted by U(-t_rel, t_rel) x the
    function's span (|full - zero|, or zero_high - zero_low), so the perturbation does not depend on the
    origin of the unit (e.g. degC vs K). Band breakpoints are re-sorted if they cross."""
    t = copy.deepcopy(tcfg)
    w = np.array([d["weight"] for d in t["dims"]], float) * rng.uniform(1 - w_rel, 1 + w_rel, len(t["dims"]))
    w = w / w.sum()
    for d, wi in zip(t["dims"], w):
        d["weight"] = float(wi)
        keys = BREAKS[d["type"]]
        vals = np.array([float(d[k]) for k in keys])
        span = abs(vals.max() - vals.min())
        vals = vals + rng.uniform(-t_rel, t_rel, len(vals)) * span
        if d["type"] == "band":
            vals = np.sort(vals)
        for k, v in zip(keys, vals):
            d[k] = float(v)
    return t


def run(runs: int = 200):
    from .validate import require_frozen_config

    require_frozen_config()  # reports benchmark percentiles, so the same pre-registration rule applies
    cfg = load_config()
    m = cfg["method"]
    sm = m["sensitivity"]
    rng = np.random.default_rng(int(sm["seed"]))
    S = load_scores()
    F, land, _ = load_features()
    floor = float(cfg["scoring"]["floor"])
    li = np.where(land.ravel())[0]
    sites = [s for s in load_json(CONFIG / "known_sites.json")["sites"] if s["category"] in ("benchmark", "trap")]
    site_cells = {s["id"]: cells_within(s["lat"], s["lon"], m["site_radius_km"]) for s in sites}
    shape = land.shape
    rep = {"generated": now_iso(), "runs": runs, "config_version": cfg["version"],
           "method": {"weights": f"x U(1-{sm['weight_rel']}, 1+{sm['weight_rel']}), renormalised",
                      "thresholds": f"each breakpoint + U(-{sm['threshold_rel']}, {sm['threshold_rel']}) x span of its function",
                      "region_retained": f"a baseline region counts as retained in a run if >= {sm['retain_cell_frac']:.0%} of its cells "
                                         f"are in that run's top {m['top_fraction']:.0%} of land cells",
                      "seed": sm["seed"]},
           "targets": {}}
    for t in TARGET_IDS:
        tc = cfg["targets"][t]
        base = S[f"{t}__total"].values
        regions = find_regions(base, m["top_fraction"], m["min_region_cells"])
        feats = {d["feature"]: F[d["feature"]].ravel()[li] for d in tc["dims"]}
        retained = np.zeros(len(regions))
        # map land-cell position for each region
        pos = np.full(shape[0] * shape[1], -1, np.int64)
        pos[li] = np.arange(li.size)
        reg_pos = [pos[r] for r in regions]
        site_pos = {k: pos[np.ravel_multi_index(v, shape)] for k, v in site_cells.items()}
        site_pct = {k: [] for k in site_pos}
        for _ in range(runs):
            pt = perturb_target(tc, rng, sm["weight_rel"], sm["threshold_rel"])
            ds = [desirability(d, feats[d["feature"]]) for d in pt["dims"]]
            tot = geometric_mean(ds, [d["weight"] for d in pt["dims"]], floor)
            ok = np.isfinite(tot)
            thr = top_threshold(tot, m["top_fraction"])
            top = ok & (tot >= thr)
            for k, rp in enumerate(reg_pos):
                rp = rp[rp >= 0]
                retained[k] += top[rp].mean() >= sm["retain_cell_frac"]
            srt = np.sort(tot[ok])
            for sid, sp in site_pos.items():
                sp = sp[sp >= 0]
                v = tot[sp]
                if not np.isfinite(v).any():
                    site_pct[sid].append(np.nan)
                    continue
                s = np.nanmax(v)
                lo, hi = np.searchsorted(srt, s, "left"), np.searchsorted(srt, s, "right")
                site_pct[sid].append(100.0 * (lo + 0.5 * (hi - lo)) / srt.size)
        stab = {region_key(r): float(retained[k] / runs) for k, r in enumerate(regions)}
        spread = {}
        for s in sites:
            if t not in s["relevant_targets"]:
                continue
            v = np.array(site_pct[s["id"]], float)
            v = v[np.isfinite(v)]
            spread[s["id"]] = None if not v.size else {
                "category": s["category"], "p05": float(np.percentile(v, 5)), "p25": float(np.percentile(v, 25)),
                "median": float(np.median(v)), "p75": float(np.percentile(v, 75)), "p95": float(np.percentile(v, 95)),
                "min": float(v.min()), "max": float(v.max())}
        rep["targets"][t] = {"n_regions": len(regions), "region_stability": stab, "site_percentile_spread": spread}
        log(f"{t}: {len(regions)} regions; median stability {np.median(list(stab.values())) if stab else float('nan'):.2f}")
    save_json(REPORT, rep)
    log(f"wrote {REPORT}")
    return rep
