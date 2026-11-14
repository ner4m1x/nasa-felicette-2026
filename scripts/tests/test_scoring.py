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
