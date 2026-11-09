"""Inventory defaults, editable prices and tenant-specific article names without MongoDB."""

import asyncio
import os
import sys
from pathlib import Path
from types import SimpleNamespace

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
os.environ.setdefault('MONGO_URL', 'mongodb://127.0.0.1:18770')
os.environ.setdefault('DB_NAME', 'sf_inventory_test')
os.environ.setdefault('JWT_SECRET', 'inventory-test-secret-not-for-production-123456789')
import server


class Cursor:
    def __init__(self, documents):
        self.documents = documents

    async def to_list(self, _length):
        return [dict(document) for document in self.documents]


class Collection:
    def __init__(self):
        self.documents = []

    async def insert_one(self, document):
        self.documents.append(dict(document))

    async def find_one(self, query, _projection=None):
        return next((dict(document) for document in self.documents
                     if all(document.get(key) == value for key, value in query.items())), None)

    def find(self, _query, _projection=None):
        return Cursor(self.documents)

    async def update_one(self, query, change, upsert=False):
        document = next((document for document in self.documents
                         if all(document.get(key) == value for key, value in query.items())), None)
        if document is None and upsert:
            document = dict(query)
            document.update(change.get('$setOnInsert', {}))
            self.documents.append(document)
        elif document is not None:
            document.update(change.get('$set', {}))
        return SimpleNamespace(matched_count=1 if document is not None else 0)


@pytest.fixture
def database(monkeypatch):
    tenants = {
        key: SimpleNamespace(inventory=Collection(), inventory_names=Collection())
        for key in ('shop-a', 'shop-b')
    }

    async def tenant_database(tenant_id):
        return tenants[tenant_id]

    monkeypatch.setattr(server, 'tenant_database', tenant_database)
    return tenants


def test_inventory_accepts_optional_fields_and_can_clear_prices(database):
    async def exercise():
        user = {'tenant_id': 'shop-a', 'role': 'admin'}
        created = await server.create_inventory_item(server.InventoryCreate(), user)
        assert created.name == 'Artículo sin nombre'
        assert created.quantity == 0
        assert created.purchase_price is None and created.price is None

        updated = await server.update_inventory_item(created.id, server.InventoryUpdate(
            name='Flex de carga', purchase_price=15000, price=25000, description='Compatible con iPhone'), user)
        assert updated.purchase_price == 15000 and updated.price == 25000
        assert updated.description == 'Compatible con iPhone'

        cleared = await server.update_inventory_item(created.id, server.InventoryUpdate(
            purchase_price=None, price=None, description=None), user)
        assert cleared.purchase_price is None and cleared.price is None
        assert cleared.description is None

    asyncio.run(exercise())


def test_new_article_names_remain_private_to_each_business(database):
    async def exercise():
        owner = {'tenant_id': 'shop-a', 'role': 'admin'}
        other = {'tenant_id': 'shop-b', 'role': 'admin'}
        await server.add_inventory_name(server.InventoryNameInput(name=' Placa base '), owner)
        await server.add_inventory_name(server.InventoryNameInput(name='placa base'), owner)
        names = await server.get_inventory_names(owner)
        assert names == {'names': ['Placa base']}
        assert await server.get_inventory_names(other) == {'names': []}

    asyncio.run(exercise())
