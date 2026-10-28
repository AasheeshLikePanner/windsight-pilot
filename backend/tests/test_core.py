from __future__ import annotations

from datetime import UTC, date, datetime, timedelta

import pytest

from app.analysis import (
    band_for_forecast,
    compute_metrics,
    decision_points_for_day,
    error_quantiles_by_level,
    histogram,
    latest_forecasts,
    quantile,
)
from app.domain import DecisionPoint, Forecast
from app.elexon import ElexonClient
from app.store import Store
from app.timeutils import date_range, day_bounds, gate_closure_for
from tests.factories import actuals_for, forecasts_for, seed_store

DAY = date(2026, 1, 15)


def test_gate_closure_is_previous_day_n2ex_cutoff() -> None:
    assert gate_closure_for(DAY) == datetime(2026, 1, 14, 9, 50, tzinfo=UTC)


def test_day_bounds_and_date_range() -> None:
    start, end = day_bounds(DAY)
    assert start == datetime(2026, 1, 15, tzinfo=UTC)
    assert end == datetime(2026, 1, 16, tzinfo=UTC)
    assert [day.isoformat() for day in date_range(DAY, DAY + timedelta(days=2))] == [
        "2026-01-15",
        "2026-01-16",
        "2026-01-17",
    ]


def test_latest_forecasts_uses_latest_pre_gate_vintage() -> None:
    old = forecasts_for(
        DAY,
        base=9_000,
        publish_time=gate_closure_for(DAY) - timedelta(hours=25),
    )
    latest = forecasts_for(
        DAY,
        base=11_000,
        publish_time=gate_closure_for(DAY) - timedelta(minutes=90),
    )
    post_gate = [
        Forecast(
            start_time=forecast.start_time,
            publish_time=gate_closure_for(DAY) + timedelta(hours=1),
            generation_mw=99_000,
        )
        for forecast in latest
    ]
    selected = latest_forecasts(old + latest + post_gate, gate_closure_for(DAY))
    assert len(selected) == 24
    assert selected[datetime(2026, 1, 15, tzinfo=UTC)].generation_mw == 11_000
    assert all(
        forecast.publish_time <= gate_closure_for(DAY) for forecast in selected.values()
    )


def test_decision_points_average_half_hours() -> None:
    points = decision_points_for_day(
        DAY,
        actuals_for(DAY),
        forecasts_for(DAY),
    )
    assert len(points) == 24
    first = points[0]
    assert first.actual_mw == pytest.approx(10_050)
    assert first.forecast_mw == pytest.approx(11_000)
    assert first.error_mw == pytest.approx(950)
    assert first.lead_time_hours == pytest.approx(14.5)


def test_incomplete_half_hour_pair_is_not_treated_as_an_hour() -> None:
    actuals = actuals_for(DAY)
    missing_one = [
        row
        for row in actuals
        if row.start_time != datetime(2026, 1, 15, 0, 30, tzinfo=UTC)
    ]
    points = decision_points_for_day(DAY, missing_one, forecasts_for(DAY))
    assert len(points) == 23
    assert all(point.start_time.hour != 0 for point in points)


def test_compute_metrics_known_values() -> None:
    published = datetime(2026, 1, 1, tzinfo=UTC)
    points = [
        DecisionPoint(
            start_time=datetime(2026, 1, 2, tzinfo=UTC),
            settlement_date=date(2026, 1, 2),
            hour=0,
            forecast_mw=1_100,
            actual_mw=1_000,
            forecast_publish_time=published,
            lead_time_hours=24,
        ),
        DecisionPoint(
            start_time=datetime(2026, 1, 2, 1, tzinfo=UTC),
            settlement_date=date(2026, 1, 2),
            hour=1,
            forecast_mw=1_800,
            actual_mw=2_000,
            forecast_publish_time=published,
            lead_time_hours=25,
        ),
    ]
    metrics = compute_metrics(points, expected_points=2)
    assert metrics["n"] == 2
    assert metrics["mae_mw"] == pytest.approx(150.0)
    assert metrics["bias_mw"] == pytest.approx(-50.0)
    assert metrics["rmse_mw"] == pytest.approx(158.1)
    assert metrics["nmae_pct"] == pytest.approx(10.0)
    assert metrics["within_1gw_pct"] == pytest.approx(100.0)
    assert metrics["p90_abs_error_mw"] == pytest.approx(190.0)
    assert metrics["p90_shortfall_mw"] == pytest.approx(90.0)
    assert metrics["coverage_pct"] == pytest.approx(100.0)


