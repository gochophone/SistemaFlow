"""Single-use email challenges shared across replicas; never store raw codes."""
import hashlib
import hmac
import secrets
from datetime import datetime, timezone, timedelta
from fastapi import HTTPException
from pymongo import ReturnDocument
from pymongo.errors import DuplicateKeyError
import email_service

async def issue(db, secret, email, purpose, payload=None):
    if not email_service.resend.api_key or email_service.SENDER_EMAIL.endswith('@resend.dev'):
        raise HTTPException(503, 'El envío de correos todavía no está configurado. Contacta al administrador.')
    now = datetime.now(timezone.utc)
    key = hashlib.sha256(f'{purpose}:{email}'.encode()).hexdigest()
    try:
        await db.email_challenges.find_one_and_update(
            {'_id': key, '$or': [{'sent_at': {'$lt': now - timedelta(minutes=1)}}, {'sent_at': {'$exists': False}}]},
            {'$set': {'sent_at': now}}, upsert=True, return_document=ReturnDocument.AFTER)
    except DuplicateKeyError:
        raise HTTPException(429, 'Espera un minuto antes de pedir otro código.')
    # Hourly quota persists across resends and service restarts.
    bucket = key + ':' + now.strftime('%Y%m%d%H')
    quota = await db.email_limits.find_one_and_update({'_id': bucket},
        {'$inc': {'count': 1}, '$set': {'expires_at': now + timedelta(hours=2)}},
        upsert=True, return_document=ReturnDocument.AFTER)
    if quota['count'] > 5:
        raise HTTPException(429, 'Has solicitado demasiados códigos. Inténtalo dentro de una hora.')
    # Bound outbound mail volume even when an attacker rotates recipient emails.
    daily = await db.email_limits.find_one_and_update(
            {'_id': 'auth-mail:' + now.strftime('%Y%m%d')},
            {'$inc': {'count': 1}, '$set': {'expires_at': now + timedelta(days=2)}},
            upsert=True, return_document=ReturnDocument.AFTER)
    if daily['count'] > 90:
        raise HTTPException(429, 'El servicio de correo alcanzó su límite diario. Inténtalo mañana.')
    code = f'{secrets.randbelow(1000000):06d}'
    nonce = secrets.token_hex(16)
    digest = hmac.new(secret.encode(), f'{key}:{nonce}:{code}'.encode(), hashlib.sha256).hexdigest()
    await db.email_challenges.update_one({'_id': key, 'sent_at': now}, {'$set': {
        'digest': digest, 'nonce': nonce, 'attempts': 0, 'payload': payload,
        'expires_at': now + timedelta(minutes=10), 'ready': False}})
    try:
        # Unknown reset accounts get the same response and limits, without mail.
        if payload is not None:
            await email_service.send_auth_code(email, code, purpose)
    except Exception:
        raise HTTPException(503, 'No pudimos enviar el correo. Inténtalo de nuevo más tarde.')
    await db.email_challenges.update_one({'_id': key, 'nonce': nonce}, {'$set': {'ready': True}})
    return {'message': 'Si el correo corresponde, recibirás un código. Revisa también spam.', 'verification_required': True}

async def consume(db, secret, email, purpose, code):
    key = hashlib.sha256(f'{purpose}:{email}'.encode()).hexdigest()
    doc = await db.email_challenges.find_one_and_update(
        {'_id': key, 'ready': True, 'expires_at': {'$gt': datetime.now(timezone.utc)}, 'attempts': {'$lt': 5}},
        {'$inc': {'attempts': 1}}, return_document=ReturnDocument.AFTER)
    error = HTTPException(400, 'Código incorrecto o vencido. Solicita uno nuevo si agotaste los intentos.')
    if not doc:
        raise error
    digest = hmac.new(secret.encode(), f"{key}:{doc['nonce']}:{code}".encode(), hashlib.sha256).hexdigest()
    if not hmac.compare_digest(digest, doc['digest']):
        raise error
    claimed = await db.email_challenges.find_one_and_update(
        {'_id': key, 'nonce': doc['nonce'], 'ready': True}, {'$set': {'ready': False}, '$unset': {'payload': ''}})
    if not claimed or claimed.get('payload') is None:
        raise error
    return claimed['payload']
