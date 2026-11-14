import json
import math

import numpy as np
import pytest

from pipeline.candidates import label_wrap
from pipeline.common import CONFIG, NLAT, NLON, cell_area_km2, latlon_to_idx
from pipeline.export import _quantize
from pipeline.features import polar_day_fraction
from pipeline.regrid import apply_scale
from pipeline.scoring import desirability, geometric_mean, limiting_index
from pipeline.sensitivity import perturb_target


# ---------------------------------------------------------------- desirability
def test_lower_better():
    d = {"type": "lower_better", "full": 25, "zero": 250}
    np.testing.assert_allclose(desirability(d, [0, 25, 137.5, 250, 1000]), [1, 1, 0.5, 0, 0])


def test_higher_better():
    d = {"type": "higher_better", "full": 80, "zero": 20}
    np.testing.assert_allclose(desirability(d, [0, 20, 50, 80, 100]), [0, 0, 0.5, 1, 1])


def test_higher_better_negative_scale():
    d = {"type": "lower_better", "full": -50, "zero": -10}
    np.testing.assert_allclose(desirability(d, [-60, -50, -30, -10, 5]), [1, 1, 0.5, 0, 0])


def test_band():
    d = {"type": "band", "zero_low": 5, "full_low": 20, "full_high": 300, "zero_high": 1000}
    np.testing.assert_allclose(desirability(d, [0, 5, 12.5, 20, 150, 300, 650, 1000, 2000]),
                               [0, 0, 0.5, 1, 1, 1, 0.5, 0, 0])


def test_band_with_zero_width_edge():
    d = {"type": "band", "zero_low": 0, "full_low": 0, "full_high": 60, "zero_high": 95}
    np.testing.assert_allclose(desirability(d, [0, 30, 95]), [1, 1, 0])


def test_nan_propagates():
    d = {"type": "lower_better", "full": 0, "zero": 1}
    out = desirability(d, [np.nan, 0.5])
    assert np.isnan(out[0]) and out[1] == pytest.approx(0.5)


def test_bad_direction_rejected():
    with pytest.raises(ValueError):
        desirability({"type": "lower_better", "full": 10, "zero": 5}, [1])
    with pytest.raises(ValueError):
        desirability({"type": "band", "zero_low": 5, "full_low": 1, "full_high": 6, "zero_high": 7}, [1])


# ---------------------------------------------------------------- aggregation
def test_geometric_mean_weighted():
    g = geometric_mean([np.array([0.5]), np.array([0.8])], [0.25, 0.75])
    assert g[0] == pytest.approx(math.exp(0.25 * math.log(0.5) + 0.75 * math.log(0.8)))


def test_geometric_mean_weights_need_not_sum_to_one():
    a = geometric_mean([np.array([0.5]), np.array([0.8])], [1, 3])
    b = geometric_mean([np.array([0.5]), np.array([0.8])], [0.25, 0.75])
    assert a[0] == pytest.approx(b[0])


def test_floor_applies():
    g = geometric_mean([np.array([0.0]), np.array([1.0])], [0.5, 0.5], floor=0.01)
    assert g[0] == pytest.approx(0.1)  # sqrt(0.01 * 1)
    assert g[0] > 0


def test_one_failing_dimension_pulls_total_down():
    g = geometric_mean([np.array([1.0]), np.array([1.0]), np.array([0.0])], [1, 1, 1])
    arith = (1 + 1 + 0.01) / 3
    assert g[0] < arith


def test_all_full_is_one_and_nan_is_unscored():
    g = geometric_mean([np.array([1.0, np.nan]), np.array([1.0, 1.0])], [1, 1])
    assert g[0] == pytest.approx(1.0) and np.isnan(g[1])


def test_limiting_index_and_ties():
    s = [np.array([0.5, 0.0, 0.3]), np.array([0.2, 0.0, 0.3]), np.array([0.9, 0.005, np.nan])]
    np.testing.assert_array_equal(limiting_index(s), [1, 0, -1])  # floor makes 0.0 and 0.005 tie -> first


