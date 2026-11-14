"""Shared paths, grid definition and small helpers for the global scan pipeline."""
from __future__ import annotations

import datetime as _dt
import json
import math
import os
import subprocess
from pathlib import Path

import numpy as np

PIPELINE_VERSION = "1.0.0"

SCRIPTS = Path(__file__).resolve().parents[1]
ROOT = SCRIPTS.parent
CONFIG = SCRIPTS / "config"
RAW = SCRIPTS / "data_raw"
OUT = SCRIPTS / "out"
PUBLIC = ROOT / "public" / "data"
DOCS = ROOT / "docs"

TARGET_IDS = ["moon_shackleton", "moon_tranquillitatis_pit", "mars_jezero", "mars_arcadia"]

EARTH_RADIUS_KM = 6371.0088

# ---------------------------------------------------------------- 0.25 deg grid
RES = 0.25
NLAT = 720
NLON = 1440
# cell centres, north-up (row 0 = 89.875 N), west-to-east (col 0 = -179.875)
LATS = 90.0 - RES / 2 - RES * np.arange(NLAT)
LONS = -180.0 + RES / 2 + RES * np.arange(NLON)


def cell_area_km2(lats: np.ndarray = LATS, res: float = RES) -> np.ndarray:
    """Exact spherical area of a res x res cell centred at each latitude (km^2)."""
    r = EARTH_RADIUS_KM
    phi1 = np.radians(lats - res / 2)
    phi2 = np.radians(lats + res / 2)
    return r * r * np.radians(res) * (np.sin(phi2) - np.sin(phi1))


def latlon_to_idx(lat: float, lon: float) -> tuple[int, int]:
    i = int(np.clip(np.floor((90.0 - lat) / RES), 0, NLAT - 1))
    j = int(np.floor((((lon + 180.0) % 360.0)) / RES)) % NLON
    return i, j


def haversine_km(lat1, lon1, lat2, lon2):
    lat1, lon1, lat2, lon2 = map(np.radians, (lat1, lon1, lat2, lon2))
    a = np.sin((lat2 - lat1) / 2) ** 2 + np.cos(lat1) * np.cos(lat2) * np.sin((lon2 - lon1) / 2) ** 2
    return 2 * EARTH_RADIUS_KM * np.arcsin(np.sqrt(np.clip(a, 0, 1)))


def block_reduce(a: np.ndarray, f: int, how: str = "mean") -> np.ndarray:
    """Reduce a 2-D (H, W) array by an integer factor with NaN-aware statistics."""
    h, w = a.shape
    b = a.reshape(h // f, f, w // f, f).transpose(0, 2, 1, 3).reshape(h // f, w // f, f * f)
    import warnings

    with warnings.catch_warnings():
        warnings.simplefilter("ignore", RuntimeWarning)
        if how == "mean":
            return np.nanmean(b, axis=2)
        if how == "std":
            return np.nanstd(b, axis=2)
        if how == "max":
            return np.nanmax(b, axis=2)
        if how == "min":
            return np.nanmin(b, axis=2)
        if how == "count":
            return np.sum(np.isfinite(b), axis=2)
    raise ValueError(how)


# ---------------------------------------------------------------- years
def parse_years(spec: str) -> list[int]:
    spec = str(spec).strip()
    if "-" in spec:
        a, b = spec.split("-", 1)
        ys = list(range(int(a), int(b) + 1))
    else:
        ys = [int(x) for x in spec.split(",")]
    if not ys:
        raise ValueError("empty --years")
    return ys


# ---------------------------------------------------------------- io helpers
def load_json(p: Path):
    with open(p, encoding="utf-8") as f:
        return json.load(f)


def _default(o):
    if isinstance(o, (np.integer,)):
        return int(o)
    if isinstance(o, (np.floating,)):
        v = float(o)
        return None if not math.isfinite(v) else v
    if isinstance(o, np.ndarray):
        return o.tolist()
    if isinstance(o, (np.bool_,)):
        return bool(o)
    raise TypeError(type(o))


def clean_nans(o):
    if isinstance(o, float):
        return None if not math.isfinite(o) else o
    if isinstance(o, dict):
        return {k: clean_nans(v) for k, v in o.items()}
    if isinstance(o, (list, tuple)):
        return [clean_nans(v) for v in o]
    return o


def save_json(p: Path, obj, indent: int | None = 2):
    p.parent.mkdir(parents=True, exist_ok=True)
    with open(p, "w", encoding="utf-8") as f:
        json.dump(clean_nans(json.loads(json.dumps(obj, default=_default))), f, indent=indent, ensure_ascii=False)
        f.write("\n")


def now_iso() -> str:
    return _dt.datetime.now(_dt.timezone.utc).replace(microsecond=0).isoformat()


def git(*args: str) -> str:
    try:
        return subprocess.check_output(["git", *args], cwd=ROOT, text=True, stderr=subprocess.DEVNULL).strip()
    except Exception:
        return ""


def config_git_state(path: Path = CONFIG / "targets.json") -> dict:
    """Commit hash of the last commit touching the scoring config, and whether the file is dirty."""
    rel = str(path.relative_to(ROOT))
    commit = git("log", "-1", "--format=%H", "--", rel)
    subject = git("log", "-1", "--format=%s", "--", rel)
    date = git("log", "-1", "--format=%cI", "--", rel)
    dirty = bool(git("status", "--porcelain", "--", rel))
    return {"path": rel, "commit": commit or None, "subject": subject or None, "date": date or None, "dirty": dirty}


# ---------------------------------------------------------------- earthdata
def earthdata_login():
    """Load credentials from .env.local into the environment (never printed) and log in."""
    from dotenv import load_dotenv
    import earthaccess

    load_dotenv(ROOT / ".env.local", override=False)
    auth = earthaccess.login(strategy="environment")
    if not (auth and getattr(auth, "authenticated", False)):
        raise SystemExit("Earthdata login failed (check EARTHDATA_* in .env.local).")
    return auth


def log(msg: str):
    print(f"[global_scan] {msg}", flush=True)


# ---------------------------------------------------------------- memory accounting (Linux /proc)
def _status_kb(key: str) -> float:
    try:
        with open("/proc/self/status") as fh:
            for line in fh:
                if line.startswith(key + ":"):
                    return float(line.split()[1])
    except OSError:
        pass
    return float("nan")


def mem_reset_peak() -> None:
    """Reset the kernel's peak-RSS counter (VmHWM) so the next mem_peak_mb() covers one stage only."""
    try:
        with open("/proc/self/clear_refs", "w") as fh:
            fh.write("5")
    except OSError:
        pass


def mem_peak_mb() -> float:
    """Peak resident set size since the last mem_reset_peak() (or process start), in MB."""
    return _status_kb("VmHWM") / 1024.0


def mem_rss_mb() -> float:
    return _status_kb("VmRSS") / 1024.0
