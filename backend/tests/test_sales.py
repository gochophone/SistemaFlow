"""Sales behavior without a live MongoDB connection."""

import asyncio
import os
import sys
from functools import wraps
from pathlib import Path
from types import SimpleNamespace

import pytest
from fastapi import HTTPException

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
os.environ.setdefault("MONGO_URL", "mongodb://127.0.0.1:18770")
os.environ.setdefault("DB_NAME", "sf_sales_test")
os.environ.setdefault("JWT_SECRET", "sales-test-secret-not-for-production-123456789")
import server


TENANT = "tenant-sales"
USER = {"id": "admin-1", "name": "Administrador", "role": "admin", "tenant_id": TENANT}
PHOTO = "https://res.cloudinary.com/test-cloud/image/upload/v123/tenant-sales/sales/phone.jpg"
INVENTORY_PHOTO = "https://res.cloudinary.com/test-cloud/image/upload/v123/tenant-sales/inventory/macbook.jpg"


def run_async(test):
    @wraps(test)
    def wrapper(*args, **kwargs):
        return asyncio.run(test(*args, **kwargs))
    return wrapper


class FakeCursor:
    def __init__(self, documents):
        self.documents = documents

    def sort(self, field, direction):
        self.documents.sort(key=lambda item: item[field], reverse=direction == -1)
        return self

    async def to_list(self, limit):
        return self.documents[:limit]


class FakeCollection:
    def __init__(self, documents=()):
        self.documents = [dict(item) for item in documents]
        self.fail_insert = False

    def matches(self, document, query):
        for key, value in query.items():
            if key == "$or":
                if not any(self.matches(document, clause) for clause in value):
                    return False
            elif isinstance(value, dict) and "$gte" in value:
                if document.get(key, 0) < value["$gte"]:
                    return False
            elif isinstance(value, dict) and "$ne" in value:
                if document.get(key) == value["$ne"]:
                    return False
            elif isinstance(value, dict) and "$regex" in value:
                if value["$regex"].lower() not in str(document.get(key, "")).lower():
                    return False
            elif document.get(key) != value:
                return False
        return True

    async def find_one(self, query, projection=None):
        return next((dict(item) for item in self.documents if self.matches(item, query)), None)

    async def find_one_and_update(self, query, change, return_document=None):
        for item in self.documents:
            if self.matches(item, query):
                old = dict(item)
                self.apply(item, change)
                return old
        return None

    async def update_one(self, query, change):
        for item in self.documents:
            if self.matches(item, query):
                self.apply(item, change)
                return SimpleNamespace(matched_count=1)
        return SimpleNamespace(matched_count=0)

    def apply(self, item, change):
        for key, value in change.get("$inc", {}).items():
            item[key] += value
        item.update(change.get("$set", {}))

    async def insert_one(self, document):
        if self.fail_insert:
            raise RuntimeError("database write failed")
        self.documents.append(dict(document))
        return SimpleNamespace(inserted_id=document["id"])

    def find(self, query, projection=None):
        return FakeCursor([dict(item) for item in self.documents if self.matches(item, query)])


@pytest.fixture
def db(monkeypatch):
    database = SimpleNamespace(
        customers=FakeCollection([{"id": "customer-1", "tenant_id": TENANT, "name": "Ana", "rut": "12345678K", "phone": "123"}]),
        inventory=FakeCollection([{"id": "item-1", "tenant_id": TENANT, "name": "MacBook Air", "code": "INV-1", "quantity": 1, "available": True}]),
        sales=FakeCollection(),
    )

    async def tenant_database(_tenant):
        return database

    monkeypatch.setattr(server, "tenant_database", tenant_database)
    monkeypatch.setenv("CLOUDINARY_CLOUD_NAME", "test-cloud")
    return database


def payload(**overrides):
    data = {
        "customer_id": "customer-1", "source": "manual", "item_name": "iPhone 13", "category": "phone",
        "quantity": 1, "unit_price": 100000, "condition": "used", "photos": [PHOTO],
    }
    return server.SaleCreate(**{**data, **overrides})


@pytest.mark.parametrize("category", ["phone", "notebook", "macbook", "board", "spare_part", "other"])
@run_async
async def test_sale_category_round_trip(db, category):
    sale = await server.create_sale(payload(category=category, custom_category="  Cámara  " if category == "other" else None), USER)
    assert sale.category == category
    assert sale.custom_category == ("Cámara" if category == "other" else None)
    assert (await server.get_sale(sale.id, USER))["category"] == category
    if category == "other":
        assert (await server.get_sale(sale.id, USER))["custom_category"] == "Cámara"
        assert len(await server.get_sales(q="Cámara", customer_id=None, current_user=USER)) == 1


@run_async
async def test_other_category_requires_a_name_without_affecting_existing_sales(db):
    with pytest.raises(HTTPException) as error:
        await server.create_sale(payload(category="other", custom_category="   "), USER)
    assert error.value.status_code == 400
    assert db.sales.documents == []

    sale = await server.create_sale(payload(category="phone", custom_category="No corresponde"), USER)
    assert sale.custom_category is None
    db.sales.documents[0].pop("custom_category")
    assert server.Sale.model_validate(await server.get_sale(sale.id, USER)).custom_category is None