# ---------------------------------------------------------------- config & helpers
def test_frozen_config_is_valid():
    cfg = json.loads((CONFIG / "targets.json").read_text())
    for t, tc in cfg["targets"].items():
        for d in tc["dims"]:
            desirability(d, [0.0])  # raises on malformed breakpoints
            assert d["rationale"], f"{t}.{d['feature']} lacks a rationale"
            assert d["feature"] not in cfg["scoring"]["forbidden_features"]
        assert sum(d["weight"] for d in tc["dims"]) == pytest.approx(1.0)


def test_apply_scale_conventions():
    vi = {"scale_factor": 10000.0, "add_offset": 0.0, "fill": -3000, "valid_range": [-2000, 10000]}
    out, conv = apply_scale(np.array([5000, -3000, 10000]), vi)
    assert out[0] == pytest.approx(0.5) and np.isnan(out[1]) and out[2] == pytest.approx(1.0)
    lst = {"scale_factor": 0.02, "add_offset": 0.0, "fill": 0, "valid_range": [7500, 65535]}
    out, conv = apply_scale(np.array([15000, 0]), lst)
    assert out[0] == pytest.approx(300.0) and np.isnan(out[1])


def test_polar_day_fraction():
    p = polar_day_fraction(np.array([0.0, 60.0, 70.0, 89.9, -89.9]))
    assert p[0] == 0 and p[1] == 0
    assert 0.1 < p[2] < 0.25
    assert 0.45 < p[3] < 0.55 and 0.45 < p[4] < 0.55


def test_label_wraps_antimeridian():
    m = np.zeros((NLAT, NLON), bool)
    m[100, 0] = m[100, NLON - 1] = m[101, NLON - 1] = True
    lab, n = label_wrap(m)
    assert n == 1


def test_grid_helpers():
    assert latlon_to_idx(89.99, -179.99) == (0, 0)
    assert latlon_to_idx(-89.99, 179.99) == (NLAT - 1, NLON - 1)
    assert cell_area_km2().sum() * NLON == pytest.approx(4 * math.pi * 6371.0088 ** 2, rel=1e-9)


def test_quantize_roundtrip():
    a = np.array([0.0, 0.5, 1.0, np.nan])
    q, sc, off = _quantize(a, 0.0, 1.0)
    assert q[3] == 255
    np.testing.assert_allclose(off + sc * q[:3], a[:3], atol=sc / 2)


def test_perturbation_keeps_valid_functions():
    cfg = json.loads((CONFIG / "targets.json").read_text())
    rng = np.random.default_rng(0)
    for _ in range(50):
        for tc in cfg["targets"].values():
            p = perturb_target(tc, rng, 0.25, 0.15)
            assert sum(d["weight"] for d in p["dims"]) == pytest.approx(1.0)
            for d in p["dims"]:
                desirability(d, [0.0])


# ---------------------------------------------------------------- pre-freeze review additions
def test_allmonth_mean_combines_day_and_night():
    from pipeline.features import allmonth_mean

    nan = np.nan
    # 4 months x 1 cell: both / polar night (night only) / polar day (day only) / neither (skipped)
    day = np.array([10.0, nan, 4.0, nan]).reshape(4, 1, 1)
    night = np.array([0.0, -30.0, nan, nan]).reshape(4, 1, 1)
    out = allmonth_mean(day, night)
    assert out.shape == (1, 1)
    assert out[0, 0] == pytest.approx((5.0 - 30.0 + 4.0) / 3)


def test_allmonth_mean_all_missing_is_nan():
    from pipeline.features import allmonth_mean

    out = allmonth_mean(np.full((12, 1, 1), np.nan), np.full((12, 1, 1), np.nan))
    assert np.isnan(out[0, 0])


def test_shackleton_snowice_band_is_neutral_when_ice_free():
    cfg = json.loads((CONFIG / "targets.json").read_text())
    d = next(x for x in cfg["targets"]["moon_shackleton"]["dims"] if x["feature"] == "snowice_frac")
    np.testing.assert_allclose(desirability(d, [0, 5, 30, 60, 95, 100]), [0.5, 1, 1, 1, 0, 0])