def test_quantile_interpolates() -> None:
    assert quantile([], 0.9) == 0.0
    assert quantile([10], 0.5) == 10.0
    assert quantile([0, 10], 0.5) == 5.0
    assert quantile([0, 10], 0.9) == 9.0


def test_histogram_bins_signed_errors() -> None:
    points = decision_points_for_day(DAY, actuals_for(DAY), forecasts_for(DAY))
    bins = histogram(points[:4], bin_width=1_000)
    assert sum(item["count"] for item in bins) == 4
    assert bins[0]["bin_start_mw"] <= points[0].error_mw


def test_band_handles_a_negative_forecast() -> None:
    points = decision_points_for_day(DAY, actuals_for(DAY), forecasts_for(DAY))
    band = band_for_forecast(-500, error_quantiles_by_level(points))
    assert band["level"] == "0–5 GW"
    assert band["lower_mw"] >= 0
    assert band["upper_mw"] >= 0


def test_error_quantiles_exclude_day_and_band_is_ordered() -> None:
    points = decision_points_for_day(
        DAY, actuals_for(DAY), forecasts_for(DAY)
    ) + decision_points_for_day(
        DAY + timedelta(days=1),
        actuals_for(DAY + timedelta(days=1)),
        forecasts_for(DAY + timedelta(days=1)),
    )
    quantiles = error_quantiles_by_level(points, exclude_date=DAY)
    assert quantiles["global"]["n"] == 24
    band = band_for_forecast(11_000, quantiles)
    assert band["lower_mw"] <= band["upper_mw"]
    assert band["shortfall_buffer_mw"] >= 0


def test_store_upserts_are_idempotent(tmp_path) -> None:
    store = Store(tmp_path / "test.db")
    try:
        seed_store(store, [DAY, DAY + timedelta(days=1)])
        seed_store(store, [DAY])
        counts = store.counts()
        coverage = store.date_coverage()
    finally:
        store.close()
    assert counts["actuals"] == 96
    assert counts["forecasts"] == 48
    assert counts["delivery_dates"] == 2
    assert len(coverage) == 2
    assert coverage[0]["actual_rows"] == 48
    assert coverage[0]["forecast_hours"] == 24


def test_elexon_forecasts_filter_horizon_and_gate() -> None:
    client = ElexonClient(delay=0)
    rows = [
        {
            "startTime": "2026-01-15T00:00:00Z",
            "publishTime": "2026-01-14T09:30:00Z",
            "generation": 1_000,
        },
        {
            "startTime": "2026-01-15T00:00:00Z",
            "publishTime": "2026-01-14T09:50:00Z",
            "generation": 1_100,
        },
        {
            "startTime": "2026-01-15T00:00:00Z",
            "publishTime": "2026-01-14T12:00:00Z",
            "generation": 9_999,
        },
        {
            "startTime": "2026-01-16T00:00:00Z",
            "publishTime": "2026-01-14T09:30:00Z",
            "generation": 2_000,
        },
        {
            "startTime": "2026-01-15T01:00:00Z",
            "publishTime": "2026-01-14T09:30:00Z",
            "generation": "not-a-number",
        },
        {
            "publishTime": "2026-01-14T09:30:00Z",
            "generation": 3_000,
        },
        {
            "startTime": "2026-01-15T02:00:00Z",
            "publishTime": "not-a-time",
            "generation": 3_000,
        },
    ]
    client._get = lambda path, params: rows  # type: ignore[method-assign]
    try:
        forecasts = client.wind_forecasts(DAY)
    finally:
        client.close()
    assert len(forecasts) == 2
    assert forecasts[0].generation_mw == 1_000
    assert forecasts[1].generation_mw == 1_100
    assert forecasts[1].publish_time == datetime(2026, 1, 14, 9, 50, tzinfo=UTC)
