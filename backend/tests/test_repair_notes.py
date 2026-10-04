"""Saved repair notes stay tenant-scoped and private notes never enter the delivery PDF."""

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
os.environ.setdefault("DB_NAME", "sf_notes_test")
os.environ.setdefault("JWT_SECRET", "notes-test-secret-not-for-production-123456789")
import pdf_generator
import server


def run_async(test):
    @wraps(test)
    def wrapper(*args, **kwargs):
        return asyncio.run(test(*args, **kwargs))
    return wrapper


class FakeRepairs:
    def __init__(self):
        self.doc = {
            "id": "repair-1", "tenant_id": "tenant-1", "ticket_number": "REP-00001",
            "customer_id": "customer-1", "customer_name": "Ana", "device_brand": "Apple",
            "device_model": "iPhone 13", "reported_issue": "Pantalla rota",
            "status": "delivered", "notes": "Nota inicial", "notes_private": False,
        }

    async def find_one(self, query, projection):
        if query.get("id") != self.doc["id"] or query.get("tenant_id") != self.doc["tenant_id"]:
            return None
        return dict(self.doc)

    async def update_one(self, query, change):
        if query.get("id") != self.doc["id"] or query.get("tenant_id") != self.doc["tenant_id"]:
            return SimpleNamespace(matched_count=0)
        if "note_entries.id" in query and not any(
            note["id"] == query["note_entries.id"] for note in self.doc.get("note_entries", [])
        ):
            return SimpleNamespace(matched_count=0)
        if "$push" in change:
            self.doc.setdefault("note_entries", []).append(change["$push"]["note_entries"])
        for key, value in change.get("$set", {}).items():
            if key == "note_entries.$.is_private":
                next(note for note in self.doc["note_entries"] if note["id"] == query["note_entries.id"])["is_private"] = value
            else:
                self.doc[key] = value
        return SimpleNamespace(matched_count=1)


@pytest.fixture
def repairs(monkeypatch):
    collection = FakeRepairs()

    async def database(_tenant_id):
        return SimpleNamespace(repairs=collection)

    monkeypatch.setattr(server, "tenant_database", database)
    return collection


@run_async
async def test_add_and_change_visibility_on_delivered_repair(repairs):
    user = {"tenant_id": "tenant-1", "name": "Técnica"}
    updated = await server.add_repair_note(
        "repair-1", server.RepairNoteCreate(text="  Revisar batería  "), user,
    )
    assert updated.note_entries[0].text == "Revisar batería"
    assert updated.note_entries[0].is_private is True
    note_id = updated.note_entries[0].id
    updated = await server.set_repair_note_visibility(
        "repair-1", note_id, server.RepairNoteVisibility(is_private=False), user,
    )
    assert updated.note_entries[0].is_private is False


@run_async
async def test_notes_cannot_cross_tenants(repairs):
    with pytest.raises(HTTPException) as error:
        await server.add_repair_note("repair-1", server.RepairNoteCreate(text="Secreto"), {"tenant_id": "other"})
    assert error.value.status_code == 404
    assert not repairs.doc.get("note_entries")


@run_async
async def test_blank_note_rejected(repairs):
    with pytest.raises(HTTPException) as error:
        await server.add_repair_note("repair-1", server.RepairNoteCreate(text="   "), {"tenant_id": "tenant-1"})
    assert error.value.status_code == 400


@run_async
async def test_initial_note_can_be_made_private_after_order_is_saved(repairs):
    updated = await server.update_repair(
        "repair-1", server.RepairUpdate(notes_private=True), {"tenant_id": "tenant-1"},
    )
    assert updated.notes == "Nota inicial"
    assert updated.notes_private is True


def test_delivery_pdf_contains_only_public_notes(monkeypatch):
    captured_rows = []
    original_details = pdf_generator.details

    def capture_details(rows, styles, green=False):
        captured_rows.extend(rows)
        return original_details(rows, styles, green)

    monkeypatch.setattr(pdf_generator, "details", capture_details)
    repair = {
        "ticket_number": "REP-00001", "device_brand": "Apple", "device_model": "iPhone 13",
        "reported_issue": "Pantalla rota", "notes": "Secreto inicial", "notes_private": True,
        "note_entries": [
            {"text": "Secreto interno", "is_private": True},
            {"text": "Pantalla reemplazada", "is_private": False},
        ],
    }
    pdf = pdf_generator.generate_delivery_pdf(repair, {"name": "Ana"})
    assert pdf.getvalue().startswith(b"%PDF")
    notes = [value for label, value in captured_rows if label == "Notas"]
    assert notes == ["Pantalla reemplazada"]

    captured_rows.clear()
    repair["note_entries"] = [{"text": "Privada", "is_private": True}]
    pdf_generator.generate_delivery_pdf(repair, {"name": "Ana"})
    assert not any(label == "Notas" for label, _ in captured_rows)

    captured_rows.clear()
    repair["notes_private"] = False
    pdf_generator.generate_delivery_pdf(repair, {"name": "Ana"})
    assert [value for label, value in captured_rows if label == "Notas"] == ["Secreto inicial"]
