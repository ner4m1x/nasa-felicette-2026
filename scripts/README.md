# scripts — Félicette's Global Scan (Python)

Scores every land cell of a 0.25° grid for similarity to four planetary targets with a
**pre-registered, frozen** config (`config/targets.json`) and exports compact files to `public/data/`.

```bash
python3 -m venv scripts/.venv
scripts/.venv/bin/pip install -r scripts/requirements.txt
# Earthdata credentials: EARTHDATA_USERNAME / EARTHDATA_PASSWORD (or EARTHDATA_TOKEN) in ./.env.local

PY=scripts/.venv/bin/python
$PY scripts/global_scan.py smoke                   # HDF4 smoke test (one MOD13C2 granule)
$PY scripts/global_scan.py estimate --years 2023   # CMR discovery + download size
$PY scripts/global_scan.py download --years 2023 --yes
$PY scripts/global_scan.py features                # + sanity checks (stops on FAIL)
$PY scripts/global_scan.py score
$PY scripts/global_scan.py validate                # refuses to run unless targets.json is committed & clean
$PY scripts/global_scan.py sensitivity --runs 200
$PY scripts/global_scan.py candidates
$PY scripts/global_scan.py export --publish
cd scripts && .venv/bin/python -m pytest
```

- `config/targets.json` — Analog Score config (pre-registered; bump `version` + log in `docs/METHOD_LOG.md` on any change).
- `config/known_sites.json` — validation set (benchmarks, traps, curated), with reference URLs.
- `config/mission_features.json` — mission-only features (trafficability, ice proxy); never enter the Analog Score.
- `config/sanity_checks.json` — feature sanity checks.
- `config/deck_text.json` — EN/PL templates for deck breakdowns (no place-specific numbers).
- `config/deck.schema.json` — JSON Schema mirror of `DeckCard` (`src/lib/types.ts`).
- `config/curated_sites.json` — coordinates mirrored from `src/data/curatedCards.ts`.
- `config/curated_notes.json` — manual commentary on candidates (never renames them).
- `.venv/`, `data_raw/`, `out/` — local only (git-ignored).

The user's Mission Configurator settings never feed into this pipeline.
