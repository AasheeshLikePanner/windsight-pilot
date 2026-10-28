from __future__ import annotations

import math
from collections import defaultdict
from collections.abc import Iterable
from datetime import UTC, date, datetime, time, timedelta
from statistics import mean

from .config import GATE_CLOSURE_LABEL
from .domain import Actual, DecisionPoint, Forecast
from .store import Store
from .timeutils import date_range, day_bounds, floor_hour, gate_closure_for, iso_utc

LEVEL_BUCKETS: list[tuple[float, float, str]] = [
    (0, 5_000, "0–5 GW"),
    (5_000, 10_000, "5–10 GW"),
    (10_000, 15_000, "10–15 GW"),
    (15_000, 20_000, "15–20 GW"),
    (20_000, 25_000, "20–25 GW"),
    (25_000, math.inf, "25+ GW"),
]

LEAD_BUCKETS: list[tuple[float, float, str]] = [
    (0, 6, "0–6h"),
    (6, 12, "6–12h"),
    (12, 24, "12–24h"),
    (24, 36, "24–36h"),
    (36, 48, "36–48h"),
    (48, 60, "48–60h"),
    (60, 72, "60–72h"),
    (72, 84, "72–84h"),
]

MIN_BUCKET_SAMPLES = 20


def quantile(values: Iterable[float], q: float) -> float:
    ordered = sorted(values)
    if not ordered:
        return 0.0
    position = (len(ordered) - 1) * q
    lower = int(math.floor(position))
    upper = min(lower + 1, len(ordered) - 1)
    fraction = position - lower
    return ordered[lower] * (1 - fraction) + ordered[upper] * fraction


def hourly_actuals(actuals: Iterable[Actual]) -> dict[datetime, float]:
    """Average complete pairs of half-hourly readings into hourly MW values.

    A half-hour with no matching pair is omitted rather than silently treating a
    single reading as a full-hour average. Missing coverage is surfaced by the
    decision-point count and coverage metric.
    """
    buckets: dict[datetime, list[float]] = defaultdict(list)
    for actual in actuals:
        buckets[floor_hour(actual.start_time)].append(actual.generation_mw)
    return {hour: mean(values) for hour, values in buckets.items() if len(values) >= 2}


def latest_forecasts(
    forecasts: Iterable[Forecast], gate_closure: datetime
) -> dict[datetime, Forecast]:
    """Pick the newest forecast vintage that was available at gate closure."""
    selected: dict[datetime, Forecast] = {}
    for forecast in forecasts:
        if forecast.publish_time > gate_closure:
            continue
        current = selected.get(forecast.start_time)
        if current is None or forecast.publish_time > current.publish_time:
            selected[forecast.start_time] = forecast
    return selected


def decision_points_for_day(
    delivery_day: date,
    actuals: Iterable[Actual],
    forecasts: Iterable[Forecast],
) -> list[DecisionPoint]:
    gate = gate_closure_for(delivery_day)
    actual_list = list(actuals)
    hourly = hourly_actuals(actual_list)
    availability: dict[datetime, list[datetime | None]] = defaultdict(list)
    for actual in actual_list:
        availability[floor_hour(actual.start_time)].append(actual.publish_time)
    latest = latest_forecasts(forecasts, gate)
    start = datetime.combine(delivery_day, time.min, tzinfo=UTC)
    points: list[DecisionPoint] = []
    for offset in range(24):
        start_time = start + timedelta(hours=offset)
        forecast = latest.get(start_time)
        actual = hourly.get(start_time)
        if forecast is None or actual is None:
            continue
        points.append(
            DecisionPoint(
                start_time=start_time,
                settlement_date=delivery_day,
                hour=offset,
                forecast_mw=forecast.generation_mw,
                actual_mw=actual,
                forecast_publish_time=forecast.publish_time,
                lead_time_hours=(start_time - forecast.publish_time).total_seconds()
                / 3600,
                actual_available_time=max(availability[start_time])
                if all(value is not None for value in availability[start_time])
                else None,
            )
        )
    return points


