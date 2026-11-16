"""The primary business has a permanent exemption without changing other plans."""

import asyncio
import sys
from datetime import datetime, timezone
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import AsyncMock

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import billing


def test_exemption_applies_only_to_the_verified_primary_owner():
    db = SimpleNamespace(
        users=SimpleNamespace(find_one=AsyncMock(return_value={'tenant_id': 'primary-tenant'})),
        subscriptions=SimpleNamespace(
            find_one_and_update=AsyncMock(return_value={'_id': 'primary-tenant'}),
            update_one=AsyncMock(),
        ),
    )
    assert asyncio.run(billing.exempt_primary_owner(db)) is True
    db.users.find_one.assert_awaited_once_with(
        {'email': 'gochophone@gmail.com', 'is_owner': True},
        {'tenant_id': 1, '_id': 0},
    )
    db.subscriptions.update_one.assert_awaited_once_with(
        {'_id': 'primary-tenant'}, {'$set': {'exempt': True}},
    )

    db.users.find_one.reset_mock(return_value=True)
    db.users.find_one.return_value = None
    db.subscriptions.update_one.reset_mock()
    assert asyncio.run(billing.exempt_primary_owner(db)) is False
    db.subscriptions.update_one.assert_not_awaited()


def test_exempt_business_ignores_expiry_but_not_suspension():
    expired = {'expires_at': datetime(2020, 1, 1, tzinfo=timezone.utc).isoformat()}
    assert billing.active(expired) is False
    assert billing.active({**expired, 'exempt': True}) is True
    assert billing.active({**expired, 'exempt': True, 'suspended': True}) is False
