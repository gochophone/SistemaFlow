"""Quick picks count explicit choices and are isolated per business."""

import asyncio
import os
import sys
from pathlib import Path
from types import SimpleNamespace

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
os.environ.setdefault("MONGO_URL", "mongodb://127.0.0.1:18770")
os.environ.setdefault("DB_NAME", "sf_issue_test")
os.environ.setdefault("JWT_SECRET", "issue-test-secret-not-for-production-123456789")
import server


class FakeCursor:
    def __init__(self, documents):
        self.documents = documents

    async def to_list(self, length):
        return list(self.documents)


class FakeIssueSelections:
    def __init__(self):
        self.documents = {}

    def find(self, query, projection):
        return FakeCursor(self.documents.values())

    async def update_one(self, query, update, upsert):
        key = query["_id"]
        document = self.documents.setdefault(key, {"name": update["$setOnInsert"]["name"], "count": 0})
        document["count"] += update["$inc"]["count"]


def test_selections_start_empty_and_build_per_tenant_quick_picks(monkeypatch):
    databases = {}

    async def tenant_database(tenant_id):
        return databases.setdefault(tenant_id, SimpleNamespace(issue_selections=FakeIssueSelections()))

    monkeypatch.setattr(server, "tenant_database", tenant_database)

    async def scenario():
        first = {"tenant_id": "first"}
        second = {"tenant_id": "second"}
        assert (await server.get_repair_issues(first))["frequent"] == []
        selected = await server.select_repair_issue(server.RepairIssueSelection(name="pantalla"), first)
        assert selected["frequent"] == [{"name": "Pantalla", "count": 1}]
        selected = await server.select_repair_issue(server.RepairIssueSelection(name="Pantalla"), first)
        assert selected["frequent"] == [{"name": "Pantalla", "count": 2}]
        selected = await server.select_repair_issue(server.RepairIssueSelection(name="Puerto USB"), first)
        assert selected["options"][-1] == "Puerto USB"
        assert selected["frequent"][1] == {"name": "Puerto USB", "count": 1}
        other_catalog = await server.get_repair_issues(second)
        assert other_catalog["frequent"] == []
        assert "Puerto USB" not in other_catalog["options"]

    asyncio.run(scenario())