def decision_points_for_range(
    actuals: Iterable[Actual],
    forecasts: Iterable[Forecast],
    start_day: date,
    end_day: date,
) -> list[DecisionPoint]:
    actuals_by_day: dict[date, list[Actual]] = defaultdict(list)
    forecasts_by_day: dict[date, list[Forecast]] = defaultdict(list)
    for actual in actuals:
        actuals_by_day[actual.settlement_date].append(actual)
    for forecast in forecasts:
        forecasts_by_day[forecast.start_time.date()].append(forecast)
    points: list[DecisionPoint] = []
    for day in date_range(start_day, end_day):
        points.extend(
            decision_points_for_day(
                day,
                actuals_by_day.get(day, []),
                forecasts_by_day.get(day, []),
            )
        )
    return points


def _metrics(
    errors: list[float],
    actual_values: list[float],
    forecast_values: list[float],
    expected_points: int | None = None,
) -> dict[str, object]:
    n = len(errors)
    if n == 0:
        return {
            "n": 0,
            "expected_points": expected_points,
            "coverage_pct": 0.0,
            "mean_forecast_mw": 0.0,
            "mean_actual_mw": 0.0,
            "forecast_energy_gwh": 0.0,
            "actual_energy_gwh": 0.0,
            "mae_mw": 0.0,
            "rmse_mw": 0.0,
            "bias_mw": 0.0,
            "nmae_pct": 0.0,
            "p90_abs_error_mw": 0.0,
            "p90_shortfall_mw": 0.0,
            "within_1gw_pct": 0.0,
        }
    abs_errors = [abs(error) for error in errors]
    mae = mean(abs_errors)
    mean_actual = mean(actual_values)
    mean_forecast = mean(forecast_values)
    shortfalls = [max(0.0, error) for error in errors]
    return {
        "n": n,
        "expected_points": expected_points,
        "coverage_pct": round(
            (n / expected_points * 100) if expected_points else 100.0, 1
        ),
        "mean_forecast_mw": round(mean_forecast, 1),
        "mean_actual_mw": round(mean_actual, 1),
        "forecast_energy_gwh": round(sum(forecast_values) / 1_000, 2),
        "actual_energy_gwh": round(sum(actual_values) / 1_000, 2),
        "mae_mw": round(mae, 1),
        "rmse_mw": round(math.sqrt(mean(error**2 for error in errors)), 1),
        "bias_mw": round(mean(errors), 1),
        "nmae_pct": round((mae / mean_actual * 100) if mean_actual else 0.0, 1),
        "p90_abs_error_mw": round(quantile(abs_errors, 0.9), 1),
        "p90_shortfall_mw": round(quantile(shortfalls, 0.9), 1),
        "within_1gw_pct": round(
            mean(1.0 if error <= 1_000 else 0.0 for error in abs_errors) * 100, 1
        ),
    }


def compute_metrics(
    points: Iterable[DecisionPoint], expected_points: int | None = None
) -> dict[str, object]:
    point_list = list(points)
    return _metrics(
        [point.error_mw for point in point_list],
        [point.actual_mw for point in point_list],
        [point.forecast_mw for point in point_list],
        expected_points,
    )


def daily_metrics(points: Iterable[DecisionPoint]) -> list[dict[str, object]]:
    by_day: dict[date, list[DecisionPoint]] = defaultdict(list)
    for point in points:
        by_day[point.settlement_date].append(point)
    return [
        {"date": day.isoformat(), **compute_metrics(by_day[day], 24)}
        for day in sorted(by_day)
    ]


def by_hour(points: Iterable[DecisionPoint]) -> list[dict[str, object]]:
    buckets: dict[int, list[DecisionPoint]] = defaultdict(list)
    for point in points:
        buckets[point.hour].append(point)
    return [
        {
            "hour": hour,
            "label": f"{hour:02d}:00",
            **compute_metrics(buckets[hour]),
        }
        for hour in range(24)
        if buckets[hour]
    ]


def by_forecast_level(points: Iterable[DecisionPoint]) -> list[dict[str, object]]:
    point_list = list(points)
    result: list[dict[str, object]] = []
    for low, high, label in LEVEL_BUCKETS:
        selected = [point for point in point_list if low <= point.forecast_mw < high]
        if not selected:
            continue
        result.append(
            {
                "level": label,
                "low_mw": low if math.isfinite(low) else None,
                "high_mw": high if math.isfinite(high) else None,
                **compute_metrics(selected),
            }
        )
    return result


