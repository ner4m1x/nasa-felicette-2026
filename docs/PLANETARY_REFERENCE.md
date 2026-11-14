# Planetary reference values

Source of truth: [`src/data/planetaryReference.ts`](../src/data/planetaryReference.ts); citations in
[`src/data/sources.ts`](../src/data/sources.ts). Shown in the app by `PlanetaryComparison`, which appears in the
breakdown sheet and the point inspector, and listed under Report → Methods & data.

Every value comes from a peer-reviewed analysis of LRO / Mars 2020 / MRO data archived in the NASA PDS, or from
the NASA NSSDC fact sheet. **Do not change the numbers.** Earth cannot reproduce vacuum, gravity or radiation
(see Earth Limits in the app).

The "Earth feature" column names the `scan_grid` band the value is compared against. "—" means Earth global data
cannot see this property. The "How far Earth gets" bar appears only when that feature is a scored dimension of
the target in the frozen scoring config.

| Target | Id | Value | Instrument | Earth feature | Source | DOI |
|---|---|---|---|---|---|---|
| Moon – Shackleton | `psr_coldtrap_temp` | 37 K (≈ −236 °C), annual mean, Cabeus PSR (LCROSS site) | LRO Diviner | `lst_night_min_c` | Paige et al. 2010, *Science* 330:479–482 | [10.1126/science.1187726](https://doi.org/10.1126/science.1187726) |
| Moon – Shackleton | `rim_continuous_sunlight` | ≈ 240 days continuous sunlight per year near the rim; longest darkness ≈ 1.5 days | LRO LOLA | `polar_day_frac` (× 365 → days) | Mazarico et al. 2011, *Icarus* 211:1066–1081 | [10.1016/j.icarus.2010.10.030](https://doi.org/10.1016/j.icarus.2010.10.030) |
| Moon – Shackleton | `rim_illumination_pct` | 85.5 % average sunlit time, Shackleton rim | LRO LOLA DTMs | `polar_day_frac` (× 100 → %) | Gläser et al. 2018, *Planetary and Space Science* 162:170–178 | [10.1016/j.pss.2017.07.006](https://doi.org/10.1016/j.pss.2017.07.006)¹ |
| Moon – Tranquillitatis pit | `pit_shade_temp` | 17 °C, ≈ 1 °C variation over a lunar day (permanent shade) | LRO Diviner + thermal models | — (caves are invisible to Earth global data) | Horvath et al. 2022, *GRL* 49 | [10.1029/2022GL099710](https://doi.org/10.1029/2022GL099710) |
| Moon – Tranquillitatis pit | `surface_temp_range` | −173 … 127 °C (night/day surface) | LRO Diviner | — | Horvath et al. 2022 (NASA/UCLA release) | [10.1029/2022GL099710](https://doi.org/10.1029/2022GL099710) |
| Moon – Tranquillitatis pit | `pit_depth` | ≈ 100 m (football-field-sized pit) | LROC + Diviner | — | Horvath et al. 2022 | [10.1029/2022GL099710](https://doi.org/10.1029/2022GL099710) |
| Moon – Tranquillitatis pit | `substrate` | Mare (flood-basalt) plains (qualitative) | LROC | `basalt_frac` | Horvath et al. 2022 | [10.1029/2022GL099710](https://doi.org/10.1029/2022GL099710) |
| Mars – Jezero | `air_temp_mean` | −55 °C mean near-surface air temperature | Mars 2020 MEDA | `lst_allmonth_mean_c` (surface vs air – indicative) | Rodriguez-Manfredi et al. 2023, *Nature Geoscience* 16:19–28 (+ UPV/EHU release) | [10.1038/s41561-022-01084-0](https://doi.org/10.1038/s41561-022-01084-0) |
| Mars – Jezero | `air_temp_diurnal_swing` | 50 … 60 K day–night air temperature swing | Mars 2020 MEDA | `lst_diurnal_range_k` (Earth surface LST vs Mars air at ~1.5 m – indicative) | Rodriguez-Manfredi et al. 2023 | [10.1038/s41561-022-01084-0](https://doi.org/10.1038/s41561-022-01084-0) |
| Mars – Jezero | `landing_site` | 18.44° N, 77.45° E (display only) | Mars 2020 | — | Rodriguez-Manfredi et al. 2023 | [10.1038/s41561-022-01084-0](https://doi.org/10.1038/s41561-022-01084-0) |
| Mars – Arcadia | `excess_ice_thickness` | up to ≈ 40 m ("decameters-thick"), ≈ 10⁴ km³ excess water ice | MRO SHARAD + HiRISE | — (subsurface ice not measured; `ice_proxy` is only a proxy) | Bramson et al. 2015, *GRL* 42:6566–6574 | [10.1002/2015GL064844](https://doi.org/10.1002/2015GL064844) |
| Mars – Arcadia | `mars_mean_surface_temp` | ≈ 214 K (−59 °C) global average | NSSDC | `lst_allmonth_mean_c` | [NASA NSSDC Mars Fact Sheet](https://nssdc.gsfc.nasa.gov/planetary/factsheet/marsfact.html) | — |
| Mars – Arcadia | `viking1_diurnal_range` | −89 … −31 °C (184–242 K), Viking 1 Lander site | Viking 1 Lander | `lst_diurnal_range_k` (indicative) | NASA NSSDC Mars Fact Sheet | — |

¹ The prompt gave no DOI for this paper. It was found with a Crossref title search; the journal, volume and pages
match. The source stays `verified: false` until the 85.5 % value has been checked against the paper.

## DOI verification (2026-11-14)

Each DOI was resolved through the Crossref API (`api.crossref.org/works/<doi>`), and the title, journal, volume,
pages, first author and year were compared with the citation. `doi.org` returned a redirect for each one. The NSSDC
fact sheet was fetched and contains "Average temperature: ~214 K (-59 C)" and "Diurnal temperature range: 184 K to
242 K (-89 to -31 C) (Viking 1 Lander site)".
