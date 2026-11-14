# scripts — global scan pipeline (Python)

Placeholder. The pipeline will compute the **Analog Score** on a 0.25° land grid using a
**pre-registered, frozen** config (`scripts/config/`) and export to `public/data/`.

- `config/` — frozen scoring configs (one per target), committed before any results are viewed.
- `pipeline/` — pipeline modules.
- `.venv/`, `data_raw/`, `out/` — local only (git-ignored).

The user's Mission Configurator settings never feed into this pipeline.
