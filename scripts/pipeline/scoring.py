"""Desirability functions and the weighted geometric-mean Analog Score."""
from __future__ import annotations

import numpy as np

from .common import CONFIG, OUT, TARGET_IDS, load_json, log, now_iso

SCORES_NC = OUT / "scores_0p25.nc"


def desirability(dim: dict, x):
    """Map a feature value to [0, 1]. NaN in -> NaN out. Linear between breakpoints, clipped."""
    x = np.asarray(x, dtype=np.float64)
    t = dim["type"]
    with np.errstate(invalid="ignore", divide="ignore"):
        if t in ("lower_better", "higher_better"):
            full, zero = float(dim["full"]), float(dim["zero"])
            if t == "lower_better" and not full < zero:
                raise ValueError(f"lower_better needs full < zero: {dim}")
            if t == "higher_better" and not full > zero:
                raise ValueError(f"higher_better needs full > zero: {dim}")
            d = (x - zero) / (full - zero)
        elif t == "band":
            zl, fl, fh, zh = (float(dim[k]) for k in ("zero_low", "full_low", "full_high", "zero_high"))
            if not (zl <= fl <= fh <= zh):
                raise ValueError(f"band breakpoints must be ordered: {dim}")
            up = np.where(x >= fl, 1.0, (x - zl) / (fl - zl) if fl > zl else 0.0)
            down = np.where(x <= fh, 1.0, (zh - x) / (zh - fh) if zh > fh else 0.0)
            d = np.minimum(up, down)
        else:
            raise ValueError(f"unknown desirability type {t!r}")
        d = np.clip(d, 0.0, 1.0)
    return np.where(np.isfinite(x), d, np.nan)


def geometric_mean(dim_scores: list, weights: list[float], floor: float = 0.01):
    """Weighted geometric mean with each dimension floored at `floor`. NaN if any dimension is NaN."""
    w = np.asarray(weights, dtype=np.float64)
    if np.any(w < 0) or w.sum() <= 0:
        raise ValueError("weights must be non-negative with positive sum")
    S = np.stack([np.asarray(s, dtype=np.float64) for s in dim_scores])
    with np.errstate(invalid="ignore"):
        logs = np.log(np.maximum(S, floor))
    out = np.exp(np.tensordot(w, logs, axes=1) / w.sum())
    return np.where(np.all(np.isfinite(S), axis=0), out, np.nan)


def limiting_index(dim_scores: list, floor: float = 0.01):
    """argmin of floored dimension scores (first dimension in config order wins ties); -1 where NaN."""
    S = np.stack([np.asarray(s, dtype=np.float64) for s in dim_scores])
    bad = ~np.all(np.isfinite(S), axis=0)
    idx = np.argmin(np.where(np.isfinite(S), np.maximum(S, floor), np.inf), axis=0)
    return np.where(bad, -1, idx)


def dim_id(dim: dict) -> str:
    return dim.get("id", dim["feature"])


def score_target(features: dict, tcfg: dict, floor: float):
    dims = tcfg["dims"]
    ds = [desirability(d, features[d["feature"]]) for d in dims]
    total = geometric_mean(ds, [d["weight"] for d in dims], floor)
    lim = limiting_index(ds, floor)
    return total, {dim_id(d): s for d, s in zip(dims, ds)}, lim


def load_config() -> dict:
    cfg = load_json(CONFIG / "targets.json")
    for t in TARGET_IDS:
        if t not in cfg["targets"]:
            raise SystemExit(f"targets.json lacks target {t}")
        ids = [dim_id(d) for d in cfg["targets"][t]["dims"]]
        if len(set(ids)) != len(ids):
            raise SystemExit(f"duplicate dimension ids in {t}")
        for d in cfg["targets"][t]["dims"]:
            if not d.get("rationale"):
                raise SystemExit(f"{t}.{dim_id(d)}: every threshold needs a written rationale")
    return cfg


def flag_vars(ds) -> list[str]:
    """Per-cell provenance flags in features_0p25.nc (e.g. ndvi_imputed); never scoring inputs."""
    return [k for k in ds.data_vars if ds[k].attrs.get("flag") == "yes"]


def load_features():
    import xarray as xr

    from .features import FEATURES_NC

    ds = xr.load_dataset(FEATURES_NC)
    F = {k: ds[k].values.astype(np.float64) for k in ds.data_vars}
    land = ds["land_mask"].values.astype(bool)
    return F, land, ds


def run():
    import xarray as xr

    cfg = load_config()
    floor = float(cfg["scoring"]["floor"])
    F, land, fds = load_features()
    fv = fds.attrs.get("imputation_config_version")
    if fv is None or int(fv) != int(cfg["version"]):
        raise SystemExit(f"features_0p25.nc applied the missing-data rules of config v{fv}, but targets.json is "
                         f"v{cfg['version']}; re-run `features` (assembly only) first")
    out = {}
    for t in TARGET_IDS:
        tc = cfg["targets"][t]
        for d in tc["dims"]:
            if d["feature"] in cfg["scoring"].get("forbidden_features", []):
                raise SystemExit(f"{t}: feature {d['feature']} is mission-only and may not enter the Analog Score")
        total, dims, lim = score_target(F, tc, floor)
        total = np.where(land, total, np.nan)
        lim = np.where(land, lim, -1)
        out[f"{t}__total"] = (("lat", "lon"), total.astype(np.float32), {"target": t})
        out[f"{t}__limiting"] = (("lat", "lon"), lim.astype(np.int8),
                                 {"target": t, "dims": ",".join(dims.keys()), "nodata": -1})
        for k, v in dims.items():
            out[f"{t}__dim__{k}"] = (("lat", "lon"), np.where(land, v, np.nan).astype(np.float32), {"target": t, "dim": k})
        n = int(np.isfinite(total).sum())
        log(f"{t}: scored land cells {n} / {int(land.sum())}")
    for fl in flag_vars(fds):
        out[f"flag__{fl}"] = (("lat", "lon"), fds[fl].values.astype(np.uint8), dict(fds[fl].attrs))
    ds = xr.Dataset(out, coords={"lat": fds["lat"], "lon": fds["lon"]})
    ds.attrs.update({"config_version": cfg["version"], "created": now_iso()})
    ds.to_netcdf(SCORES_NC)
    log(f"wrote {SCORES_NC}")
    return ds


def load_scores():
    import xarray as xr

    return xr.load_dataset(SCORES_NC)
