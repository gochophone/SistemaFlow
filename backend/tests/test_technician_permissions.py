"""Technicians see only assigned work and cannot change prices or finished orders."""

import asyncio
import os
import sys
from pathlib import Path
from types import SimpleNamespace

import pytest
from fastapi import HTTPException

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
os.environ.setdefault("MONGO_URL", "mongodb://127.0.0.1:18770")
os.environ.setdefault("DB_NAME", "sf_technician_test")
os.environ.setdefault("JWT_SECRET", "technician-test-secret-not-for-production-123456789")
import server


TENANT = "tenant-1"
TECH = {"id": "tech-1", "tenant_id": TENANT, "name": "Alex", "role": "technician"}
OTHER = {"id": "tech-2", "tenant_id": TENANT, "name": "Berta", "role": "technician"}


def test_new_repair_starts_in_repair_and_legacy_states_cannot_be_selected():
    repair = server.Repair(
        tenant_id=TENANT, ticket_number="REP-NEW", customer_id="customer-1",
        customer_name="Cliente", device_brand="Apple", device_model="iPhone",
        reported_issue="Pantalla",
    )
    assert repair.status == "in_repair"
    for status in ("received", "diagnosis"):
        with pytest.raises(ValueError):
            server.RepairUpdate(status=status)


class Users:
    async def count_documents(self, query):
        return 1 if query.get("name") == "Alex" else 0

    async def find_one(self, query, projection=None):
        if query.get("id") == "tech-1" and query.get("tenant_id") == TENANT:
            return {"id": "tech-1", "name": "Alex"}
        return None


class Repairs:
    def __init__(self):
        self.doc = {
            "id": "repair-1", "tenant_id": TENANT, "ticket_number": "REP-00001",
            "customer_id": "customer-1", "customer_name": "Cliente",
            "device_brand": "Apple", "device_model": "iPhone", "reported_issue": "Pantalla",
            "assigned_technician": "Alex", "assigned_technician_id": "tech-1",
            "budget_estimate": 10000, "status": "in_repair", "device_photos": [],
        }
        self.query = None

    async def find_one(self, query, projection=None):
        return dict(self.doc) if query.get("id") == "repair-1" and query.get("tenant_id") == TENANT else None

    def find(self, query, projection=None):
        self.query = query
        return self

    def sort(self, *args):
        return self

    async def to_list(self, length):
        return [dict(self.doc)]

    async def update_one(self, query, change):
        if query.get("status", {}).get("$nin") and self.doc["status"] in query["status"]["$nin"]:
            return SimpleNamespace(matched_count=0)
        self.doc.update(change["$set"])
        return SimpleNamespace(matched_count=1)


class Customers:
    async def find_one(self, *args, **kwargs):
        return None


@pytest.fixture
def store(monkeypatch):
    repairs = Repairs()

    async def database(_tenant_id):
        return SimpleNamespace(repairs=repairs, customers=Customers())

    monkeypatch.setattr(server, "tenant_database", database)
    monkeypatch.setattr(server, "control_db", SimpleNamespace(users=Users()))
    return repairs


def test_assignment_uses_account_member_id_and_rejects_other_member(store):
    assert asyncio.run(server.resolve_repair_technician(TENANT, "tech-1", None))["name"] == "Alex"
    assert asyncio.run(server.can_access_repair(TECH, store.doc))
    assert not asyncio.run(server.can_access_repair(OTHER, store.doc))
    with pytest.raises(HTTPException) as error:
        asyncio.run(server.get_repair("repair-1", OTHER))
    assert error.value.status_code == 404


def test_work_and_history_are_filtered_by_technician_and_state(store):
    asyncio.run(server.get_repairs(scope="work", current_user=TECH))
    assert store.query["tenant_id"] == TENANT
    assert store.query["$or"][0] == {"assigned_technician_id": "tech-1"}
    assert "completed" in store.query["status"]["$nin"]
    asyncio.run(server.get_repairs(scope="history", current_user=TECH))
    assert "completed" in store.query["status"]["$in"]


def test_technician_can_edit_service_but_not_price_or_completed_order(store):
    changed = asyncio.run(server.update_repair(
        "repair-1", server.RepairUpdate(diagnosis="Cambio de pantalla"), TECH))
    assert changed.diagnosis == "Cambio de pantalla"
    assert changed.budget_estimate == 10000

    with pytest.raises(HTTPException) as error:
        asyncio.run(server.update_repair(
            "repair-1", server.RepairUpdate(budget_estimate=1), TECH))
    assert error.value.status_code == 403
    assert store.doc["budget_estimate"] == 10000

    store.doc["status"] = "completed"
    with pytest.raises(HTTPException) as error:
        asyncio.run(server.update_repair(
            "repair-1", server.RepairUpdate(diagnosis="Otro cambio"), TECH))
    assert error.value.status_code == 409


def test_technician_can_complete_once_but_cannot_reopen_or_reassign(store):
    for changes in [
        {"assigned_technician_id": "tech-2"},
        {"budget_items": [{"issue": "Pantalla", "amount": 1}]},
        {"status": "delivered"},
    ]:
        with pytest.raises(HTTPException) as error:
            asyncio.run(server.update_repair("repair-1", server.RepairUpdate(**changes), TECH))
        assert error.value.status_code == 403

    # Customer fields are not part of the editable model and cannot be saved.
    asyncio.run(server.update_repair(
        "repair-1", server.RepairUpdate(customer_name="Otro cliente"), TECH))
    assert store.doc["customer_name"] == "Cliente"

    completed = asyncio.run(server.update_repair(
        "repair-1", server.RepairUpdate(status="completed"), TECH))
    assert completed.status == "completed"
    with pytest.raises(HTTPException) as error:
        asyncio.run(server.update_repair(
            "repair-1", server.RepairUpdate(status="in_repair"), TECH))
    assert error.value.status_code == 409