def by_lead_time(
    forecasts: Iterable[Forecast], actual_by_hour: dict[datetime, float]
) -> list[dict[str, object]]:
    """Accuracy by forecast horizon using every stored forecast vintage."""
    buckets: dict[str, list[tuple[float, float, float]]] = {
        label: [] for _, _, label in LEAD_BUCKETS
    }
    for forecast in forecasts:
        actual = actual_by_hour.get(forecast.start_time)
        if actual is None:
            continue
        lead = (forecast.start_time - forecast.publish_time).total_seconds() / 3600
        if lead <= 0 or lead > 84:
            continue
        for low, high, label in LEAD_BUCKETS:
            if low <= lead < high:
                error = forecast.generation_mw - actual
                buckets[label].append((error, actual, forecast.generation_mw))
                break
    return [
        {
            "lead_time": label,
            "low_hours": low,
            "high_hours": high if math.isfinite(high) else None,
            **_metrics(
                [item[0] for item in buckets[label]],
                [item[1] for item in buckets[label]],
                [item[2] for item in buckets[label]],
            ),
        }
        for low, high, label in LEAD_BUCKETS
        if buckets[label]
    ]


def error_quantiles_by_level(
    points: Iterable[DecisionPoint], exclude_date: date | None = None
) -> dict[str, object]:
    """P10/P90 signed error by forecast level.

    Used to draw an empirical uncertainty band. When exclude_date is supplied,
    that day's errors are left out so the band for a decision view is not fitted
    on the same day being displayed.
    """
    point_list = [
        point
        for point in points
        if exclude_date is None or point.settlement_date != exclude_date
    ]
    global_errors = [point.error_mw for point in point_list]
    global_q10 = quantile(global_errors, 0.1)
    global_q90 = quantile(global_errors, 0.9)
    levels: dict[str, dict[str, object]] = {}
    for low, high, label in LEVEL_BUCKETS:
        errors = [
            point.error_mw for point in point_list if low <= point.forecast_mw < high
        ]
        fallback = len(errors) < MIN_BUCKET_SAMPLES
        levels[label] = {
            "n": len(errors),
            "q10_mw": round(quantile(errors, 0.1) if not fallback else global_q10, 1),
            "q90_mw": round(quantile(errors, 0.9) if not fallback else global_q90, 1),
            "fallback": fallback,
        }
    return {
        "method": "Leave-one-day-out P10/P90 signed error by forecast level",
        "global": {
            "n": len(global_errors),
            "q10_mw": round(global_q10, 1),
            "q90_mw": round(global_q90, 1),
        },
        "levels": levels,
    }


def _level_for_forecast(forecast_mw: float) -> str:
    if forecast_mw < LEVEL_BUCKETS[0][0]:
        return LEVEL_BUCKETS[0][2]
    for low, high, label in LEVEL_BUCKETS:
        if low <= forecast_mw < high:
            return label
    return LEVEL_BUCKETS[-1][2]


def band_for_forecast(
    forecast_mw: float, quantiles: dict[str, object]
) -> dict[str, float | str | bool]:
    levels = quantiles["levels"]
    label = _level_for_forecast(forecast_mw)
    bucket = levels.get(label, {})
    q10 = float(bucket.get("q10_mw", 0.0))
    q90 = float(bucket.get("q90_mw", 0.0))
    return {
        "level": label,
        "q10_mw": q10,
        "q90_mw": q90,
        "lower_mw": round(max(0.0, forecast_mw - q90), 1),
        "upper_mw": round(max(0.0, forecast_mw - q10), 1),
        "shortfall_buffer_mw": round(max(0.0, q90), 1),
        "fallback": bool(bucket.get("fallback", True)),
    }


