from __future__ import annotations

from datetime import date

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.store import Store
from tests.factories import seed_store

DAYS = [date(2026, 1, 1), date(2026, 1, 2)]


@pytest.fixture
def client(tmp_path, monkeypatch):
    db_path = tmp_path / "api.db"
    store = Store(db_path)
    try:
        seed_store(store, DAYS)
    finally:
        store.close()
    monkeypatch.setattr("app.api.DB_PATH", db_path)
    with TestClient(app) as test_client:
        yield test_client


def test_health_and_meta(client: TestClient) -> None:
    health = client.get("/api/health")
    assert health.status_code == 200
    assert health.json()["data_ready"] is True
    assert health.json()["counts"]["actuals"] == 96

    meta = client.get("/api/meta")
    assert meta.status_code == 200
    body = meta.json()
    assert body["name"] == "WindSight"
    assert body["data_ready"] is True
    assert body["gate_closure"]["local_time"] == "11:00"
    assert body["counts"]["forecasts"] == 48


def test_dates_defaults_to_last_day(client: TestClient) -> None:
    response = client.get("/api/dates")
    assert response.status_code == 200
    body = response.json()
    assert [row["date"] for row in body["dates"]] == [
        "2026-01-01",
        "2026-01-02",
    ]
    assert body["default"] == "2026-01-02"


def test_decision_view_for_a_day(client: TestClient) -> None:
    response = client.get("/api/decision", params={"date": "2026-01-02"})
    assert response.status_code == 200
    body = response.json()
    assert body["date"] == "2026-01-02"
    assert body["summary"]["n"] == 24
    assert body["summary"]["coverage_pct"] == 100.0
    assert len(body["periods"]) == 48
    assert body["data_quality"]["actual_periods"] == 48
    assert body["data_quality"]["missing_periods"] == 0
    assert body["vintage"]["publish_time"] == "2026-01-01T09:30:00Z"
    assert body["vintage"]["forecast_hours"] == 24
    assert body["periods"][0]["forecast_mw"] == 11_000
    assert body["periods"][0]["actual_mw"] == 10_000
    assert body["periods"][1]["actual_mw"] == 10_100


def test_accuracy_view_for_range(client: TestClient) -> None:
    response = client.get(
        "/api/accuracy", params={"from": "2026-01-01", "to": "2026-01-02"}
    )
    assert response.status_code == 200
    body = response.json()
    assert body["range"] == {"from": "2026-01-01", "to": "2026-01-02"}
    assert body["summary"]["n"] == 48
    assert body["summary"]["coverage_pct"] == 100.0
    assert len(body["daily"]) == 2
    assert len(body["by_hour"]) == 24
    assert len(body["scatter"]) == 48
    assert len(body["worst"]) == 12
    assert body["distribution"]


def test_invalid_requests_are_rejected(client: TestClient) -> None:
    assert client.get("/api/decision", params={"date": "15-01-2026"}).status_code == 400
    assert (
        client.get(
            "/api/accuracy", params={"from": "2026-01-02", "to": "2026-01-01"}
        ).status_code
        == 400
    )
