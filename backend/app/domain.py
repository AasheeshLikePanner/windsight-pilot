from __future__ import annotations

from dataclasses import dataclass
from datetime import date, datetime


@dataclass(frozen=True, slots=True)
class Actual:
    """A metered wind generation reading at half-hour resolution, in MW."""

    start_time: datetime
    settlement_date: date
    settlement_period: int
    generation_mw: float
    publish_time: datetime | None = None


@dataclass(frozen=True, slots=True)
class Forecast:
    """A wind generation forecast vintage, in MW, at hourly resolution."""

    start_time: datetime
    publish_time: datetime
    generation_mw: float


@dataclass(frozen=True, slots=True)
class DecisionPoint:
    """The latest forecast available at gate closure, paired with the actual.

    One point per delivery hour. This is the unit the accuracy metrics use.
    Positive error means the forecast over-predicted wind.
    """

    start_time: datetime
    settlement_date: date
    hour: int
    forecast_mw: float
    actual_mw: float
    forecast_publish_time: datetime
    lead_time_hours: float

    @property
    def error_mw(self) -> float:
        return self.forecast_mw - self.actual_mw
