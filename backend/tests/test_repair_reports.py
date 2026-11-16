"""Monthly reports use Chile dates, tenant boundaries, and authorized technician filters."""

import asyncio
import os
import sys
from datetime import date
from pathlib import Path
from types import SimpleNamespace

import pytest
from fastapi import HTTPException
from fastapi.testclient import TestClient

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
os.environ.setdefault("MONGO_URL", "mongodb://127.0.0.1:18770")
os.environ.setdefault("DB_NAME", "sf_reports_test")
os.environ.setdefault("JWT_SECRET", "reports-test-secret-not-for-production-123456789")
import server
from repair_reports import build_repair_report


def fixture_repairs():
    return [
        {"id": "r1", "tenant_id": "t1", "ticket_number": "REP-1", "customer_name": "Ana",
         "device_brand": "Apple", "device_model": "iPhone 13", "status": "delivered",
         "assigned_technician_id": "tech-1", "assigned_technician": "Alex",
         "completed_date": "2026-11-02T12:00:00+00:00", "delivered_date": "2026-11-15T12:00:00+00:00",
         "paid": True, "paid_at": "2026-12-01T12:00:00+00:00", "budget_estimate": 20000,
         "budget_items": [{"issue": "Pantalla", "amount": 20000, "cost_price": 5000}]},
        {"id": "r2", "tenant_id": "t1", "ticket_number": "REP-2", "customer_name": "Bruno",
         "status": "not_repaired", "assigned_technician_id": "tech-2", "assigned_technician": "Berta",
         "updated_at": "2026-11-10T12:00:00+00:00", "budget_estimate": 0,
         "reported_issue": "No enciende"},
        {"id": "r3", "tenant_id": "t1", "ticket_number": "REP-3", "status": "in_repair",
         "updated_at": "2026-11-12T12:00:00+00:00", "budget_estimate": 50000},
        {"id": "r4", "tenant_id": "t1", "ticket_number": "REP-4", "status": "completed",
         "completed_date": "2026-11-01T02:30:00+00:00", "budget_estimate": 9000},
        {"id": "r5", "tenant_id": "t1", "ticket_number": "REP-5", "status": "delivered",
         "assigned_technician_id": "tech-1", "assigned_technician": "Alex",
         "completed_date": "2026-10-20T12:00:00+00:00", "delivered_date": "2026-11-05T12:00:00+00:00",
         "paid": True, "paid_at": "2026-11-07T12:00:00+00:00", "budget_estimate": 10000},
        {"id": "other", "tenant_id": "t2", "ticket_number": "REP-PRIVATE", "status": "completed",
         "completed_date": "2026-11-04T12:00:00+00:00", "budget_estimate": 999999},
    ]


def test_monthly_work_delivery_and_collections_are_separate_events():
    result = build_repair_report(fixture_repairs()[:-1], date(2026, 11, 1), date(2026, 11, 30))
    assert result["summary"] == {
        "finished": 2, "repaired": 1, "not_repaired": 1, "delivered": 2,
        "final_value": 20000, "recorded_cost": 5000, "paid_count": 1, "collected": 10000,
    }
    assert [row["ticket_number"] for row in result["rows"]] == ["REP-2", "REP-1"]
    assert result["daily"] == [{"date": "2026-11-02", "count": 1}, {"date": "2026-11-10", "count": 1}]
    assert result["by_issue"] == [{"name": "No enciende", "count": 1}, {"name": "Pantalla", "count": 1}]
    assert result["rows"][1]["work"] == "Pantalla"
    assert [(row["ticket_number"], row["paid_date"], row["value"]) for row in result["payment_rows"]] == [
        ("REP-5", "2026-11-07", 10000),
    ]
    assert sum(row["value"] for row in result["payment_rows"]) == result["summary"]["collected"]
    assert sum(row["value"] for row in result["rows"]) == result["summary"]["final_value"]


