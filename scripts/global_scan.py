#!/usr/bin/env python3
"""Felicette's Global Scan: scores every land cell on Earth for similarity to four planetary targets.

    python scripts/global_scan.py smoke                  # HDF4 smoke test (one MOD13C2 granule)
    python scripts/global_scan.py estimate --years 2023  # CMR discovery + download size, no download
    python scripts/global_scan.py download --years 2023 [--yes]
    python scripts/global_scan.py features
    python scripts/global_scan.py score
    python scripts/global_scan.py validate               # refuses to run unless targets.json is committed
    python scripts/global_scan.py sensitivity --runs 200
    python scripts/global_scan.py candidates
    python scripts/global_scan.py export --publish       # copies outputs to public/data/
    python scripts/global_scan.py all --years 2023
"""
from __future__ import annotations

import argparse
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from pipeline.common import log, parse_years  # noqa: E402


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("command", choices=["smoke", "estimate", "download", "features", "score", "validate",
                                        "sensitivity", "candidates", "export", "all"])
    ap.add_argument("--years", default="2023", help="e.g. 2023, 2019-2023 or 2021,2023")
    ap.add_argument("--yes", action="store_true", help="confirm downloads above 5 GB")
    ap.add_argument("--runs", type=int, default=200)
    ap.add_argument("--publish", action="store_true")
    ap.add_argument("--grid-encoding", choices=["raw", "gzip"], default="gzip")
    ap.add_argument("--only", nargs="*", help="download only these dataset keys")
    a = ap.parse_args(argv)
    years = parse_years(a.years)
    t0 = time.time()

    from pipeline import candidates, download, export, features, scoring, sensitivity, validate

    if a.command == "smoke":
        ok = download.smoke_hdf4()
        sys.exit(0 if ok else 1)
    if a.command == "estimate":
        d = download.discover(years)
        download.print_estimate(d)
    if a.command in ("download", "all"):
        download.run(years, yes=a.yes, only=a.only)
    if a.command in ("features", "all"):
        features.run(years)
    if a.command in ("score", "all"):
        scoring.run()
    if a.command in ("validate", "all"):
        validate.run()
    if a.command in ("sensitivity", "all"):
        sensitivity.run(a.runs)
    if a.command in ("candidates", "all"):
        candidates.run()
    if a.command in ("export", "all"):
        export.run(publish=a.publish, grid_encoding=a.grid_encoding)
    log(f"done: {a.command} in {time.time() - t0:.0f} s")


if __name__ == "__main__":
    main()
