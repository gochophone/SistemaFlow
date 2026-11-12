"""El presupuesto por fallas mantiene el total compatible con órdenes existentes."""

import asyncio
import importlib
import sys
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest
from pydantic import ValidationError

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import pdf_generator


@pytest.fixture
def server_module(monkeypatch):
    already_imported = "server" in sys.modules
    if not already_imported:
        monkeypatch.setenv("MONGO_URL", "mongodb://127.0.0.1:18770")
        monkeypatch.setenv("DB_NAME", "sf_budget_test")
    module = importlib.import_module("server")
    yield module
    if not already_imported:
        sys.modules.pop("server", None)


def repair_payload(**changes):
    return {
        "customer_id": "customer-1", "customer_name": "Ana",
        "device_brand": "Apple", "device_model": "iPhone 13",
        "reported_issue": "Pantalla", **changes,
    }


def test_create_repair_sums_priced_failures_and_keeps_legacy_amount(server_module):
    repair = server_module.RepairCreate(**repair_payload(budget_items=[
        {"issue": "pantalla", "amount": 100000, "cost_price": 40000},
        {"issue": "flex carga", "amount": 25000},
    ], budget_estimate=1))
    assert repair.budget_estimate == 125000
    assert repair.reported_issue == "Pantalla"
    assert [item.issue for item in repair.budget_items] == ["Pantalla", "Flex carga"]
    assert [item.cost_price for item in repair.budget_items] == [40000, None]
    assert server_module.RepairCreate(**repair_payload(budget_estimate=80000)).budget_estimate == 80000


def test_rejects_duplicate_or_invalid_priced_failures(server_module):
    with pytest.raises(ValidationError):
        server_module.RepairCreate(**repair_payload(budget_items=[
            {"issue": "Pantalla", "amount": 100}, {"issue": "pantalla", "amount": 25},
        ]))
    with pytest.raises(ValidationError):
        server_module.RepairUpdate(budget_items=[{"issue": "Flex carga", "amount": -1}])
    with pytest.raises(ValidationError):
        server_module.RepairUpdate(budget_items=[{"issue": "Flex carga", "amount": 100, "cost_price": -1}])
    with pytest.raises(ValidationError):
        server_module.RepairUpdate(budget_items=[
            {"issue": "Pantalla", "amount": 100}, {"issue": "pantalla", "amount": 25},
        ])
    assert server_module.repair_budget_total(server_module.RepairUpdate(budget_items=[
        {"issue": "Pantalla", "amount": 100}, {"issue": "Flex carga", "amount": 25},
    ]).budget_items) == 125


def test_delivery_pdf_lists_each_failure_and_total(monkeypatch):
    rows = []
    original_details = pdf_generator.details

    def collect_details(values, styles, green=False):
        rows.extend(values)
        return original_details(values, styles, green)

    monkeypatch.setattr(pdf_generator, "details", collect_details)
    pdf = pdf_generator.generate_delivery_pdf({
        "ticket_number": "REP-00001", "device_brand": "Apple", "device_model": "iPhone 13",
        "reported_issue": "Pantalla", "budget_estimate": 125000,
        "budget_items": [{"issue": "Pantalla", "amount": 100000, "cost_price": 40000}, {"issue": "Flex carga", "amount": 25000}],
    }, {"name": "Ana"})
    assert pdf.getvalue().startswith(b"%PDF")
    assert ("Pantalla", "$100.000") in rows
    assert ("Flex carga", "$25.000") in rows
    assert ("Total del servicio", "$125.000") in rows
    assert all("40.000" not in value for _, value in rows)


def test_update_repair_recalculates_total_and_can_clear_items(monkeypatch, server_module):
    saved = {
        "id": "repair-1", "tenant_id": "tenant-1", "ticket_number": "REP-00001",
        "customer_id": "customer-1", "customer_name": "Ana",
        "device_brand": "Apple", "device_model": "iPhone 13",
        "reported_issue": "Pantalla", "status": "received",
        "budget_estimate": 80000, "budget_items": [],
    }

    async def find_one(*args, **kwargs):
        return saved.copy()

    async def update_one(_filter, update):
        saved.update(update["$set"])
        return SimpleNamespace(matched_count=1)

    repairs = SimpleNamespace(find_one=find_one, update_one=update_one)
    monkeypatch.setattr(server_module, "tenant_database", AsyncMock(return_value=SimpleNamespace(repairs=repairs)))
    updated = asyncio.run(server_module.update_repair("repair-1", server_module.RepairUpdate(budget_items=[
        {"issue": "Flex carga", "amount": 100000, "cost_price": 40000},
        {"issue": "Pantalla", "amount": 25000},
    ], budget_estimate=1), {"tenant_id": "tenant-1", "role": "admin"}))
    assert updated.budget_estimate == 125000
    assert updated.reported_issue == "Flex carga"
    assert [item.issue for item in updated.budget_items] == ["Flex carga", "Pantalla"]
    assert [item.cost_price for item in updated.budget_items] == [40000, None]

    cleared = asyncio.run(server_module.update_repair("repair-1", server_module.RepairUpdate(
        reported_issue="camara", budget_items=None,
    ), {"tenant_id": "tenant-1", "role": "admin"}))
    assert cleared.budget_estimate is None
    assert cleared.budget_items == []
    assert cleared.reported_issue == "Cámara"
