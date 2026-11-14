"""Dataset discovery (CMR), size estimate and download.

Every dataset's short name, version, concept id and DOI are read from CMR / publisher metadata at
run time and written to scripts/data_raw/download_manifest.json; nothing is typed from memory.
"""
from __future__ import annotations

import json
import re
import urllib.request
import zipfile
from pathlib import Path

from .common import RAW, earthdata_login, load_json, log, now_iso, save_json

UA = {"User-Agent": "felicette-global-scan/1.0 (open-data research pipeline)"}

# short_name -> expected version. The version is verified against CMR before use.
EARTHDATA = {
    "MOD13C2": {"version": "061", "role": "NDVI (vegetation)"},
    "MOD11C3": {"version": "061", "role": "land surface temperature"},
    "MCD12C1": {"version": "061", "role": "IGBP land-cover fractions + land/water mask"},
    "M2TMNXFLX": {"version": "5.12.4", "role": "precipitation (PRECTOTCORR)"},
    "M2TMNXAER": {"version": "5.12.4", "role": "dust AOD (DUEXTTAU)"},
}

HTTP = {
    "ETOPO_2022_60s": {
        "role": "DEM: relief, slope, trafficability",
        "url": "https://www.ngdc.noaa.gov/thredds/fileServer/global/ETOPO2022/60s/60s_surface_elev_netcdf/ETOPO_2022_v1_60s_N90W180_surface.nc",
        "file": "ETOPO_2022_v1_60s_N90W180_surface.nc",
        "metadata_url": "https://www.ncei.noaa.gov/metadata/geoportal/rest/metadata/item/gov.noaa.ngdc.mgg.dem:etopo_2022/xml",
        "version": "2022 v1, 60 arc-second, surface",
    },
    "GLiM": {
        "role": "lithology (basic volcanics)",
        "url": "https://www.dropbox.com/s/9vuowtebp9f1iud/LiMW_GIS%202015.gdb.zip?dl=1",
        "landing_url": "https://www.geo.uni-hamburg.de/en/geologie/forschung/aquatische-geochemie/glim.html",
        "file": "LiMW_GIS_2015.gdb.zip",
        "metadata_url": "https://doi.pangaea.de/10.1594/PANGAEA.788537?format=metadata_jsonld",
        "version": "GLiM full-resolution polygons (LiMW_GIS 2015.gdb)",
        "fallback": "GLiM_0p5",
    },
    "GLiM_0p5": {
        "role": "lithology fallback (0.5 deg dominant class)",
        "url": "https://hdl.handle.net/10013/epic.39939.d001",
        "file": "hartmann-moosdorf_2012.zip",
        "metadata_url": "https://doi.pangaea.de/10.1594/PANGAEA.788537?format=metadata_jsonld",
        "version": "GLiM v1.0 gridded 0.5 deg",
    },
    "NE_geography_regions": {
        "role": "candidate region naming",
        "url": "https://naciscdn.org/naturalearth/10m/physical/ne_10m_geography_regions_polys.zip",
        "file": "ne_10m_geography_regions_polys.zip",
        "version": None,
    },
    "NE_admin0": {
        "role": "country naming",
        "url": "https://naciscdn.org/naturalearth/10m/cultural/ne_10m_admin_0_countries.zip",
        "file": "ne_10m_admin_0_countries.zip",
        "version": None,
    },
}

MANIFEST = RAW / "download_manifest.json"


def _http_size(url: str) -> int | None:
    req = urllib.request.Request(url, headers={**UA, "Range": "bytes=0-0"})
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            cr = r.headers.get("Content-Range")
            if cr and "/" in cr:
                return int(cr.split("/")[-1])
            cl = r.headers.get("Content-Length")
            return int(cl) if cl else None
    except Exception:
        return None


def _http_get(url: str, dest: Path, expected: int | None = None):
    if dest.exists() and (expected is None or dest.stat().st_size == expected):
        log(f"  exists: {dest.name}")
        return
    tmp = dest.with_suffix(dest.suffix + ".part")
    dest.parent.mkdir(parents=True, exist_ok=True)
    from tqdm import tqdm

    with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=120) as r, open(tmp, "wb") as f:
        total = int(r.headers.get("Content-Length") or 0) or expected
        with tqdm(total=total, unit="B", unit_scale=True, desc=dest.name) as bar:
            while chunk := r.read(1 << 20):
                f.write(chunk)
                bar.update(len(chunk))
    tmp.rename(dest)


def _doi_from_iso_xml(url: str) -> str | None:
    try:
        txt = urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=60).read().decode("utf-8", "replace")
    except Exception:
        return None
    dois = re.findall(r"10\.\d{4,}/[A-Za-z0-9._-]+", txt)
    if not dois:
        return None
    return max(set(dois), key=dois.count)