def histogram(
    points: Iterable[DecisionPoint], bin_width: float = 1_000
) -> list[dict[str, object]]:
    errors = [point.error_mw for point in points]
    if not errors:
        return []
    low = math.floor(min(errors) / bin_width) * bin_width
    high = math.ceil(max(errors) / bin_width) * bin_width
    if high == low:
        high = low + bin_width
    bins: dict[float, int] = {
        low + index * bin_width: 0 for index in range(int((high - low) / bin_width))
    }
    for error in errors:
        index = min(int((error - low) // bin_width), len(bins) - 1)
        bin_start = low + index * bin_width
        bins[bin_start] += 1
    return [
        {
            "bin_start_mw": bin_start,
            "bin_end_mw": bin_start + bin_width,
            "label": f"{bin_start / 1_000:g} to {(bin_start + bin_width) / 1_000:g} GW",
            "count": count,
        }
        for bin_start, count in bins.items()
    ]


def scatter_points(points: Iterable[DecisionPoint]) -> list[dict[str, object]]:
    return [
        {
            "forecast_mw": round(point.forecast_mw, 1),
            "actual_mw": round(point.actual_mw, 1),
            "date": point.settlement_date.isoformat(),
            "hour": point.hour,
        }
        for point in points
    ]


def worst_periods(
    points: Iterable[DecisionPoint], limit: int = 12
) -> list[dict[str, object]]:
    ordered = sorted(points, key=lambda point: abs(point.error_mw), reverse=True)
    return [
        {
            "date": point.settlement_date.isoformat(),
            "start_time": iso_utc(point.start_time),
            "hour": point.hour,
            "forecast_mw": round(point.forecast_mw, 1),
            "actual_mw": round(point.actual_mw, 1),
            "error_mw": round(point.error_mw, 1),
            "abs_error_mw": round(abs(point.error_mw), 1),
            "forecast_publish_time": iso_utc(point.forecast_publish_time),
            "lead_time_hours": round(point.lead_time_hours, 1),
        }
        for point in ordered[:limit]
    ]


def decision_view(store: Store, day: date, all_points: Iterable[DecisionPoint]) -> dict:
    gate = gate_closure_for(day)
    actuals = store.actuals_for_date(day)
    forecasts = store.forecasts_for_date(day, publish_to=gate)
    points = decision_points_for_day(day, actuals, forecasts)
    history = [
        point
        for point in all_points
        if point.start_time + timedelta(hours=1) <= gate
        and point.actual_available_time is not None
        and point.actual_available_time <= gate
        and point.forecast_publish_time <= gate
    ]
    quantiles = error_quantiles_by_level(history)
    quantiles["method"] = "P10/P90 signed error available before this buying cut-off"
    history_ready = len(history) >= MIN_BUCKET_SAMPLES
    latest = latest_forecasts(forecasts, gate)

    actual_by_start = {actual.start_time: actual for actual in actuals}
    start = datetime.combine(day, time.min, tzinfo=UTC)
    periods: list[dict[str, object]] = []
    for index in range(48):
        start_time = start + timedelta(minutes=30 * index)
        hour_start = floor_hour(start_time)
        forecast = latest.get(hour_start)
        actual = actual_by_start.get(start_time)
        if forecast is not None:
            band = band_for_forecast(forecast.generation_mw, quantiles)
            error = (
                round(forecast.generation_mw - actual.generation_mw, 1)
                if actual is not None
                else None
            )
            periods.append(
                {
                    "start_time": iso_utc(start_time),
                    "settlement_period": index + 1,
                    "forecast_mw": round(forecast.generation_mw, 1),
                    "actual_mw": round(actual.generation_mw, 1)
                    if actual is not None
                    else None,
                    "error_mw": error,
                    "abs_error_mw": round(abs(error), 1) if error is not None else None,
                    "forecast_publish_time": iso_utc(forecast.publish_time),
                    "lead_time_hours": round(
                        (start_time - forecast.publish_time).total_seconds() / 3600, 1
                    ),
                    "lower_mw": band["lower_mw"] if history_ready else None,
                    "upper_mw": band["upper_mw"] if history_ready else None,
                    "shortfall_buffer_mw": band["shortfall_buffer_mw"]
                    if history_ready
                    else None,
                    "uncertainty_level": band["level"],
                }
            )
        else:
            periods.append(
                {
                    "start_time": iso_utc(start_time),
                    "settlement_period": index + 1,
                    "forecast_mw": None,
                    "actual_mw": round(actual.generation_mw, 1)
                    if actual is not None
                    else None,
                    "error_mw": None,
                    "abs_error_mw": None,
                    "forecast_publish_time": None,
                    "lead_time_hours": None,
                    "lower_mw": None,
                    "upper_mw": None,
                    "shortfall_buffer_mw": None,
                    "uncertainty_level": None,
                }
            )

    summary = compute_metrics(points, expected_points=24)
    latest_publish = max((f.publish_time for f in latest.values()), default=None)
    lead_hours = [
        (f.start_time - f.publish_time).total_seconds() / 3600 for f in latest.values()
    ]
    return {
        "date": day.isoformat(),
        "gate_closure": iso_utc(gate),
        "purchase_date": (day - timedelta(days=1)).isoformat(),
        "gate_closure_label": GATE_CLOSURE_LABEL,
        "forecast_summary": {
            "hours": len(latest),
            "energy_gwh": round(
                sum(f.generation_mw for f in latest.values()) / 1000, 2
            ),
            "mean_mw": round(mean(f.generation_mw for f in latest.values()), 1)
            if latest
            else None,
        },
        "history": {
            "ready": history_ready,
            "minimum_points": MIN_BUCKET_SAMPLES,
            "points": len(history),
            "metrics": compute_metrics(history) if history_ready else None,
            "from": min(
                (p.start_time.date().isoformat() for p in history), default=None
            ),
            "to": max((p.start_time.date().isoformat() for p in history), default=None),
        },
        "latest_publish_time": iso_utc(latest_publish)
        if latest_publish is not None
        else None,
        "vintage": {
            "publish_time": iso_utc(latest_publish)
            if latest_publish is not None
            else None,
            "lead_time_hours": round(mean(lead_hours), 1) if lead_hours else None,
            "lead_time_min_hours": round(min(lead_hours), 1) if lead_hours else None,
            "lead_time_max_hours": round(max(lead_hours), 1) if lead_hours else None,
            "forecast_hours": len(latest),
        },
        "summary": summary,
        "uncertainty": quantiles,
        "periods": periods,
        "data_quality": {
            "actual_periods": len(actuals),
            "forecast_hours": len(latest),
            "decision_points": len(points),
            "missing_periods": sum(
                1 for period in periods if period["forecast_mw"] is None
            ),
        },
        "notes": [
            "The decision cut-off is 09:50 UK time on the day before delivery (N2EX). "
            "The latest WINDFOR vintage published before that cut-off is used.",
            "WINDFOR is hourly. Half-hourly rows repeat the hourly forecast value; "
            "summary metrics are computed on hourly decision points.",
            "The band uses only earlier hourly errors whose actual publication "
            "time is at or before this cut-off. A minimum of 20 points is required. "
            "It is a small-sample historical range, not a calibrated probability.",
            "Positive error means the forecast over-predicted wind. The shortfall "
            "buffer is the P90 over-forecast: a reserve for covering wind coming in "
            "below the forecast.",
        ],
    }


def accuracy_view(store: Store, start_day: date, end_day: date) -> dict:
    start, _ = day_bounds(start_day)
    _, end = day_bounds(end_day)
    actuals = store.actuals_between(start, end)
    forecasts = store.forecasts_between(start, end)
    points = decision_points_for_range(actuals, forecasts, start_day, end_day)
    expected_points = ((end_day - start_day).days + 1) * 24
    summary = compute_metrics(points, expected_points=expected_points)
    hourly = hourly_actuals(actuals)
    lead_time = by_lead_time(forecasts, hourly)
    vintage_count = sum(
        item["n"] for item in lead_time if isinstance(item.get("n"), int)
    )
    scatter = scatter_points(points)
    max_axis = max(
        [point["forecast_mw"] for point in scatter]
        + [point["actual_mw"] for point in scatter]
        + [1_000]
    )
    return {
        "range": {
            "from": start_day.isoformat(),
            "to": end_day.isoformat(),
        },
        "summary": {
            **summary,
            "decision_points": len(points),
            "vintage_points": vintage_count,
        },
        "daily": daily_metrics(points),
        "by_hour": by_hour(points),
        "by_lead_time": lead_time,
        "by_level": by_forecast_level(points),
        "distribution": histogram(points),
        "scatter": scatter,
        "max_axis_mw": round(max_axis, 1),
        "worst": worst_periods(points),
        "uncertainty": error_quantiles_by_level(points),
        "notes": [
            "Summary and distribution use the latest forecast vintage available "
            "at gate closure for each delivery hour.",
            "The lead-time view uses every stored forecast vintage, so it shows "
            "how accuracy changes with horizon. It is not the decision-time view.",
            "Errors are forecast minus actual. Positive means over-forecast.",
            "January 2026 purchase decisions, for delivery 2 January–1 February. "
            "Actuals: Elexon FUELHH (30 min). "
            "Forecasts: Elexon WINDFOR (hourly).",
        ],
    }
