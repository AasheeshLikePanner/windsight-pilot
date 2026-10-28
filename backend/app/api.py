from __future__ import annotations

from collections.abc import Iterator
from datetime import date
from functools import lru_cache
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query

from .analysis import accuracy_view, decision_points_for_range, decision_view
from .config import (
    ACTUAL_DATASET,
    DATA_END,
    DATA_START,
    DB_PATH,
    DECISION_END,
    DECISION_START,
    FORECAST_DATASET,
    GATE_CLOSURE_HOUR,
    GATE_CLOSURE_LABEL,
    GATE_CLOSURE_MINUTE,
    SOURCE_ACTUALS,
    SOURCE_FORECASTS,
    TIMEZONE,
)
from .domain import DecisionPoint
from .store import Store
from .timeutils import day_bounds

router = APIRouter(prefix="/api")

DATA_START_DAY = date.fromisoformat(DATA_START)
DATA_END_DAY = date.fromisoformat(DATA_END)


def _snapshot_version() -> int:
    try:
        return DB_PATH.stat().st_mtime_ns
    except OSError:
        return 0


@lru_cache(maxsize=4)
def _decision_points(db_path: str, db_version: int) -> tuple[DecisionPoint, ...]:
    """Load the month context once per snapshot version for decision bands."""
    store = Store(db_path, read_only=True)
    try:
        start, _ = day_bounds(DATA_START_DAY)
        _, end = day_bounds(DATA_END_DAY)
        return tuple(
            decision_points_for_range(
                store.actuals_between(start, end),
                store.forecasts_between(start, end),
                DATA_START_DAY,
                DATA_END_DAY,
            )
        )
    finally:
        store.close()


def get_store() -> Iterator[Store]:
    store = Store(DB_PATH, read_only=True)
    try:
        yield store
    finally:
        store.close()


StoreDep = Annotated[Store, Depends(get_store)]


def _parse_day(value: str, field: str) -> date:
    try:
        day = date.fromisoformat(value)
    except ValueError as exc:
        raise HTTPException(
            status_code=400, detail=f"{field} must be YYYY-MM-DD"
        ) from exc
    if day < DATA_START_DAY or day > DATA_END_DAY:
        raise HTTPException(
            status_code=400,
            detail=f"{field} must be between {DATA_START} and {DATA_END}",
        )
    return day


def _format_last_ingest(last: dict[str, object] | None) -> dict[str, object] | None:
    if last is None:
        return None
    return {
        "id": last["id"],
        "started_at": last["started_at"],
        "finished_at": last["completed_at"],
        "actual_count": last["actual_count"],
        "forecast_count": last["forecast_count"],
        "status": last["status"],
    }


@router.get("/health")
def health(store: StoreDep) -> dict:
    counts = store.counts()
    return {
        "status": "ok",
        "data_ready": counts["actuals"] > 0 and counts["forecasts"] > 0,
        "counts": counts,
    }


@router.get("/meta")
def meta(store: StoreDep) -> dict:
    counts = store.counts()
    return {
        "name": "WindSight",
        "subtitle": "Day-ahead wind forecast intelligence",
        "period": {"from": DATA_START, "to": DATA_END},
        "purchase_period": {"from": DECISION_START, "to": DECISION_END},
        "gate_closure": {
            "local_time": f"{GATE_CLOSURE_HOUR:02d}:{GATE_CLOSURE_MINUTE:02d}",
            "timezone": TIMEZONE,
            "rule": GATE_CLOSURE_LABEL,
        },
        "resolution": {"actuals": "30 min", "forecasts": "60 min (hourly)"},
        "counts": counts,
        "last_ingest": _format_last_ingest(store.last_run()),
        "data_ready": counts["actuals"] > 0 and counts["forecasts"] > 0,
        "sources": {
            "actuals": {
                "dataset": ACTUAL_DATASET,
                "description": (
                    "National wind generation actuals (FUELHH, fuelType=WIND)"
                ),
                "url": SOURCE_ACTUALS,
            },
            "forecasts": {
                "dataset": FORECAST_DATASET,
                "description": "National wind generation forecasts and publish times",
                "url": SOURCE_FORECASTS,
            },
        },
        "notes": [
            "Scope is national wind generation only, from Elexon BMRS.",
            "The decision cut-off is 09:50 UK time on D-1 (N2EX day-ahead auction).",
            "WINDFOR is hourly; metrics use hourly decision points.",
        ],
    }


@router.get("/dates")
def dates(store: StoreDep) -> dict:
    coverage = [
        row for row in store.date_coverage() if DATA_START <= row["date"] <= DATA_END
    ]
    return {
        "dates": coverage,
        "default": coverage[-1]["date"] if coverage else None,
    }


@router.get("/decision")
def decision(
    store: StoreDep,
    day: str = Query(default="", alias="date"),
) -> dict:
    selected = _parse_day(day or DATA_END, "date")
    all_points = _decision_points(str(DB_PATH), _snapshot_version())
    return decision_view(store, selected, all_points)


@router.get("/accuracy")
def accuracy(
    store: StoreDep,
    from_day: str = Query(default=DATA_START, alias="from"),
    to_day: str = Query(default=DATA_END, alias="to"),
) -> dict:
    start = _parse_day(from_day, "from")
    end = _parse_day(to_day, "to")
    if end < start:
        raise HTTPException(status_code=400, detail="to must be on or after from")
    return accuracy_view(store, start, end)