def test_breakdown_per_target_shape_and_numbers_from_data():
    from pipeline.common import load_json
    from pipeline.export import breakdown

    cfg = json.loads((CONFIG / "targets.json").read_text())
    T = load_json(CONFIG / "deck_text.json")
    for t, tc in cfg["targets"].items():
        dims = {d["feature"]: 0.9 - 0.1 * k for k, d in enumerate(tc["dims"])}
        values = {d["feature"]: 123.456 for d in tc["dims"]}
        lim = tc["dims"][-1]["feature"]
        b = breakdown(t, cfg, T, dims, values, lim)
        assert set(b) == {"matches", "breaksDown", "utility"}
        for part in b.values():
            assert set(part) == {"en", "pl"} and all(part[l] for l in ("en", "pl"))
        assert 2 <= len(b["matches"]["en"]) <= 3
        assert any("123" in line or "12346" in line for line in b["matches"]["en"])


# ---------------------------------------------------------------- memory refactor: banded == whole-array
def test_apply_scale_banded_equals_whole_array():
    rng = np.random.default_rng(0)
    raw = rng.integers(-3000, 12000, size=(1300, 50)).astype(np.int16)
    raw[::7, ::3] = -3000
    meta = {"scale_factor": 10000.0, "add_offset": 0.0, "fill": -3000, "valid_range": [-2000, 10000]}
    a, _ = apply_scale(raw, meta, block_rows=600)
    b, _ = apply_scale(raw, meta, block_rows=10**9)
    np.testing.assert_array_equal(a, b)
    ref = (raw.astype(np.float64) / 10000.0)
    ref[(raw == -3000) | (raw < -2000) | (raw > 10000)] = np.nan
    np.testing.assert_array_equal(a, ref.astype(np.float32))


def test_cmg_to_grid_banded_equals_block_reduce():
    from pipeline.common import block_reduce
    from pipeline.regrid import cmg_to_grid

    rng = np.random.default_rng(1)
    a = rng.random((3600, 7200), dtype=np.float32)
    a[rng.random(a.shape) < 0.2] = np.nan
    np.testing.assert_array_equal(cmg_to_grid(a), block_reduce(a, 5, "mean").astype(np.float32))


# ---------------------------------------------------------------- config v2: NDVI missing-data rule
def _ndvi_rules():
    cfg = json.loads((CONFIG / "targets.json").read_text())
    rules = cfg["scoring"]["missing_data_imputation"]
    assert [r["id"] for r in rules] == ["ndvi_no_modis_coverage"]
    return cfg, rules


def _cells(ndvi, barren=0.0, snowice=0.0, water=0.0, land=True):
    a = lambda v: np.array([[v]], np.float32)  # noqa: E731
    return ({"ndvi_mean": a(ndvi), "ndvi_max": a(ndvi), "barren_frac": a(barren), "snowice_frac": a(snowice),
             "water_frac": a(water)}, np.array([[land]]))


def test_nonveg_land_share_definition():
    from pipeline.features import nonveg_land_share

    F, _ = _cells(np.nan, barren=30.0, snowice=30.0, water=40.0)
    assert nonveg_land_share(F)[0, 0] == pytest.approx(1.0)
    F, _ = _cells(np.nan, barren=10.0, water=0.0)
    assert nonveg_land_share(F)[0, 0] == pytest.approx(0.1)
    F, _ = _cells(np.nan, water=100.0)
    assert np.isnan(nonveg_land_share(F)[0, 0])  # all water: undefined, no imputation


def test_ndvi_rule_missing_and_barren_imputes_zero():
    from pipeline.features import apply_imputation

    _, rules = _ndvi_rules()
    F, land = _cells(np.nan, barren=100.0)
    flags, n = apply_imputation(F, land, rules)
    assert F["ndvi_mean"][0, 0] == 0.0 and F["ndvi_max"][0, 0] == 0.0
    assert flags["ndvi_imputed"][0, 0] and n["ndvi_no_modis_coverage"] == 1
    F, land = _cells(np.nan, barren=95.0, snowice=0.0, water=0.0)  # threshold is inclusive (>=)
    flags, _ = apply_imputation(F, land, rules)
    assert flags["ndvi_imputed"][0, 0] and F["ndvi_max"][0, 0] == 0.0


