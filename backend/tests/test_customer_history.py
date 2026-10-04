"""Customer repair history filters at the database and tenant boundary."""

import asyncio
import os
import sys
from pathlib import Path
from types import SimpleNamespace

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
os.environ.setdefault("MONGO_URL", "mongodb://127.0.0.1:18770")
os.environ.setdefault("DB_NAME", "sf_history_test")
os.environ.setdefault("JWT_SECRET", "history-test-secret-not-for-production-123456789")
import server


class FakeCursor:
    def __init__(self, documents):
        self.documents = documents

    def sort(self, field, direction):
        self.documents.sort(key=lambda item: item[field], reverse=direction == -1)
        return self

    async def to_list(self, limit):
        return self.documents[:limit]


class FakeRepairs:
    def __init__(self):
        self.documents = [
            {"id": "r1", "tenant_id": "t1", "customer_id": "c1", "received_date": "2026-01-01T10:00:00+00:00"},
            {"id": "r2", "tenant_id": "t1", "customer_id": "c2", "received_date": "2026-02-01T10:00:00+00:00"},
            {"id": "r3", "tenant_id": "t2", "customer_id": "c1", "received_date": "2026-03-01T10:00:00+00:00"},
            {"id": "r4", "tenant_id": "t1", "customer_id": "c1", "received_date": "2026-04-01T10:00:00+00:00"},
        ]
        self.last_query = None

    def find(self, query, projection):
        self.last_query = query
        return FakeCursor([dict(item) for item in self.documents if all(item.get(key) == value for key, value in query.items())])


def test_customer_history_contains_only_own_repairs_in_recent_order(monkeypatch):
    repairs = FakeRepairs()

    async def database(_tenant_id):
        return SimpleNamespace(repairs=repairs)

    monkeypatch.setattr(server, "tenant_database", database)
    result = asyncio.run(server.get_repairs(customer_id="c1", current_user={"tenant_id": "t1"}))
    assert repairs.last_query == {"tenant_id": "t1", "customer_id": "c1"}
    assert [item["id"] for item in result] == ["r4", "r1"]
