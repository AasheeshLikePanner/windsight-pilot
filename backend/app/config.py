from __future__ import annotations

import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = BASE_DIR / "data"
DB_PATH = Path(os.getenv("WINDSIGHT_DB", str(DATA_DIR / "windsight.db")))

ELEXON_BASE_URL = os.getenv("ELEXON_BASE_URL", "https://data.elexon.co.uk/bmrs/api/v1")

TIMEZONE = "Europe/London"
GATE_CLOSURE_HOUR = 9
GATE_CLOSURE_MINUTE = 50
GATE_CLOSURE_LABEL = "09:50 UK time on the day before delivery (N2EX)"
FORECAST_LOOKBACK_DAYS = 3
FORECAST_DATASET = "WINDFOR"
ACTUAL_DATASET = "FUELHH"
FUEL_TYPE = "WIND"

DECISION_START = "2026-01-01"
DECISION_END = "2026-01-31"
DATA_START = "2026-01-02"
DATA_END = "2026-02-01"

SOURCE_ACTUALS = (
    "https://bmrs.elexon.co.uk/api-documentation/endpoint/datasets/FUELHH/stream"
)
SOURCE_FORECASTS = (
    "https://bmrs.elexon.co.uk/api-documentation/endpoint/datasets/WINDFOR/stream"
)