def test_ndvi_rule_coastal_cell_water_does_not_block():
    from pipeline.features import apply_imputation

    _, rules = _ndvi_rules()
    F, land = _cells(np.nan, snowice=60.0, water=40.0)  # water 40 %, rest snow/ice
    flags, n = apply_imputation(F, land, rules)
    assert flags["ndvi_imputed"][0, 0] and F["ndvi_mean"][0, 0] == 0.0 and F["ndvi_max"][0, 0] == 0.0
    assert n["ndvi_no_modis_coverage"] == 1


def test_ndvi_rule_missing_and_vegetated_stays_unscored():
    from pipeline.features import apply_imputation
    from pipeline.scoring import score_target

    cfg, rules = _ndvi_rules()
    # 94 % of land non-vegetated; 50 % vegetated; land cover missing
    for kw in ({"barren": 94.0}, {"barren": 30.0, "snowice": 0.0, "water": 40.0}, {"barren": np.nan}):
        F, land = _cells(np.nan, **kw)
        flags, n = apply_imputation(F, land, rules)
        assert np.isnan(F["ndvi_mean"][0, 0]) and np.isnan(F["ndvi_max"][0, 0])
        assert not flags["ndvi_imputed"][0, 0] and n["ndvi_no_modis_coverage"] == 0
    # ...and a target that uses ndvi_max then leaves the cell unscored
    feats = {d["feature"]: np.array([[1.0]]) for d in cfg["targets"]["mars_jezero"]["dims"]}
    feats["ndvi_max"] = F["ndvi_max"]
    total, _, lim = score_target(feats, cfg["targets"]["mars_jezero"], cfg["scoring"]["floor"])
    assert np.isnan(total[0, 0]) and lim[0, 0] == -1


def test_ndvi_rule_present_values_and_ocean_unchanged():
    from pipeline.features import apply_imputation

    _, rules = _ndvi_rules()
    F, land = _cells(0.42, barren=100.0)
    flags, _ = apply_imputation(F, land, rules)
    assert F["ndvi_mean"][0, 0] == np.float32(0.42) and F["ndvi_max"][0, 0] == np.float32(0.42)
    assert not flags["ndvi_imputed"][0, 0]
    F, land = _cells(np.nan, barren=100.0, land=False)  # not a land cell: untouched
    flags, _ = apply_imputation(F, land, rules)
    assert np.isnan(F["ndvi_max"][0, 0]) and not flags["ndvi_imputed"][0, 0]


def test_v2_changes_no_weight_or_threshold():
    cfg, rules = _ndvi_rules()
    assert cfg["version"] == 2 and cfg["config_id"] == "targets-v2"
    assert rules[0]["set_to"] == 0.0
    assert rules[0]["condition"] == {"feature": "nonveg_land_share", "op": ">=", "value": 0.95}
    assert "ndvi_imputed" not in {d["feature"] for tc in cfg["targets"].values() for d in tc["dims"]}


def test_deck_schema_accepts_optional_ndvi_imputed():
    import jsonschema

    schema = json.loads((CONFIG / "deck.schema.json").read_text())
    card = {"id": "x", "kind": "benchmark", "name": "x", "country": None, "lat": 0, "lon": 0, "scale": "regional",
            "regionAreaKm2": None, "analog": None, "breakdown": {}, "sourceIds": [], "stability": None, "known": True,
            "mission": {"slopeMeanDeg": None, "trafficableFrac": None, "reliefStdM": None, "iceProxy": None, "basaltFrac": None}}
    jsonschema.validate({"cards": [card]}, schema)
    jsonschema.validate({"cards": [{**card, "ndviImputed": True}]}, schema)
    with pytest.raises(jsonschema.ValidationError):
        jsonschema.validate({"cards": [{**card, "ndviImputed": "yes"}]}, schema)
