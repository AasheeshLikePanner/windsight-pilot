from __future__ import annotations

from datetime import UTC, date, datetime, time, timedelta
from zoneinfo import ZoneInfo

from .config import GATE_CLOSURE_HOUR, TIMEZONE

LOCAL_TZ = ZoneInfo(TIMEZONE)
UTC = UTC


def parse_utc(value: str) -> datetime:
    """Parse an Elexon ISO timestamp into an aware UTC datetime."""
    parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    if parsed.tzinfo is None:
        raise ValueError(f"Timestamp is missing a timezone: {value!r}")
    return parsed.astimezone(UTC)


def iso_utc(value: datetime) -> str:
    return value.astimezone(UTC).strftime("%Y-%m-%dT%H:%M:%SZ")


def gate_closure_for(delivery_date: date) -> datetime:
    """Day-ahead gate closure: 11:00 UK time on the day before delivery.

    January is GMT, so this is 11:00 UTC for the pilot. Using the Europe/London
    zone keeps the rule correct if the window is ever extended into summer.
    """
    local = datetime.combine(
        delivery_date - timedelta(days=1),
        time(hour=GATE_CLOSURE_HOUR, tzinfo=LOCAL_TZ),
    )
    return local.astimezone(UTC)


def day_bounds(day: date) -> tuple[datetime, datetime]:
    start = datetime.combine(day, time.min, tzinfo=UTC)
    return start, start + timedelta(days=1)


def floor_hour(value: datetime) -> datetime:
    return value.astimezone(UTC).replace(minute=0, second=0, microsecond=0)


def date_range(start: date, end: date) -> list[date]:
    if end < start:
        raise ValueError("end date must be on or after start date")
    days = (end - start).days
    return [start + timedelta(days=offset) for offset in range(days + 1)]