def _pangaea_meta(url: str) -> dict:
    try:
        d = json.loads(urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=60).read())
    except Exception:
        return {}
    out = {"dataset_doi": (d.get("identifier") or "").replace("https://doi.org/", "") or None, "license": d.get("license")}
    based = (d.get("@reverse") or {}).get("isBasedOn")
    if isinstance(based, dict):
        out["paper_doi"] = (based.get("identifier") or "").replace("https://doi.org/", "") or None
        out["paper_title"] = based.get("name")
    return out


# ------------------------------------------------------------------ discovery
def discover(years: list[int]) -> dict:
    import earthaccess

    earthdata_login()
    t0, t1 = f"{min(years)}-01-01", f"{max(years)}-12-31"
    out = {"generated": now_iso(), "years": years, "earthdata": {}, "http": {}}
    for sn, info in EARTHDATA.items():
        cols = earthaccess.search_datasets(short_name=sn, version=info["version"])
        if not cols:
            raise SystemExit(f"CMR: {sn} v{info['version']} not found; refusing to guess a substitute.")
        c = cols[0]
        umm = c["umm"]
        doi = (umm.get("DOI") or {}).get("DOI")
        grans = earthaccess.search_data(short_name=sn, version=info["version"], temporal=(t0, t1))
        # MCD12C1 is annual: keep only granules whose start year is requested
        kept = []
        for g in grans:
            beg = g["umm"]["TemporalExtent"]["RangeDateTime"]["BeginningDateTime"]
            if int(beg[:4]) in years:
                kept.append(g)
        begins = sorted(g["umm"]["TemporalExtent"]["RangeDateTime"]["BeginningDateTime"] for g in kept)
        ends = sorted(g["umm"]["TemporalExtent"]["RangeDateTime"]["EndingDateTime"] for g in kept)
        out["earthdata"][sn] = {
            "short_name": umm.get("ShortName"),
            "version": umm.get("Version"),
            "title": umm.get("EntryTitle"),
            "concept_id": c["meta"]["concept-id"],
            "provider": c["meta"].get("provider-id"),
            "doi": doi,
            "role": info["role"],
            "granule_count": len(kept),
            "temporal_range": [begins[0] if begins else None, ends[-1] if ends else None],
            "size_mb": round(sum(float(g.size) for g in kept), 1),
            "granules": [{"id": g["meta"]["native-id"], "url": g.data_links()[0]} for g in kept],
        }
    for key, info in HTTP.items():
        entry = {k: v for k, v in info.items() if k not in ("metadata_url",)}
        entry["size_bytes"] = _http_size(info["url"])
        if key.startswith("ETOPO"):
            entry["doi"] = _doi_from_iso_xml(info["metadata_url"])
            entry["metadata_url"] = info["metadata_url"]
        elif key.startswith("GLiM"):
            m = _pangaea_meta(info["metadata_url"])
            entry.update({"doi": m.get("paper_doi"), "dataset_doi": m.get("dataset_doi"), "license": m.get("license"),
                          "paper_title": m.get("paper_title"), "metadata_url": info["metadata_url"]})
            if key == "GLiM":
                entry["license_note"] = ("license read from the PANGAEA record of the GLiM 0.5 deg release "
                                         "(same authors and paper); the full-resolution download page states no separate license")
        else:
            entry["doi"] = None
        out["http"][key] = entry
    return out


def estimate_gb(d: dict, include_fallbacks: bool = False) -> float:
    mb = sum(v["size_mb"] for v in d["earthdata"].values())
    for k, v in d["http"].items():
        if not include_fallbacks and k == "GLiM_0p5":
            continue
        mb += (v.get("size_bytes") or 0) / 1e6
    return mb / 1000.0


def print_estimate(d: dict):
    log("download estimate:")
    for sn, v in d["earthdata"].items():
        log(f"  {sn:12s} v{v['version']:7s} {v['granule_count']:3d} granules  {v['size_mb']/1000:6.2f} GB  doi={v['doi']}")
    for k, v in d["http"].items():
        sz = v.get("size_bytes")
        log(f"  {k:22s} {('%.2f GB' % (sz/1e9)) if sz else 'size ?':>10s}  doi={v.get('doi')}")
    log(f"  TOTAL ~ {estimate_gb(d):.2f} GB")


# ------------------------------------------------------------------ download
_SESSION = None


