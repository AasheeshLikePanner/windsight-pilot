from __future__ import annotations

import argparse
import json
import logging
import sys
from datetime import UTC, date, datetime
from pathlib import Path

from .config import (
    ACTUAL_DATASET,
    DATA_DIR,
    DATA_END,
    DATA_START,
    DB_PATH,
    FORECAST_DATASET,
    GATE_CLOSURE_LABEL,
    SOURCE_ACTUALS,
    SOURCE_FORECASTS,
)
from .elexon import ElexonClient, ElexonError
from .store import Store
from .timeutils import date_range, iso_utc

logger = logging.getLogger(__name__)


def _unlink_db(path: Path) -> None:
    for suffix in ("", "-wal", "-shm"):
        candidate = Path(f"{path}{suffix}")
        if candidate.exists():
            candidate.unlink()


def run_ingest(
    start: date,
    end: date,
    db_path: Path,
    *,
    rebuild: bool = False,
    strict: bool = False,
) -> dict:
    if rebuild:
        _unlink_db(db_path)
    days = date_range(start, end)
    store = Store(db_path)
    run_id = store.start_ingest_run()
    client = ElexonClient()
    actual_rows = 0
    forecast_rows = 0
    errors: list[dict[str, str]] = []

    try:
        for index, day in enumerate(days, start=1):
            try:
                actuals = client.actual_wind(day)
                forecasts = client.wind_forecasts(day)
                actual_rows += store.upsert_actuals(actuals)
                forecast_rows += store.upsert_forecasts(forecasts)
                publish_times = sorted({item.publish_time for item in forecasts})
                latest = iso_utc(publish_times[-1]) if publish_times else "none"
                logger.info(
                    "[%d/%d] %s actuals=%d forecast_rows=%d latest_publish=%s",
                    index,
                    len(days),
                    day,
                    len(actuals),
                    len(forecasts),
                    latest,
                )
            except ElexonError as exc:
                logger.error("[%d/%d] %s failed: %s", index, len(days), day, exc)
                errors.append({"date": day.isoformat(), "error": str(exc)})
                if strict:
                    break
    finally:
        client.close()

    status = "ok" if not errors else ("partial" if actual_rows else "failed")
    notes = json.dumps(errors[:20]) if errors else None
    store.finish_ingest_run(
        run_id,
        actual_count=actual_rows,
        forecast_count=forecast_rows,
        status=status,
        notes=notes,
    )
    counts = store.counts()
    last_run = store.last_run()
    store.close()
    repo_root = Path(__file__).resolve().parents[2]
    try:
        display_db = str(db_path.resolve().relative_to(repo_root))
    except ValueError:
        display_db = str(db_path)

    summary = {
        "generated_at": datetime.now(UTC).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "start": start.isoformat(),
        "end": end.isoformat(),
        "days": len(days),
        "actual_rows": actual_rows,
        "forecast_rows": forecast_rows,
        "db": display_db,
        "db_size_mb": counts["db_size_mb"],
        "status": status,
        "errors": errors,
        "gate_closure_rule": GATE_CLOSURE_LABEL,
        "datasets": {
            "actuals": ACTUAL_DATASET,
            "forecasts": FORECAST_DATASET,
            "sources": [SOURCE_ACTUALS, SOURCE_FORECASTS],
        },
        "last_run": last_run,
    }
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    summary_path = DATA_DIR / "ingest-summary.json"
    summary_path.write_text(json.dumps(summary, indent=2) + "\n", encoding="utf-8")
    logger.info("Wrote %s", summary_path)
    return summary


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        description="Fetch Elexon wind actuals and forecasts into the WindSight cache."
    )
    parser.add_argument("--start", default=DATA_START, help="YYYY-MM-DD")
    parser.add_argument("--end", default=DATA_END, help="YYYY-MM-DD")
    parser.add_argument(
        "--db",
        default=str(DB_PATH),
        help="SQLite database path (default: backend/data/windsight.db)",
    )
    parser.add_argument(
        "--rebuild", action="store_true", help="Delete the existing cache first"
    )
    parser.add_argument(
        "--strict", action="store_true", help="Stop on the first failed day"
    )
    args = parser.parse_args(argv)
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s %(levelname)s %(message)s",
        datefmt="%H:%M:%S",
    )
    summary = run_ingest(
        date.fromisoformat(args.start),
        date.fromisoformat(args.end),
        Path(args.db),
        rebuild=args.rebuild,
        strict=args.strict,
    )
    print(
        json.dumps(
            {
                k: summary[k]
                for k in (
                    "status",
                    "actual_rows",
                    "forecast_rows",
                    "db",
                    "db_size_mb",
                    "errors",
                )
            },
            indent=2,
        )
    )
    return 0 if summary["status"] == "ok" else 1


if __name__ == "__main__":
    sys.exit(main())
