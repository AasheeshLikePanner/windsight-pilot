from __future__ import annotations

import sqlite3
from datetime import UTC, date, datetime
from pathlib import Path

from .domain import Actual, Forecast
from .timeutils import day_bounds, iso_utc, parse_utc

SCHEMA = """
CREATE TABLE IF NOT EXISTS actuals (
    start_time TEXT PRIMARY KEY,
    settlement_date TEXT NOT NULL,
    settlement_period INTEGER NOT NULL,
    generation_mw REAL NOT NULL,
    publish_time TEXT
);

CREATE TABLE IF NOT EXISTS forecasts (
    start_time TEXT NOT NULL,
    publish_time TEXT NOT NULL,
    generation_mw REAL NOT NULL,
    PRIMARY KEY (start_time, publish_time)
);

CREATE INDEX IF NOT EXISTS idx_actuals_date ON actuals(settlement_date);
CREATE INDEX IF NOT EXISTS idx_forecasts_start ON forecasts(start_time);

CREATE TABLE IF NOT EXISTS ingest_runs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    started_at TEXT NOT NULL,
    completed_at TEXT,
    actual_count INTEGER NOT NULL DEFAULT 0,
    forecast_count INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'running',
    notes TEXT
);
"""


class Store:
    """SQLite-backed cache for the two Elexon datasets.

    The interface is deliberately small: upsert domain records, read domain
    records, report counts. SQL stays inside this module.
    """

    def __init__(self, path: Path | str) -> None:
        self.path = Path(path)
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self.conn = sqlite3.connect(self.path, check_same_thread=False)
        self.conn.row_factory = sqlite3.Row
        self.conn.execute("PRAGMA busy_timeout = 5000")
        self.conn.executescript(SCHEMA)
        self.conn.commit()

    def close(self) -> None:
        self.conn.close()

    def __enter__(self) -> Store:
        return self

    def __exit__(self, *_: object) -> None:
        self.close()

    def upsert_actuals(self, rows: list[Actual]) -> int:
        if not rows:
            return 0
        self.conn.executemany(
            """
            INSERT INTO actuals (
                start_time,
                settlement_date,
                settlement_period,
                generation_mw,
                publish_time
            )
            VALUES (?, ?, ?, ?, ?)
            ON CONFLICT(start_time) DO UPDATE SET
                settlement_date = excluded.settlement_date,
                settlement_period = excluded.settlement_period,
                generation_mw = excluded.generation_mw,
                publish_time = excluded.publish_time
            """,
            [
                (
                    iso_utc(row.start_time),
                    row.settlement_date.isoformat(),
                    row.settlement_period,
                    row.generation_mw,
                    iso_utc(row.publish_time) if row.publish_time else None,
                )
                for row in rows
            ],
        )
        self.conn.commit()
        return len(rows)

    def upsert_forecasts(self, rows: list[Forecast]) -> int:
        if not rows:
            return 0
        self.conn.executemany(
            """
            INSERT INTO forecasts (start_time, publish_time, generation_mw)
            VALUES (?, ?, ?)
            ON CONFLICT(start_time, publish_time) DO UPDATE SET
                generation_mw = excluded.generation_mw
            """,
            [
                (iso_utc(row.start_time), iso_utc(row.publish_time), row.generation_mw)
                for row in rows
            ],
        )
        self.conn.commit()
        return len(rows)

    def actuals_for_date(self, day: date) -> list[Actual]:
        start, end = day_bounds(day)
        return self.actuals_between(start, end)

    def actuals_between(self, start: datetime, end: datetime) -> list[Actual]:
        rows = self.conn.execute(
            """
            SELECT
                start_time,
                settlement_date,
                settlement_period,
                generation_mw,
                publish_time
            FROM actuals
            WHERE start_time >= ? AND start_time < ?
            ORDER BY start_time
            """,
            (iso_utc(start), iso_utc(end)),
        ).fetchall()
        return [
            Actual(
                start_time=parse_utc(row["start_time"]),
                settlement_date=date.fromisoformat(row["settlement_date"]),
                settlement_period=row["settlement_period"],
                generation_mw=row["generation_mw"],
                publish_time=parse_utc(row["publish_time"])
                if row["publish_time"]
                else None,
            )
            for row in rows
        ]

    def forecasts_for_date(
        self, day: date, publish_to: datetime | None = None
    ) -> list[Forecast]:
        start, end = day_bounds(day)
        return self.forecasts_between(start, end, publish_to=publish_to)

    def forecasts_between(
        self,
        start: datetime,
        end: datetime,
        publish_to: datetime | None = None,
    ) -> list[Forecast]:
        sql = """
            SELECT start_time, publish_time, generation_mw
            FROM forecasts
            WHERE start_time >= ? AND start_time < ?
        """
        params: list[str] = [iso_utc(start), iso_utc(end)]
        if publish_to is not None:
            sql += " AND publish_time <= ?"
            params.append(iso_utc(publish_to))
        sql += " ORDER BY start_time, publish_time"
        rows = self.conn.execute(sql, params).fetchall()
        return [
            Forecast(
                start_time=parse_utc(row["start_time"]),
                publish_time=parse_utc(row["publish_time"]),
                generation_mw=row["generation_mw"],
            )
            for row in rows
        ]

    def counts(self) -> dict[str, int | str | float]:
        actuals = self.conn.execute("SELECT COUNT(*) AS n FROM actuals").fetchone()["n"]
        forecasts = self.conn.execute("SELECT COUNT(*) AS n FROM forecasts").fetchone()[
            "n"
        ]
        decision_dates = self.conn.execute(
            "SELECT COUNT(DISTINCT settlement_date) AS n FROM actuals"
        ).fetchone()["n"]
        return {
            "actuals": actuals,
            "forecasts": forecasts,
            "delivery_dates": decision_dates,
            "db_size_mb": round(self.path.stat().st_size / (1024 * 1024), 2)
            if self.path.exists()
            else 0.0,
        }

    def date_coverage(self) -> list[dict[str, object]]:
        actual_rows = self.conn.execute(
            """
            SELECT settlement_date AS date, COUNT(*) AS n
            FROM actuals GROUP BY settlement_date
            """
        ).fetchall()
        forecast_rows = self.conn.execute(
            """
            SELECT substr(start_time, 1, 10) AS date,
                   COUNT(DISTINCT start_time) AS hours,
                   COUNT(*) AS n
            FROM forecasts GROUP BY 1
            """
        ).fetchall()
        actual_map = {row["date"]: row["n"] for row in actual_rows}
        forecast_map = {
            row["date"]: {"hours": row["hours"], "rows": row["n"]}
            for row in forecast_rows
        }
        dates = sorted(set(actual_map) | set(forecast_map))
        return [
            {
                "date": day,
                "actual_rows": actual_map.get(day, 0),
                "forecast_hours": forecast_map.get(day, {}).get("hours", 0),
                "forecast_rows": forecast_map.get(day, {}).get("rows", 0),
                "has_actuals": actual_map.get(day, 0) > 0,
                "has_forecasts": forecast_map.get(day, {}).get("hours", 0) > 0,
            }
            for day in dates
        ]

    def start_ingest_run(self) -> int:
        cursor = self.conn.execute(
            "INSERT INTO ingest_runs (started_at, status) VALUES (?, 'running')",
            (datetime.now(UTC).strftime("%Y-%m-%dT%H:%M:%SZ"),),
        )
        self.conn.commit()
        return int(cursor.lastrowid)

    def finish_ingest_run(
        self,
        run_id: int,
        *,
        actual_count: int,
        forecast_count: int,
        status: str,
        notes: str | None = None,
    ) -> None:
        self.conn.execute(
            """
            UPDATE ingest_runs
            SET completed_at = ?, actual_count = ?, forecast_count = ?,
                status = ?, notes = ?
            WHERE id = ?
            """,
            (
                datetime.now(UTC).strftime("%Y-%m-%dT%H:%M:%SZ"),
                actual_count,
                forecast_count,
                status,
                notes,
                run_id,
            ),
        )
        self.conn.commit()

    def last_run(self) -> dict[str, object] | None:
        row = self.conn.execute(
            "SELECT * FROM ingest_runs ORDER BY id DESC LIMIT 1"
        ).fetchone()
        return dict(row) if row else None
