from __future__ import annotations

from datetime import UTC, date, datetime, time, timedelta

from app.domain import Actual, Forecast
from app.timeutils import gate_closure_for


def actuals_for(day: date, base: float = 10_000.0, step: float = 100.0) -> list[Actual]:
    start = datetime.combine(day, time.min, tzinfo=UTC)
    return [
        Actual(
            start_time=start + timedelta(minutes=30 * index),
            settlement_date=day,
            settlement_period=index + 1,
            generation_mw=base + step * index,
            publish_time=start + timedelta(minutes=30 * (index + 1)),
        )
        for index in range(48)
    ]


def forecasts_for(
    day: date,
    base: float = 11_000.0,
    step: float = 100.0,
    publish_time: datetime | None = None,
) -> list[Forecast]:
    publish = publish_time or gate_closure_for(day) - timedelta(minutes=20)
    start = datetime.combine(day, time.min, tzinfo=UTC)
    return [
        Forecast(
            start_time=start + timedelta(hours=hour),
            publish_time=publish,
            generation_mw=base + step * hour,
        )
        for hour in range(24)
    ]


def seed_store(store, days: list[date]) -> None:
    for day in days:
        store.upsert_actuals(actuals_for(day))
        store.upsert_forecasts(forecasts_for(day))
