from __future__ import annotations

from collections.abc import Iterator
from datetime import date
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query

from .analysis import accuracy_view, decision_points_for_range, decision_view
from .config import (
    ACTUAL_DATASET,
    DATA_END,
    DATA_START,
    DB_PATH,
    FORECAST_DATASET,
    GATE_CLOSURE_HOUR,
    SOURCE_ACTUALS,
    SOURCE_FORECASTS,
    TIMEZONE,
)
from .store import Store
from .timeutils import day_bounds

router = APIRouter(prefix="/api")


def get_store() -> Iterator[Store]:
    store = Store(DB_PATH)
    try:
        yield store
    finally:
        store.close()


StoreDep = Annotated[Store, Depends(get_store)]


def _parse_day(value: str, field: str) -> date:
    try:
        return date.fromisoformat(value)
    except ValueError as exc:
        raise HTTPException(
            status_code=400, detail=f"{field} must be YYYY-MM-DD"
        ) from exc


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
        "gate_closure": {
            "local_time": f"{GATE_CLOSURE_HOUR}:00",
            "timezone": TIMEZONE,
            "rule": "11:00 UK time on the day before delivery",
        },
        "resolution": {"actuals": "30 min", "forecasts": "60 min (hourly)"},
        "counts": counts,
        "last_ingest": store.last_run(),
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
            "The decision cut-off is 11:00 UK time on D-1 (day-ahead gate closure).",
            "WINDFOR is hourly; metrics use hourly decision points.",
        ],
    }


@router.get("/dates")
def dates(store: StoreDep) -> dict:
    coverage = store.date_coverage()
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
    start, _ = day_bounds(date.fromisoformat(DATA_START))
    _, end = day_bounds(date.fromisoformat(DATA_END))
    actuals = store.actuals_between(start, end)
    forecasts = store.forecasts_between(start, end)
    all_points = decision_points_for_range(
        actuals,
        forecasts,
        date.fromisoformat(DATA_START),
        date.fromisoformat(DATA_END),
    )
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