@run_async
async def test_manual_sale_preserves_buyer_and_serial_history(db):
    sale = await server.create_sale(payload(serial_number="SERIAL-1"), USER)
    assert sale.customer_name == "Ana"
    assert sale.customer_rut == "12345678K"
    assert sale.serial_number == "SERIAL-1"
    assert sale.total_price == 100000
    assert sale.sale_number.startswith("VEN-")
    assert db.inventory.documents[0]["quantity"] == 1
    db.customers.documents.clear()
    saved = await server.get_sale(sale.id, USER)
    assert saved["customer_name"] == "Ana"
    assert saved["serial_number"] == "SERIAL-1"


@run_async
async def test_inventory_sale_decrements_stock_and_keeps_item_snapshot(db):
    sale = await server.create_sale(payload(source="inventory", inventory_item_id="item-1", item_name=None,
                                            photos=[INVENTORY_PHOTO]), USER)
    assert sale.item_name == "MacBook Air"
    assert sale.inventory_code == "INV-1"
    assert sale.photos == [INVENTORY_PHOTO]
    assert db.inventory.documents[0]["quantity"] == 0
    assert db.inventory.documents[0]["available"] is False
    db.inventory.documents[0]["name"] = "Renamed later"
    assert db.sales.documents[0]["item_name"] == "MacBook Air"
    with pytest.raises(HTTPException) as error:
        await server.create_sale(payload(source="inventory", inventory_item_id="item-1", item_name=None), USER)
    assert error.value.status_code == 409


@run_async
async def test_sale_insert_failure_restores_reserved_stock(db):
    db.sales.fail_insert = True
    with pytest.raises(RuntimeError):
        await server.create_sale(payload(source="inventory", inventory_item_id="item-1", item_name=None), USER)
    assert db.inventory.documents[0]["quantity"] == 1
    assert db.inventory.documents[0]["available"] is True


@run_async
async def test_sale_cannot_use_another_business_customer_or_inventory(db):
    db.customers.documents[0]["tenant_id"] = "another-tenant"
    with pytest.raises(HTTPException) as error:
        await server.create_sale(payload(), USER)
    assert error.value.status_code == 404
    db.customers.documents[0]["tenant_id"] = TENANT
    db.inventory.documents[0]["tenant_id"] = "another-tenant"
    with pytest.raises(HTTPException) as error:
        await server.create_sale(payload(source="inventory", inventory_item_id="item-1", item_name=None), USER)
    assert error.value.status_code == 409


@run_async
async def test_serialized_articles_must_be_separate_and_photos_owned(db):
    with pytest.raises(HTTPException) as error:
        await server.create_sale(payload(quantity=2, imei="123"), USER)
    assert error.value.status_code == 400
    assert db.sales.documents == []
    for bad in (
        "https://res.cloudinary.com/test-cloud/image/upload/v123/other/sales/phone.jpg",
        "https://res.cloudinary.com/test-cloud/image/upload/v123/other/sales/tenant-sales/sales/phone.jpg",
    ):
        with pytest.raises(HTTPException) as error:
            await server.create_sale(payload(photos=[bad]), USER)
        assert error.value.status_code == 400


@run_async
async def test_sales_search_and_detail_are_tenant_scoped(db):
    sale = await server.create_sale(payload(), USER)
    db.sales.documents.append({**db.sales.documents[0], "id": "other", "tenant_id": "another-tenant"})
    found = await server.get_sales(q="iPhone", customer_id=None, current_user=USER)
    assert [item["id"] for item in found] == [sale.id]
    with pytest.raises(HTTPException) as error:
        await server.get_sale("other", USER)
    assert error.value.status_code == 404


@run_async
async def test_sale_delivery_pdf_uses_saved_sale_and_is_tenant_scoped(db):
    sale = await server.create_sale(payload(category="other", custom_category="Cámara", serial_number="SER-123"), USER)
    company_user = {**USER, "company_name": "Servicios GP", "company_rut": "77.322.829-9",
                    "company_address": "Santiago"}
    response = await server.generate_sale_pdf(sale.id, company_user)
    pdf = b"".join([chunk async for chunk in response.body_iterator])
    assert response.media_type == "application/pdf"
    assert f'venta_entrega_{sale.sale_number}.pdf' in response.headers["content-disposition"]
    assert pdf.startswith(b"%PDF-")

    db.sales.documents[0]["tenant_id"] = "another-tenant"
    with pytest.raises(HTTPException) as error:
        await server.generate_sale_pdf(sale.id, company_user)
    assert error.value.status_code == 404


@run_async
async def test_technician_cannot_manage_sales_or_upload_sale_photos(db):
    technician = {**USER, "role": "technician"}
    with pytest.raises(HTTPException) as error:
        await server.require_admin(technician)
    assert error.value.status_code == 403
    with pytest.raises(HTTPException) as error:
        await server.generate_cloudinary_signature(folder="sales", current_user=technician)
    assert error.value.status_code == 403
