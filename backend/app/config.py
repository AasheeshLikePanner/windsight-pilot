from __future__ import annotations

import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = BASE_DIR / "data"
DB_PATH = Path(os.getenv("WINDSIGHT_DB", str(DATA_DIR / "windsight.db")))

ELEXON_BASE_URL = os.getenv("ELEXON_BASE_URL", "https://data.elexon.co.uk/bmrs/api/v1")

TIMEZONE = "Europe/London"
GATE_CLOSURE_HOUR = 11
FORECAST_LOOKBACK_DAYS = 3
FORECAST_DATASET = "WINDFOR"
ACTUAL_DATASET = "FUELHH"
FUEL_TYPE = "WIND"

DATA_START = "2026-01-01"
DATA_END = "2026-01-31"

SOURCE_ACTUALS = (
    "https://bmrs.elexon.co.uk/api-documentation/endpoint/datasets/FUELHH/stream"
)
SOURCE_FORECASTS = (
    "https://bmrs.elexon.co.uk/api-documentation/endpoint/datasets/WINDFOR/stream"
)