def _earthdata_get(url: str, dest: Path, approx_bytes: int | None = None, retries: int = 4):
    """Sequential streaming download through earthaccess's authenticated session.

    Replaces earthaccess.download(), whose parallel transfers stalled indefinitely on LP DAAC
    (2026-11-14). Writes to .part and renames, with read timeouts and retries."""
    import time

    import earthaccess
    from tqdm import tqdm

    global _SESSION
    if dest.exists():
        return
    if _SESSION is None:
        _SESSION = earthaccess.get_requests_https_session()
    tmp = dest.with_suffix(dest.suffix + ".part")
    for attempt in range(1, retries + 1):
        try:
            with _SESSION.get(url, stream=True, timeout=(30, 120), allow_redirects=True) as r:
                r.raise_for_status()
                total = int(r.headers.get("Content-Length") or 0) or approx_bytes
                with open(tmp, "wb") as f, tqdm(total=total, unit="B", unit_scale=True, desc=dest.name,
                                                 mininterval=5) as bar:
                    for chunk in r.iter_content(1 << 20):
                        f.write(chunk)
                        bar.update(len(chunk))
            tmp.rename(dest)
            return
        except Exception as e:  # noqa: BLE001
            log(f"  attempt {attempt}/{retries} failed for {dest.name}: {type(e).__name__}: {e}")
            tmp.unlink(missing_ok=True)
            time.sleep(10 * attempt)
    raise SystemExit(f"download failed after {retries} attempts: {dest.name}")


def run(years: list[int], yes: bool = False, only: list[str] | None = None):
    import earthaccess

    d = discover(years)
    print_estimate(d)
    gb = estimate_gb(d)
    if gb > 5 and not yes:
        raise SystemExit(f"Estimated download {gb:.2f} GB > 5 GB. Re-run with --yes to confirm.")
    RAW.mkdir(parents=True, exist_ok=True)
    for sn, v in d["earthdata"].items():
        if only and sn not in only:
            continue
        dest = RAW / sn
        dest.mkdir(parents=True, exist_ok=True)
        grans = earthaccess.search_data(short_name=sn, version=v["version"], temporal=(f"{min(years)}-01-01", f"{max(years)}-12-31"))
        todo = [g for g in grans
                if int(g["umm"]["TemporalExtent"]["RangeDateTime"]["BeginningDateTime"][:4]) in years
                and not (dest / Path(g.data_links()[0]).name).exists()]
        log(f"{sn}: {len(todo)} granules to fetch")
        for g in todo:
            _earthdata_get(g.data_links()[0], dest / Path(g.data_links()[0]).name, int(float(g.size) * 1e6))
        v["download_date"] = now_iso()
    for key, v in d["http"].items():
        if only and key not in only:
            continue
        if key == "GLiM_0p5" and (RAW / "GLiM" / HTTP["GLiM"]["file"]).exists():
            continue  # fallback only
        dest = RAW / key / v["file"]
        try:
            _http_get(v["url"], dest, v.get("size_bytes"))
        except Exception as e:  # noqa: BLE001
            log(f"  FAILED {key}: {e}")
            v["error"] = str(e)
            continue
        v["download_date"] = now_iso()
        if key.startswith("NE_"):
            with zipfile.ZipFile(dest) as z:
                vers = [n for n in z.namelist() if n.upper().endswith("VERSION.TXT")]
                if vers:
                    v["version"] = z.read(vers[0]).decode("utf-8", "replace").strip()
    if MANIFEST.exists():
        old = load_json(MANIFEST)
        for grp in ("earthdata", "http"):
            for k, v in old.get(grp, {}).items():
                if k in d[grp] and "download_date" not in d[grp][k] and "download_date" in v:
                    d[grp][k]["download_date"] = v["download_date"]
    save_json(MANIFEST, d)
    log(f"wrote {MANIFEST}")
    return d


def smoke_hdf4():
    """Download a single MOD13C2 granule and read its NDVI SDS with pyhdf."""
    import earthaccess
    import numpy as np

    from .regrid import read_modis_sds

    earthdata_login()
    grans = earthaccess.search_data(short_name="MOD13C2", version="061", temporal=("2023-01-01", "2023-01-31"))
    if not grans:
        raise SystemExit("no MOD13C2 granule found")
    dest = RAW / "MOD13C2"
    dest.mkdir(parents=True, exist_ok=True)
    f = dest / Path(grans[0].data_links()[0]).name
    if not f.exists():
        earthaccess.download(grans[:1], local_path=str(dest))
    arr, meta = read_modis_sds(f, "CMG 0.05 Deg Monthly NDVI")
    finite = arr[np.isfinite(arr)]
    log(f"smoke: {f.name}")
    log(f"  shape={arr.shape} attrs: scale_factor={meta['scale_factor']} add_offset={meta['add_offset']} "
        f"_FillValue={meta['fill']} valid_range={meta['valid_range']} units={meta['units']!r} convention={meta['convention']}")
    log(f"  valid px={finite.size} ({finite.size/arr.size:.1%})  NDVI min={finite.min():.4f} max={finite.max():.4f} mean={finite.mean():.4f}")
    ok = arr.shape == (3600, 7200) and -1.0 <= finite.min() and finite.max() <= 1.0 and finite.size > 0.2 * arr.size
    log(f"  HDF4 smoke test: {'PASS' if ok else 'FAIL'}")
    return ok
