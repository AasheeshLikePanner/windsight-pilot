from __future__ import annotations

import logging
import math
import time
from datetime import date, datetime, timedelta
from typing import Any

import httpx

from .config import (
    ACTUAL_DATASET,
    ELEXON_BASE_URL,
    FORECAST_DATASET,
    FORECAST_LOOKBACK_DAYS,
    FUEL_TYPE,
)
from .domain import Actual, Forecast
from .timeutils import day_bounds, gate_closure_for, iso_utc, parse_utc

logger = logging.getLogger(__name__)


class ElexonError(RuntimeError):
    """Raised when the Elexon API cannot be read or returns an invalid payload."""


def _as_float(value: Any) -> float | None:
    try:
        number = float(value)
        return number if math.isfinite(number) else None
    except (TypeError, ValueError):
        return None


class ElexonClient:
    """Thin adapter around the two Elexon BMRS datasets in scope.

    The rest of the app never sees HTTP, pagination, retries, or Elexon's
    field names. Callers get domain records.
    """

    def __init__(
        self,
        base_url: str = ELEXON_BASE_URL,
        *,
        timeout: float = 60.0,
        retries: int = 3,
        delay: float = 0.15,
    ) -> None:
        self.base_url = base_url.rstrip("/")
        self.retries = retries
        self.delay = delay
        self._client = httpx.Client(
            base_url=self.base_url,
            timeout=timeout,
            follow_redirects=True,
            headers={
                "User-Agent": "WindSight/1.0 (day-ahead wind forecast pilot)",
                "Accept": "application/json",
            },
        )

    def close(self) -> None:
        self._client.close()

    def __enter__(self) -> ElexonClient:
        return self

    def __exit__(self, *_: object) -> None:
        self.close()

    def _get(self, path: str, params: dict[str, str]) -> list[dict[str, Any]]:
        last_error: Exception | None = None
        for attempt in range(self.retries + 1):
            try:
                response = self._client.get(path, params=params)
                response.raise_for_status()
                payload = response.json()
                if not isinstance(payload, dict):
                    raise ElexonError(f"Unexpected payload from {path}: not an object")
                data = payload.get("data")
                if not isinstance(data, list):
                    raise ElexonError(
                        f"Unexpected payload from {path}: missing data array"
                    )
                return data
            except (httpx.HTTPError, ValueError, ElexonError) as exc:
                last_error = exc
                if attempt >= self.retries:
                    break
                wait = 1.5**attempt
                logger.warning(
                    "Elexon request failed (%s %s), retrying in %.1fs: %s",
                    path,
                    params,
                    wait,
                    exc,
                )
                time.sleep(wait)
        raise ElexonError(
            f"Elexon request failed after {self.retries + 1} attempts: {path} {params}"
        ) from last_error

    def actual_wind(self, day: date) -> list[Actual]:
        """Fetch half-hourly national wind actuals for one settlement day."""
        rows = self._get(
            f"/datasets/{ACTUAL_DATASET}",
            {
                "settlementDateFrom": day.isoformat(),
                "settlementDateTo": day.isoformat(),
                "fuelType": FUEL_TYPE,
            },
        )
        by_start: dict[datetime, Actual] = {}
        for row in rows:
            if row.get("fuelType") != FUEL_TYPE:
                continue
            generation = _as_float(row.get("generation"))
            if generation is None:
                logger.warning("Skipping actual with invalid generation: %s", row)
                continue
            try:
                start = parse_utc(row["startTime"])
                settlement_date = date.fromisoformat(row["settlementDate"])
                settlement_period = int(row["settlementPeriod"])
            except (KeyError, TypeError, ValueError) as exc:
                logger.warning("Skipping malformed actual (%s): %s", exc, row)
                continue
            if settlement_date != day or not (1 <= settlement_period <= 48):
                continue
            try:
                publish = (
                    parse_utc(row["publishTime"]) if row.get("publishTime") else None
                )
            except ValueError as exc:
                logger.warning(
                    "Ignoring invalid actual publish time (%s): %s", exc, row
                )
                publish = None
            candidate = Actual(
                start_time=start,
                settlement_date=settlement_date,
                settlement_period=settlement_period,
                generation_mw=generation,
                publish_time=publish,
            )
            previous = by_start.get(start)
            if previous is None or (
                candidate.publish_time is not None
                and (
                    previous.publish_time is None
                    or candidate.publish_time > previous.publish_time
                )
            ):
                by_start[start] = candidate
        result = sorted(by_start.values(), key=lambda item: item.start_time)
        logger.info("Fetched %d wind actuals for %s", len(result), day)
        return result

    def wind_forecasts(self, delivery_day: date) -> list[Forecast]:
        """Fetch all forecast vintages for one delivery day up to gate closure.

        WINDFOR returns an hourly forecast horizon for each publish. We keep the
        rows whose delivery hour falls inside the requested day and whose
        publish time is at or before the day-ahead gate closure.
        """
        start, end = day_bounds(delivery_day)
        publish_from = start - timedelta(days=FORECAST_LOOKBACK_DAYS)
        publish_to = gate_closure_for(delivery_day)
        rows = self._get(
            f"/datasets/{FORECAST_DATASET}",
            {
                "from": iso_utc(start),
                "to": iso_utc(end),
                "publishDateTimeFrom": iso_utc(publish_from),
                "publishDateTimeTo": iso_utc(publish_to),
            },
        )
        by_key: dict[tuple[datetime, datetime], Forecast] = {}
        for row in rows:
            generation = _as_float(row.get("generation"))
            if generation is None:
                logger.warning("Skipping forecast with invalid generation: %s", row)
                continue
            try:
                start_time = parse_utc(row["startTime"])
                publish_time = parse_utc(row["publishTime"])
            except (KeyError, TypeError, ValueError) as exc:
                logger.warning("Skipping malformed forecast (%s): %s", exc, row)
                continue
            if not (start <= start_time < end):
                continue
            if publish_time > publish_to:
                continue
            by_key[(start_time, publish_time)] = Forecast(
                start_time=start_time,
                publish_time=publish_time,
                generation_mw=generation,
            )
        result = sorted(
            by_key.values(), key=lambda item: (item.start_time, item.publish_time)
        )
        logger.info("Fetched %d wind forecast rows for %s", len(result), delivery_day)
        return result
