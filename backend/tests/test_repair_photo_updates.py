"""Photo changes on saved repairs, without requiring a MongoDB service."""

import os
import sys
import asyncio
from functools import wraps
from pathlib import Path
from types import SimpleNamespace

import pytest
from fastapi import HTTPException

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
os.environ.setdefault("MONGO_URL", "mongodb://127.0.0.1:18770")
os.environ.setdefault("DB_NAME", "sf_photo_test")
os.environ.setdefault("JWT_SECRET", "photo-test-secret-not-for-production-123456789")
import server


def run_async_test(test):
    @wraps(test)
    def wrapped(*args, **kwargs):
        return asyncio.run(test(*args, **kwargs))
    return wrapped


TENANT = "photo-tenant"
FIRST = "https://res.cloudinary.com/test-cloud/image/upload/v123/photo-tenant/repairs/first.jpg"
SECOND = "https://res.cloudinary.com/test-cloud/image/upload/v124/photo-tenant/repairs/second.jpg"


class FakeRepairs:
    def __init__(self, status="received", photos=None):
        self.doc = {
            "id": "repair-1",
            "tenant_id": TENANT,
            "ticket_number": "REP-00001",
            "customer_id": "customer-1",
            "customer_name": "Cliente",
            "device_brand": "Apple",
            "device_model": "iPhone",
            "reported_issue": "Pantalla",
            "status": status,
            "device_photos": photos or [],
        }
        self.close_before_update = False

    async def find_one(self, query, projection):
        if query.get("id") != self.doc["id"] or query.get("tenant_id") != TENANT:
            return None
        return dict(self.doc)

    async def update_one(self, query, change):
        if self.close_before_update:
            self.doc["status"] = "delivered"
        if query.get("status", {}).get("$nin") and self.doc["status"] in query["status"]["$nin"]:
            return SimpleNamespace(matched_count=0)
        self.doc.update(change["$set"])
        return SimpleNamespace(matched_count=1)


@pytest.fixture
def repairs(monkeypatch):
    collection = FakeRepairs()

    async def database(_tenant_id):
        return SimpleNamespace(repairs=collection)

    monkeypatch.setattr(server, "tenant_database", database)
    monkeypatch.setenv("CLOUDINARY_CLOUD_NAME", "test-cloud")
    return collection


@run_async_test
@pytest.mark.parametrize("status", ["received", "diagnosis", "in_repair", "completed"])
async def test_saved_open_repair_can_add_and_remove_photos(repairs, status):
    repairs.doc["status"] = status
    repairs.doc["device_photos"] = [FIRST]
    updated = await server.update_repair(
        "repair-1", server.RepairUpdate(device_photos=[FIRST, SECOND]), {"tenant_id": TENANT}
    )
    assert updated.device_photos == [FIRST, SECOND]
    updated = await server.update_repair(
        "repair-1", server.RepairUpdate(device_photos=[SECOND]), {"tenant_id": TENANT}
    )
    assert updated.device_photos == [SECOND]


@run_async_test
@pytest.mark.parametrize("status", ["delivered", "not_repaired"])
async def test_terminal_repair_rejects_photo_changes(repairs, status):
    repairs.doc["status"] = status
    with pytest.raises(HTTPException) as error:
        await server.update_repair(
            "repair-1", server.RepairUpdate(device_photos=[FIRST]), {"tenant_id": TENANT}
        )
    assert error.value.status_code == 409


@run_async_test
@pytest.mark.parametrize("url", [
    "https://example.com/photo.jpg",
    "https://res.cloudinary.com/test-cloud/image/upload/v123/other-tenant/repairs/photo.jpg",
    "http://res.cloudinary.com/test-cloud/image/upload/v123/photo-tenant/repairs/photo.jpg",
])
async def test_new_photos_must_belong_to_this_tenant(repairs, url):
    with pytest.raises(HTTPException) as error:
        await server.update_repair(
            "repair-1", server.RepairUpdate(device_photos=[url]), {"tenant_id": TENANT}
        )
    assert error.value.status_code == 400
    assert repairs.doc["device_photos"] == []


@run_async_test
async def test_photo_update_rejects_status_race(repairs):
    repairs.close_before_update = True
    with pytest.raises(HTTPException) as error:
        await server.update_repair(
            "repair-1", server.RepairUpdate(device_photos=[FIRST]), {"tenant_id": TENANT}
        )
    assert error.value.status_code == 409
    assert repairs.doc["device_photos"] == []
