"""Business subscriptions. Payment reports never grant access without review."""
import calendar
import os
import uuid
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field, ConfigDict
from pymongo import ReturnDocument


def now():
    return datetime.now(timezone.utc)


def month_after(value):
    year, month = value.year + value.month // 12, value.month % 12 + 1
    return value.replace(year=year, month=month, day=min(value.day, calendar.monthrange(year, month)[1]))


def is_manager(user):
    # No privilege is inferred from an ordinary business administrator role.
    return user['id'] in os.environ.get('BILLING_ADMIN_USER_IDS', '').split(',') or (
        bool(user.get('is_owner')) and user['email'].lower() == os.environ.get('BILLING_ADMIN_EMAIL', '').strip().lower())


async def subscription(db, tenant_id):
    start = now()
    return await db.subscriptions.find_one_and_update(
        {'_id': tenant_id}, {'$setOnInsert': {'trial_started_at': start.isoformat(),
        'expires_at': month_after(start).isoformat(), 'revision': 0, 'pending': None, 'history': []}},
        upsert=True, return_document=ReturnDocument.AFTER)


def active(doc):
    return datetime.fromisoformat(doc['expires_at']) > now()


class PaymentReport(BaseModel):
    model_config = ConfigDict(extra='forbid')
    reference: str = Field(min_length=3, max_length=200)


class Decision(BaseModel):
    model_config = ConfigDict(extra='forbid')
    approve: bool
    note: str = Field(min_length=3, max_length=200)


class BankDetails(BaseModel):
    model_config = ConfigDict(extra='forbid')
    holder: str = Field(min_length=1, max_length=150)
    rut: str = Field(min_length=1, max_length=30)
    bank: str = Field(min_length=1, max_length=100)
    account_type: str = Field(min_length=1, max_length=100)
    account_number: str = Field(min_length=1, max_length=50)


def router(db, authenticate):
    api = APIRouter(prefix='/api/billing')

    async def manager(user=Depends(authenticate)):
        if not is_manager(user):
            raise HTTPException(403, 'Solo el responsable de cobros')
        return user

    @api.get('')
    async def status(user=Depends(authenticate)):
        doc = await subscription(db, user['tenant_id'])
        bank = await db.billing_settings.find_one({'_id': 'bank'}, {'_id': 0})
        return {'active': active(doc), 'expires_at': doc['expires_at'], 'amount': 10000,
                'currency': 'CLP', 'is_manager': is_manager(user),
                'pending': doc['pending'], 'history': doc['history'][-12:],
                'bank': bank if user.get('is_owner') else None}

    @api.post('/report')
    async def report(data: PaymentReport, user=Depends(authenticate)):
        if not user.get('is_owner'):
            raise HTTPException(403, 'Solo el propietario puede informar pagos')
        if not data.reference.strip():
            raise HTTPException(422, 'Indica una referencia de transferencia')
        if not await db.billing_settings.find_one({'_id': 'bank'}):
            raise HTTPException(409, 'Los datos de transferencia aún no están configurados')
        await subscription(db, user['tenant_id'])
        pending = {'id': uuid.uuid4().hex, 'reference': data.reference.strip(),
                   'reported_at': now().isoformat(), 'reported_by': user['id']}
        result = await db.subscriptions.update_one({'_id': user['tenant_id'], 'pending': None},
                      {'$set': {'pending': pending}, '$inc': {'revision': 1}})
        if not result.modified_count:
            raise HTTPException(409, 'Ya tienes un pago pendiente de revisión')
        return {'message': 'Transferencia enviada a revisión. El acceso se renueva al confirmar el pago.'}

    @api.get('/admin')
    async def accounts(user=Depends(manager)):
        items = []
        async for owner in db.users.find({'is_owner': True}, {'password_hash': 0}):
            doc = await subscription(db, owner['tenant_id'])
            items.append({'tenant_id': owner['tenant_id'], 'company': owner.get('company_name', owner['name']),
                          'email': owner['email'], 'expires_at': doc['expires_at'],
                          'active': active(doc), 'pending': doc['pending']})
        return items

    @api.put('/bank')
    async def bank(data: BankDetails, user=Depends(manager)):
        await db.billing_settings.update_one({'_id': 'bank'}, {'$set': data.model_dump()}, upsert=True)
        return {'message': 'Datos bancarios guardados'}

    @api.post('/admin/{tenant_id}/{request_id}')
    async def decide(tenant_id: str, request_id: str, data: Decision, user=Depends(manager)):
        doc = await db.subscriptions.find_one({'_id': tenant_id})
        if not doc:
            raise HTTPException(404, 'Negocio no encontrado')
        if any(item['id'] == request_id for item in doc['history']):
            return {'message': 'Este pago ya fue revisado'}
        if not doc['pending'] or doc['pending']['id'] != request_id:
            raise HTTPException(409, 'La solicitud ya no está pendiente')
        expiry = doc['expires_at']
        if data.approve:
            expiry = month_after(max(now(), datetime.fromisoformat(expiry))).isoformat()
        entry = {**doc['pending'], 'approved': data.approve, 'note': data.note,
                 'reviewed_by': user['id'], 'reviewed_at': now().isoformat(),
                 'amount': 10000, 'currency': 'CLP', 'expires_at': expiry}
        result = await db.subscriptions.update_one(
            {'_id': tenant_id, 'revision': doc['revision'], 'pending.id': request_id},
            {'$set': {'pending': None, 'expires_at': expiry}, '$inc': {'revision': 1},
             '$push': {'history': entry}})
        if not result.modified_count:
            raise HTTPException(409, 'Otro administrador actualizó el pago. Recarga la página.')
        return {'message': 'Pago confirmado y mes añadido' if data.approve else 'Pago rechazado'}

    return api