def test_technician_filter_includes_only_matching_work_and_payments():
    result = build_repair_report(fixture_repairs()[:-1], date(2026, 11, 1), date(2026, 11, 30),
                                 {"id": "tech-1", "name": "Alex", "match_legacy_name": True})
    assert result["summary"]["finished"] == 1
    assert result["summary"]["delivered"] == 2
    assert result["summary"]["collected"] == 10000
    assert [row["ticket_number"] for row in result["rows"]] == ["REP-1"]
    assert [row["ticket_number"] for row in result["payment_rows"]] == ["REP-5"]


def test_legacy_name_only_work_joins_the_matching_technician_group():
    repairs = fixture_repairs()[:-1]
    repairs.append({"id": "legacy", "status": "completed", "assigned_technician": "Alex",
                    "completed_date": "2026-11-03T12:00:00+00:00", "budget_estimate": 3000})
    result = build_repair_report(repairs, date(2026, 11, 1), date(2026, 11, 30))
    assert {item["id"]: item["finished"] for item in result["by_technician"]}["tech-1"] == 2
    assert len([item for item in result["by_technician"] if item["name"] == "Alex"]) == 1


class FakeRepairs:
    def __init__(self):
        self.query = None

    def find(self, query, projection):
        self.query = query
        documents = [item for item in fixture_repairs() if item["tenant_id"] == query["tenant_id"]]
        return SimpleNamespace(to_list=lambda length: async_result(documents))


async def async_result(value):
    return value


class FakeUsers:
    async def find_one(self, query, projection):
        if query == {"tenant_id": "t1", "id": "tech-1", "role": "technician"}:
            return {"id": "tech-1", "name": "Alex"}
        return None

    async def count_documents(self, query):
        return 1


@pytest.fixture
def reports_store(monkeypatch):
    repairs = FakeRepairs()

    async def database(tenant_id):
        assert tenant_id == "t1"
        return SimpleNamespace(repairs=repairs)

    monkeypatch.setattr(server, "tenant_database", database)
    monkeypatch.setattr(server, "control_db", SimpleNamespace(users=FakeUsers()))
    return repairs


def test_report_endpoint_is_tenant_scoped_and_validates_technician(reports_store):
    user = {"tenant_id": "t1", "role": "admin"}
    result = asyncio.run(server.get_repair_report(date(2026, 11, 1), date(2026, 11, 30),
                                                  technician_id="tech-1", current_user=user))
    assert reports_store.query == {"tenant_id": "t1"}
    assert [row["ticket_number"] for row in result["rows"]] == ["REP-1"]
    with pytest.raises(HTTPException) as error:
        asyncio.run(server.get_repair_report(date(2026, 11, 1), date(2026, 11, 30),
                                             technician_id="foreign", current_user=user))
    assert error.value.status_code == 404


def test_report_rejects_invalid_or_excessive_date_range(reports_store):
    for start, end in [(date(2026, 11, 30), date(2026, 11, 1)),
                       (date(2025, 1, 1), date(2026, 11, 30))]:
        with pytest.raises(HTTPException) as error:
            asyncio.run(server.get_repair_report(start, end, current_user={"tenant_id": "t1", "role": "admin"}))
        assert error.value.status_code == 422


def test_report_route_rejects_technicians_without_reading_private_amounts():
    server.app.dependency_overrides[server.get_current_user] = lambda: {"tenant_id": "t1", "role": "technician"}
    try:
        response = TestClient(server.app).get("/api/reports/repairs?start=2026-11-01&end=2026-11-30")
        assert response.status_code == 403
    finally:
        server.app.dependency_overrides.pop(server.get_current_user, None)


def test_report_http_route_returns_real_summary_for_admin(reports_store):
    server.app.dependency_overrides[server.get_current_user] = lambda: {"tenant_id": "t1", "role": "admin"}
    try:
        response = TestClient(server.app).get("/api/reports/repairs?start=2026-11-01&end=2026-11-30")
        assert response.status_code == 200
        assert response.json()["summary"]["finished"] == 2
        assert "REP-PRIVATE" not in [row["ticket_number"] for row in response.json()["rows"]]
        assert "REP-PRIVATE" not in [row["ticket_number"] for row in response.json()["payment_rows"]]
    finally:
        server.app.dependency_overrides.pop(server.get_current_user, None)
