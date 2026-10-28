from dataclasses import replace
from datetime import UTC, date, datetime, timedelta

import pytest

from app.analysis import decision_points_for_range, decision_view
from app.elexon import _as_float
from app.store import Store
from app.timeutils import gate_closure_for
from tests.factories import actuals_for, forecasts_for


def test_history_uses_only_actuals_published_by_buying_cutoff(tmp_path):
    days = [date(2026, 1, day) for day in (2, 3, 4, 5)]
    actuals = [row for day in days for row in actuals_for(day)]
    forecasts = [row for day in days for row in forecasts_for(day)]
    # A later revision must not enter the 4 January buying decision.
    actuals[0] = replace(actuals[0], publish_time=datetime(2026, 1, 10, tzinfo=UTC))
    points = decision_points_for_range(actuals, forecasts, days[0], days[-1])
    with Store(tmp_path / "history.db") as store:
        store.upsert_actuals(actuals)
        store.upsert_forecasts(forecasts)
        view = decision_view(store, date(2026, 1, 5), points)
        # 2 completed days minus the revised hour, plus 9 completed hours on D-1.
        assert view["history"]["points"] == 24 * 2 - 1 + 9
        assert view["history"]["ready"]
        baseline = view["uncertainty"]
        future = [
            replace(p, actual_mw=999_999)
            if p.start_time >= gate_closure_for(days[-1])
            else p
            for p in points
        ]
        assert decision_view(store, days[-1], future)["uncertainty"] == baseline


def test_first_day_has_forecast_without_fabricated_history_or_actuals(tmp_path):
    day = date(2026, 1, 2)
    with Store(tmp_path / "empty-history.db") as store:
        store.upsert_forecasts(forecasts_for(day))
        view = decision_view(store, day, [])
    assert view["purchase_date"] == "2026-01-01"
    assert view["forecast_summary"]["hours"] == 24
    assert view["forecast_summary"]["energy_gwh"] > 0
    assert view["summary"]["n"] == 0
    assert not view["history"]["ready"]
    assert view["history"]["metrics"] is None
    assert all(row["lower_mw"] is None for row in view["periods"])
    assert all(row["shortfall_buffer_mw"] is None for row in view["periods"])


def test_unknown_publication_times_are_not_used_as_historical_evidence(tmp_path):
    day = date(2026, 1, 2)
    actuals = [replace(a, publish_time=None) for a in actuals_for(day)]
    forecasts = forecasts_for(day)
    points = decision_points_for_range(actuals, forecasts, day, day)
    with Store(tmp_path / "unknown.db") as store:
        view = decision_view(store, day + timedelta(days=2), points)
    assert view["history"]["points"] == 0


def test_read_only_store_never_creates_or_changes_snapshot(tmp_path):
    path = tmp_path / "snapshot.db"
    with pytest.raises(Exception, match="unable to open database file"):
        Store(path, read_only=True)
    assert not path.exists()
    with Store(path) as store:
        store.upsert_actuals(actuals_for(date(2026, 1, 2)))
    before = path.read_bytes()
    with Store(path, read_only=True) as store:
        assert store.counts()["actuals"] == 48
    assert path.read_bytes() == before


@pytest.mark.parametrize("value", ["nan", "inf", "-inf", None, "not a number"])
def test_nonfinite_or_invalid_generation_is_rejected(value):
    assert _as_float(value) is None
