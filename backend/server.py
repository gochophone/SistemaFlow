from fastapi import FastAPI, APIRouter, HTTPException, Depends, status, File, UploadFile, Response, Query
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.responses import StreamingResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
import hashlib
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict, EmailStr
from typing import List, Optional, Literal
from pymongo import ReturnDocument
from pymongo.errors import DuplicateKeyError
import re
import secrets
import uuid
from datetime import datetime, timezone, timedelta
import bcrypt
import jwt
import time
import cloudinary
import cloudinary.utils
from email_service import send_repair_ready_notification
from pdf_generator import generate_delivery_pdf

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
control_db = client[os.environ['DB_NAME']]

def database_name(tenant_id):
    # Atlas shared clusters limit database names to 38 bytes (3 + 32 = 35).
    return 'sf_' + hashlib.sha256(tenant_id.encode()).hexdigest()[:32]

async def tenant_database(tenant_id):
    tenant = await control_db.tenants.find_one({'_id': tenant_id, 'ready': True})
    if not tenant:
        raise HTTPException(status_code=503, detail='Cuenta pendiente de migración. Contacta al administrador.')
    return client[database_name(tenant_id)]


JWT_SECRET = os.environ.get('JWT_SECRET')
JWT_ALGORITHM = 'HS256'

# Configure Cloudinary
cloudinary.config(
    cloud_name=os.environ.get('CLOUDINARY_CLOUD_NAME'),
    api_key=os.environ.get('CLOUDINARY_API_KEY'),
    api_secret=os.environ.get('CLOUDINARY_API_SECRET'),
    secure=True
)

app = FastAPI()
@app.get("/health", include_in_schema=False)
async def health():
    """Process health only; does not read customer data or require MongoDB."""
    return {"status": "ok"}


api_router = APIRouter(prefix="/api")
security = HTTPBearer()

class User(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    email: EmailStr
    name: str
    role: str
    is_owner: bool = False
    active: bool = True
    tenant_id: str  # Each user belongs to a tenant (business/company)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class UserCreate(BaseModel):
    email: EmailStr
    password: str = Field(min_length=10, max_length=72)
    name: str = Field(min_length=1)
    company_name: str  # Name of the business/company

class TeamUserCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    email: EmailStr
    password: str = Field(min_length=10, max_length=72)
    name: str = Field(min_length=1)
    role: Literal["admin", "technician"]

class TeamUserUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    role: Optional[Literal["admin", "technician"]] = None
    active: Optional[bool] = None

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class Customer(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    tenant_id: str  # Multi-tenant isolation
    name: str
    phone: str
    email: Optional[str] = None
    rut: Optional[str] = None
    address: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class CustomerCreate(BaseModel):
    name: str
    phone: str
    email: Optional[str] = None
    rut: Optional[str] = None
    address: Optional[str] = None

class Device(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    brand: str
    model: str
    imei: str
    serial_number: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class DeviceCreate(BaseModel):
    brand: str
    model: str
    imei: str
    serial_number: Optional[str] = None

class Repair(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    tenant_id: str  # Multi-tenant isolation
    ticket_number: str
    public_token: str = Field(default_factory=lambda: uuid.uuid4().hex)
    customer_id: str
    customer_name: str
    device_brand: str
    device_model: str
    device_imei: str
    device_serial: Optional[str] = None
    reported_issue: str
    diagnosis: Optional[str] = None
    status: str = "received"
    assigned_technician: Optional[str] = None
    budget_estimate: Optional[float] = None
    notes: Optional[str] = None
    unlock_type: Optional[str] = None
    unlock_password: Optional[str] = None
    unlock_pattern: Optional[str] = None
    device_photos: Optional[List[str]] = None
    received_date: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    estimated_delivery: Optional[datetime] = None
    completed_date: Optional[datetime] = None
    delivered_date: Optional[datetime] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class RepairCreate(BaseModel):
    customer_id: str
    customer_name: str
    device_brand: str
    device_model: str
    device_imei: str
    device_serial: Optional[str] = None
    reported_issue: str
    diagnosis: Optional[str] = None
    assigned_technician: Optional[str] = None
    budget_estimate: Optional[float] = None
    notes: Optional[str] = None
    estimated_delivery: Optional[datetime] = None
    unlock_type: Optional[str] = None
    unlock_password: Optional[str] = None
    unlock_pattern: Optional[str] = None
    device_photos: Optional[List[str]] = None

class RepairUpdate(BaseModel):
    status: Optional[str] = None
    diagnosis: Optional[str] = None
    assigned_technician: Optional[str] = None
    budget_estimate: Optional[float] = None
    notes: Optional[str] = None
    estimated_delivery: Optional[datetime] = None

class InventoryItem(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    tenant_id: str  # Multi-tenant isolation
    name: str
    code: str
    quantity: int
    price: float
    location: Optional[str] = None
    condition: Optional[int] = Field(default=10, ge=1, le=10)  # Estado del 1 al 10
    photos: Optional[List[str]] = []  # URLs de fotos en Cloudinary
    available: bool = True  # Disponibilidad del artículo
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class InventoryCreate(BaseModel):
    name: str
    code: str
    quantity: int
    price: float
    location: Optional[str] = None
    condition: Optional[int] = Field(default=10, ge=1, le=10)
    photos: Optional[List[str]] = []
    available: bool = True

class InventoryUpdate(BaseModel):
    name: Optional[str] = None
    code: Optional[str] = None
    quantity: Optional[int] = None
    price: Optional[float] = None
    location: Optional[str] = None
    condition: Optional[int] = Field(default=None, ge=1, le=10)
    photos: Optional[List[str]] = None
    available: Optional[bool] = None

class DashboardStats(BaseModel):
    total_repairs: int
    active_repairs: int
    completed_today: int
    pending_delivery: int
    low_stock_items: Optional[int] = None
    repairs_by_status: dict
    weekly_repairs: List[dict]

def hash_password(password: str) -> str:
    if len(password.encode('utf-8')) > 72:
        raise HTTPException(status_code=422, detail='La contraseña debe ocupar como máximo 72 bytes UTF-8')
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

def verify_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode('utf-8'), hashed.encode('utf-8'))

def create_token(user_id: str, email: str, role: str, tenant_id: str) -> str:
    payload = {
        'user_id': user_id,
        'email': email,
        'role': role,
        'tenant_id': tenant_id,
        'exp': datetime.now(timezone.utc) + timedelta(days=7)
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

def get_tenant_id(email: str) -> str:
    """Generate a unique tenant ID based on email domain or unique string"""
    email_hash = hashlib.sha256(email.encode()).hexdigest()[:12]
    return f"tenant_{email_hash}"

@app.on_event("startup")
async def initialize_identity_indexes():
    global JWT_SECRET
    # Generate once in the identity directory if no deployment secret was set.
    # $setOnInsert makes all replicas share the same persistent signing key.
    if not JWT_SECRET or JWT_SECRET == 'your-secret-key-change-in-production':
        settings = await control_db.auth_settings.find_one_and_update(
            {"_id": "jwt_signing"}, {"$setOnInsert": {"secret": secrets.token_hex(48)}},
            upsert=True, return_document=ReturnDocument.AFTER)
        JWT_SECRET = settings["secret"]
    # Fail closed if the directory is unavailable or contains duplicate identities.
    await control_db.users.create_index("email", unique=True)
    await control_db.public_links.create_index("token", unique=True)

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    try:
        payload = jwt.decode(credentials.credentials, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        user = await control_db.users.find_one({"id": payload.get("user_id")}, {"_id": 0})
        if not user or not user.get("active", True):
            raise HTTPException(status_code=401, detail="Sesión inválida")
        # Roles and routing always come from the server, never from client claims.
        return {**user, "user_id": user["id"]}
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expirado")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Token inválido")

async def require_admin(current_user: dict = Depends(get_current_user)):
    if current_user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Solo administradores")
    return current_user

def public_user(user):
    return User(**user).model_dump(mode="json")

@api_router.post("/auth/register")
async def register(user_data: UserCreate):
    email = str(user_data.email).strip().lower()
    if await control_db.users.find_one({"email": email}):
        raise HTTPException(status_code=409, detail="El email ya está registrado")
    tenant_id = "tenant_" + uuid.uuid4().hex
    user = User(email=email, name=user_data.name, role="admin", tenant_id=tenant_id, is_owner=True)
    doc = user.model_dump(mode="json")
    doc.update(password_hash=hash_password(user_data.password), company_name=user_data.company_name)
    # Provision before making the identity visible. Failed duplicate registration
    # may leave an empty, unreachable tenant, but never grants access to another one.
    await client[database_name(tenant_id)].settings.update_one(
        {"_id": "account"}, {"$setOnInsert": {"owner_id": user.id, "company_name": user_data.company_name}}, upsert=True)
    await control_db.tenants.insert_one({"_id": tenant_id, "owner_id": user.id, "ready": True})
    try:
        await control_db.users.insert_one(doc)
    except DuplicateKeyError:
        raise HTTPException(status_code=409, detail="El email ya está registrado")
    return {"message": "Cuenta principal creada", "user": public_user(doc)}

@api_router.post("/auth/login")
async def login(credentials: UserLogin):
    user = await control_db.users.find_one({"email": str(credentials.email).strip().lower()}, {"_id": 0})
    if not user or not user.get("active", True) or not verify_password(credentials.password, user['password_hash']):
        raise HTTPException(status_code=401, detail="Credenciales inválidas")
    await tenant_database(user["tenant_id"])
    token = create_token(user['id'], user['email'], user['role'], user['tenant_id'])
    return {"token": token, "user": public_user(user)}

@api_router.get("/auth/me", response_model=User)
async def get_me(current_user: dict = Depends(get_current_user)):
    return public_user(current_user)

@api_router.get("/team", response_model=List[User])
async def get_team(current_user: dict = Depends(require_admin)):
    users = await control_db.users.find({"tenant_id": current_user["tenant_id"]}, {"_id": 0, "password_hash": 0}).to_list(1000)
    return [public_user(user) for user in users]

@api_router.post("/team", response_model=User, status_code=201)
async def create_team_user(data: TeamUserCreate, current_user: dict = Depends(require_admin)):
    await tenant_database(current_user["tenant_id"])
    user = User(email=str(data.email).strip().lower(), name=data.name, role=data.role, tenant_id=current_user["tenant_id"])
    doc = user.model_dump(mode="json")
    doc["password_hash"] = hash_password(data.password)
    try:
        await control_db.users.insert_one(doc)
    except DuplicateKeyError:
        raise HTTPException(status_code=409, detail="El email ya está registrado")
    return public_user(doc)

@api_router.patch("/team/{user_id}", response_model=User)
async def update_team_user(user_id: str, data: TeamUserUpdate, current_user: dict = Depends(require_admin)):
    query = {"id": user_id, "tenant_id": current_user["tenant_id"]}
    target = await control_db.users.find_one(query)
    if not target:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    if target.get("is_owner") or target["id"] == current_user["id"]:
        raise HTTPException(status_code=403, detail="No puedes modificar la cuenta principal ni tu propio acceso")
    updates = data.model_dump(exclude_none=True)
    if updates:
        await control_db.users.update_one(query, {"$set": updates})
    return public_user(await control_db.users.find_one(query))

@api_router.post("/customers", response_model=Customer)
async def create_customer(customer: CustomerCreate, current_user: dict = Depends(get_current_user)):
    db = await tenant_database(current_user["tenant_id"])
    tenant_id = current_user['tenant_id']
    customer_obj = Customer(**customer.model_dump(), tenant_id=tenant_id)
    doc = customer_obj.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    
    await db.customers.insert_one(doc)
    return customer_obj

@api_router.get("/customers", response_model=List[Customer])
async def get_customers(current_user: dict = Depends(get_current_user)):
    db = await tenant_database(current_user["tenant_id"])
    tenant_id = current_user['tenant_id']
    customers = await db.customers.find({"tenant_id": tenant_id}, {"_id": 0}).to_list(1000)
    for c in customers:
        if isinstance(c.get('created_at'), str):
            c['created_at'] = datetime.fromisoformat(c['created_at'])
    return customers

@api_router.get("/customers/{customer_id}", response_model=Customer)
async def get_customer(customer_id: str, current_user: dict = Depends(get_current_user)):
    db = await tenant_database(current_user["tenant_id"])
    tenant_id = current_user['tenant_id']
    customer = await db.customers.find_one({"id": customer_id, "tenant_id": tenant_id}, {"_id": 0})
    if not customer:
        raise HTTPException(status_code=404, detail="Cliente no encontrado")
    if isinstance(customer.get('created_at'), str):
        customer['created_at'] = datetime.fromisoformat(customer['created_at'])
    return Customer(**customer)

@api_router.put("/customers/{customer_id}", response_model=Customer)
async def update_customer(customer_id: str, customer_update: CustomerCreate, current_user: dict = Depends(get_current_user)):
    db = await tenant_database(current_user["tenant_id"])
    tenant_id = current_user['tenant_id']
    update_data = customer_update.model_dump()
    update_data['updated_at'] = datetime.now(timezone.utc).isoformat()
    result = await db.customers.update_one({"id": customer_id, "tenant_id": tenant_id}, {"$set": update_data})
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Cliente no encontrado")
    
    updated = await db.customers.find_one({"id": customer_id, "tenant_id": tenant_id}, {"_id": 0})
    if isinstance(updated.get('created_at'), str):
        updated['created_at'] = datetime.fromisoformat(updated['created_at'])
    if isinstance(updated.get('updated_at'), str):
        updated['updated_at'] = datetime.fromisoformat(updated['updated_at'])
    return Customer(**updated)

@api_router.delete("/customers/{customer_id}")
async def delete_customer(customer_id: str, current_user: dict = Depends(get_current_user)):
    db = await tenant_database(current_user["tenant_id"])
    tenant_id = current_user['tenant_id']
    result = await db.customers.delete_one({"id": customer_id, "tenant_id": tenant_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Cliente no encontrado")
    return {"message": "Cliente eliminado"}

@api_router.post("/repairs", response_model=Repair)
async def create_repair(repair: RepairCreate, current_user: dict = Depends(get_current_user)):
    db = await tenant_database(current_user["tenant_id"])
    tenant_id = current_user['tenant_id']
    
    customer = await db.customers.find_one({"id": repair.customer_id, "tenant_id": tenant_id})
    if not customer:
        raise HTTPException(status_code=404, detail="Cliente no encontrado")
    repair.customer_name = customer["name"]
    # Allocate an account-local ticket atomically
    counter = await db.counters.find_one_and_update({"_id": "repair_number"}, {"$inc": {"value": 1}}, upsert=True, return_document=ReturnDocument.AFTER)
    ticket_number = f"REP-{counter['value']:05d}"
    
    repair_dict = repair.model_dump()
    repair_dict['ticket_number'] = ticket_number
    repair_dict['tenant_id'] = tenant_id
    repair_obj = Repair(**repair_dict)
    
    doc = repair_obj.model_dump()
    doc['received_date'] = doc['received_date'].isoformat()
    if doc.get('estimated_delivery'):
        doc['estimated_delivery'] = doc['estimated_delivery'].isoformat()
    
    await control_db.public_links.insert_one({"token": repair_obj.public_token, "tenant_id": tenant_id, "repair_id": repair_obj.id})
    await db.repairs.insert_one(doc)
    return repair_obj

@api_router.get("/repairs", response_model=List[Repair])
async def get_repairs(status: Optional[str] = None, current_user: dict = Depends(get_current_user)):
    db = await tenant_database(current_user["tenant_id"])
    tenant_id = current_user['tenant_id']
    query = {"tenant_id": tenant_id}
    if status:
        query['status'] = status
    
    repairs = await db.repairs.find(query, {"_id": 0}).sort("received_date", -1).to_list(1000)
    for r in repairs:
        if isinstance(r.get('received_date'), str):
            r['received_date'] = datetime.fromisoformat(r['received_date'])
        if r.get('estimated_delivery') and isinstance(r['estimated_delivery'], str):
            r['estimated_delivery'] = datetime.fromisoformat(r['estimated_delivery'])
        if r.get('completed_date') and isinstance(r['completed_date'], str):
            r['completed_date'] = datetime.fromisoformat(r['completed_date'])
        if r.get('delivered_date') and isinstance(r['delivered_date'], str):
            r['delivered_date'] = datetime.fromisoformat(r['delivered_date'])
    return repairs

@api_router.get("/repairs/{repair_id}", response_model=Repair)
async def get_repair(repair_id: str, current_user: dict = Depends(get_current_user)):
    db = await tenant_database(current_user["tenant_id"])
    tenant_id = current_user['tenant_id']
    repair = await db.repairs.find_one({"id": repair_id, "tenant_id": tenant_id}, {"_id": 0})
    if not repair:
        raise HTTPException(status_code=404, detail="Orden no encontrada")
    
    if isinstance(repair.get('received_date'), str):
        repair['received_date'] = datetime.fromisoformat(repair['received_date'])
    if repair.get('estimated_delivery') and isinstance(repair['estimated_delivery'], str):
        repair['estimated_delivery'] = datetime.fromisoformat(repair['estimated_delivery'])
    if repair.get('completed_date') and isinstance(repair['completed_date'], str):
        repair['completed_date'] = datetime.fromisoformat(repair['completed_date'])
    if repair.get('delivered_date') and isinstance(repair['delivered_date'], str):
        repair['delivered_date'] = datetime.fromisoformat(repair['delivered_date'])
    
    return Repair(**repair)

@api_router.patch("/repairs/{repair_id}", response_model=Repair)
async def update_repair(repair_id: str, repair_update: RepairUpdate, current_user: dict = Depends(get_current_user)):
    db = await tenant_database(current_user["tenant_id"])
    tenant_id = current_user['tenant_id']
    update_data = {k: v for k, v in repair_update.model_dump().items() if v is not None}
    update_data['updated_at'] = datetime.now(timezone.utc).isoformat()
    
    # Get the repair before update to check status change
    current_repair = await db.repairs.find_one({"id": repair_id, "tenant_id": tenant_id}, {"_id": 0})
    if not current_repair:
        raise HTTPException(status_code=404, detail="Orden no encontrada")
    
    old_status = current_repair.get('status')
    new_status = update_data.get('status', old_status)
    
    if 'status' in update_data:
        if update_data['status'] == 'completed':
            update_data['completed_date'] = datetime.now(timezone.utc).isoformat()
        elif update_data['status'] == 'delivered':
            update_data['delivered_date'] = datetime.now(timezone.utc).isoformat()
    
    if 'estimated_delivery' in update_data and update_data['estimated_delivery']:
        update_data['estimated_delivery'] = update_data['estimated_delivery'].isoformat()
    
    result = await db.repairs.update_one({"id": repair_id, "tenant_id": tenant_id}, {"$set": update_data})
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Orden no encontrada")
    
    updated = await db.repairs.find_one({"id": repair_id, "tenant_id": tenant_id}, {"_id": 0})
    if isinstance(updated.get('created_at'), str):
        updated['created_at'] = datetime.fromisoformat(updated['created_at'])
    if isinstance(updated.get('updated_at'), str):
        updated['updated_at'] = datetime.fromisoformat(updated['updated_at'])
    if isinstance(updated.get('received_date'), str):
        updated['received_date'] = datetime.fromisoformat(updated['received_date'])
    if updated.get('estimated_delivery') and isinstance(updated['estimated_delivery'], str):
        updated['estimated_delivery'] = datetime.fromisoformat(updated['estimated_delivery'])
    if updated.get('completed_date') and isinstance(updated['completed_date'], str):
        updated['completed_date'] = datetime.fromisoformat(updated['completed_date'])
    if updated.get('delivered_date') and isinstance(updated['delivered_date'], str):
        updated['delivered_date'] = datetime.fromisoformat(updated['delivered_date'])
    
    # Send email notification if status changed to completed
    if old_status != 'completed' and new_status == 'completed':
        # Get customer info (with tenant check)
        customer = await db.customers.find_one({"id": updated['customer_id'], "tenant_id": tenant_id}, {"_id": 0})
        if customer and customer.get('email'):
            try:
                email_result = await send_repair_ready_notification(
                    customer_email=customer['email'],
                    customer_name=updated['customer_name'],
                    ticket_number=updated['ticket_number'],
                    device_brand=updated['device_brand'],
                    device_model=updated['device_model'],
                    diagnosis=updated.get('diagnosis')
                )
                logger.info(f"Email notification result: {email_result}")
            except Exception as e:
                logger.error(f"Failed to send email notification: {str(e)}")
                # Don't fail the request if email fails
    
    return Repair(**updated)

@api_router.delete("/repairs/{repair_id}")
async def delete_repair(repair_id: str, current_user: dict = Depends(get_current_user)):
    db = await tenant_database(current_user["tenant_id"])
    tenant_id = current_user['tenant_id']
    result = await db.repairs.delete_one({"id": repair_id, "tenant_id": tenant_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Orden no encontrada")
    return {"message": "Orden eliminada"}

@api_router.get("/repairs/{repair_id}/delivery-pdf")
async def generate_repair_delivery_pdf(repair_id: str, current_user: dict = Depends(get_current_user)):
    db = await tenant_database(current_user["tenant_id"])
    """Generate and download delivery order PDF"""
    tenant_id = current_user['tenant_id']
    
    # Get repair data (with tenant check)
    repair = await db.repairs.find_one({"id": repair_id, "tenant_id": tenant_id}, {"_id": 0})
    if not repair:
        raise HTTPException(status_code=404, detail="Orden no encontrada")
    
    # Get customer data (with tenant check)
    customer = await db.customers.find_one({"id": repair['customer_id'], "tenant_id": tenant_id}, {"_id": 0})
    if not customer:
        customer = {
            'name': repair.get('customer_name', ''),
            'email': '',
            'phone': '',
            'rut': ''
        }
    
    # Generate PDF
    try:
        pdf_buffer = generate_delivery_pdf(repair, customer)
        
        # Return as downloadable file
        filename = f"orden_entrega_{repair['ticket_number']}.pdf"
        
        return StreamingResponse(
            pdf_buffer,
            media_type="application/pdf",
            headers={
                "Content-Disposition": f"attachment; filename={filename}"
            }
        )
    except Exception as e:
        logger.error(f"Error generating PDF: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error al generar PDF: {str(e)}")

@api_router.post("/inventory", response_model=InventoryItem)
async def create_inventory_item(item: InventoryCreate, current_user: dict = Depends(require_admin)):
    db = await tenant_database(current_user["tenant_id"])
    tenant_id = current_user['tenant_id']
    item_obj = InventoryItem(**item.model_dump(), tenant_id=tenant_id)
    doc = item_obj.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    doc['updated_at'] = doc['updated_at'].isoformat()
    
    await db.inventory.insert_one(doc)
    return item_obj

@api_router.get("/inventory", response_model=List[InventoryItem])
async def get_inventory(current_user: dict = Depends(require_admin)):
    db = await tenant_database(current_user["tenant_id"])
    tenant_id = current_user['tenant_id']
    items = await db.inventory.find({"tenant_id": tenant_id}, {"_id": 0}).to_list(1000)
    for item in items:
        if isinstance(item.get('created_at'), str):
            item['created_at'] = datetime.fromisoformat(item['created_at'])
        if isinstance(item.get('updated_at'), str):
            item['updated_at'] = datetime.fromisoformat(item['updated_at'])
    return items

@api_router.get("/inventory/{item_id}", response_model=InventoryItem)
async def get_inventory_item(item_id: str, current_user: dict = Depends(require_admin)):
    db = await tenant_database(current_user["tenant_id"])
    tenant_id = current_user['tenant_id']
    item = await db.inventory.find_one({"id": item_id, "tenant_id": tenant_id}, {"_id": 0})
    if not item:
        raise HTTPException(status_code=404, detail="Artículo no encontrado")
    if isinstance(item.get('created_at'), str):
        item['created_at'] = datetime.fromisoformat(item['created_at'])
    if isinstance(item.get('updated_at'), str):
        item['updated_at'] = datetime.fromisoformat(item['updated_at'])
    return InventoryItem(**item)

@api_router.patch("/inventory/{item_id}", response_model=InventoryItem)
async def update_inventory_item(item_id: str, item_update: InventoryUpdate, current_user: dict = Depends(require_admin)):
    db = await tenant_database(current_user["tenant_id"])
    tenant_id = current_user['tenant_id']
    update_data = {k: v for k, v in item_update.model_dump().items() if v is not None}
    update_data['updated_at'] = datetime.now(timezone.utc).isoformat()
    
    # Si la cantidad llega a 0, marcar como no disponible automáticamente
    if 'quantity' in update_data and update_data['quantity'] == 0:
        update_data['available'] = False
    
    result = await db.inventory.update_one({"id": item_id, "tenant_id": tenant_id}, {"$set": update_data})
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Artículo no encontrado")
    
    updated = await db.inventory.find_one({"id": item_id, "tenant_id": tenant_id}, {"_id": 0})
    if isinstance(updated.get('created_at'), str):
        updated['created_at'] = datetime.fromisoformat(updated['created_at'])
    if isinstance(updated.get('updated_at'), str):
        updated['updated_at'] = datetime.fromisoformat(updated['updated_at'])
    return InventoryItem(**updated)

@api_router.delete("/inventory/{item_id}")
async def delete_inventory_item(item_id: str, current_user: dict = Depends(require_admin)):
    db = await tenant_database(current_user["tenant_id"])
    tenant_id = current_user['tenant_id']
    result = await db.inventory.delete_one({"id": item_id, "tenant_id": tenant_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Artículo no encontrado")
    return {"message": "Artículo eliminado"}

@api_router.get("/dashboard/stats", response_model=DashboardStats)
async def get_dashboard_stats(current_user: dict = Depends(get_current_user)):
    db = await tenant_database(current_user["tenant_id"])
    tenant_id = current_user['tenant_id']
    
    total_repairs = await db.repairs.count_documents({"tenant_id": tenant_id})
    active_repairs = await db.repairs.count_documents({"tenant_id": tenant_id, "status": {"$nin": ["delivered", "cancelled"]}})
    
    today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    completed_today = await db.repairs.count_documents({
        "tenant_id": tenant_id,
        "status": "completed",
        "completed_date": {"$gte": today_start.isoformat()}
    })
    
    pending_delivery = await db.repairs.count_documents({"tenant_id": tenant_id, "status": "completed"})
    
    # Contar items con stock bajo (quantity = 1) o sin stock (quantity = 0)
    low_stock_items = None
    if current_user["role"] == "admin":
        low_stock_items = await db.inventory.count_documents({"tenant_id": tenant_id, "quantity": {"$lte": 1}})
    
    status_pipeline = [
        {"$match": {"tenant_id": tenant_id}},
        {"$group": {"_id": "$status", "count": {"$sum": 1}}}
    ]
    status_results = await db.repairs.aggregate(status_pipeline).to_list(100)
    repairs_by_status = {item['_id']: item['count'] for item in status_results}
    
    week_ago = datetime.now(timezone.utc) - timedelta(days=7)
    weekly_pipeline = [
        {"$match": {"tenant_id": tenant_id, "received_date": {"$gte": week_ago.isoformat()}}},
        {"$group": {
            "_id": {"$dateToString": {"format": "%Y-%m-%d", "date": {"$toDate": "$received_date"}}},
            "count": {"$sum": 1}
        }},
        {"$sort": {"_id": 1}}
    ]
    weekly_results = await db.repairs.aggregate(weekly_pipeline).to_list(100)
    weekly_repairs = [{"date": item['_id'], "count": item['count']} for item in weekly_results]
    
    return DashboardStats(
        total_repairs=total_repairs,
        active_repairs=active_repairs,
        completed_today=completed_today,
        pending_delivery=pending_delivery,
        low_stock_items=low_stock_items,
        repairs_by_status=repairs_by_status,
        weekly_repairs=weekly_repairs
    )

@api_router.get("/search")
async def global_search(q: str, current_user: dict = Depends(get_current_user)):
    db = await tenant_database(current_user["tenant_id"])
    results = {
        "repairs": [],
        "customers": [],
        "inventory": []
    }
    
    search_pattern = {"$regex": re.escape(q[:200]), "$options": "i"}
    
    repairs = await db.repairs.find({
        "$or": [
            {"ticket_number": search_pattern},
            {"device_imei": search_pattern},
            {"customer_name": search_pattern}
        ]
    }, {"_id": 0}).limit(10).to_list(10)
    
    for r in repairs:
        if isinstance(r.get('received_date'), str):
            r['received_date'] = datetime.fromisoformat(r['received_date'])
    results['repairs'] = repairs
    
    customers = await db.customers.find({
        "$or": [
            {"name": search_pattern},
            {"phone": search_pattern},
            {"email": search_pattern}
        ]
    }, {"_id": 0}).limit(10).to_list(10)
    results['customers'] = customers
    
    if current_user["role"] == "admin":
        inventory = await db.inventory.find({
            "$or": [
                {"name": search_pattern},
                {"code": search_pattern}
            ]
        }, {"_id": 0}).limit(10).to_list(10)
        results['inventory'] = inventory
    
    return results

@api_router.get("/cloudinary/signature")
async def generate_cloudinary_signature(
    resource_type: str = Query("image", enum=["image", "video"]),
    folder: str = "repairs",
    current_user: dict = Depends(get_current_user)
):
    """Generate signed upload parameters for Cloudinary"""
    ALLOWED_FOLDERS = ("repairs", "users", "inventory")
    if folder not in ALLOWED_FOLDERS:
        raise HTTPException(status_code=400, detail="Invalid folder path")
    
    if folder == "inventory" and current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Solo administradores")
    folder = f"{current_user['tenant_id']}/{folder}"
    timestamp = int(time.time())
    # Only include params that will be sent in the upload request
    params_to_sign = {
        "timestamp": timestamp,
        "folder": folder
    }
    
    signature = cloudinary.utils.api_sign_request(
        params_to_sign,
        os.environ.get('CLOUDINARY_API_SECRET')
    )
    
    return {
        "signature": signature,
        "timestamp": timestamp,
        "cloud_name": os.environ.get('CLOUDINARY_CLOUD_NAME'),
        "api_key": os.environ.get('CLOUDINARY_API_KEY'),
        "folder": folder,
        "resource_type": resource_type
    }

app.include_router(api_router)

# Public routes (no authentication required)
public_router = APIRouter(prefix="/public")

@public_router.get("/repair/{public_token}")
async def get_public_repair(public_token: str):
    """Get public repair information by ticket number"""
    link = await control_db.public_links.find_one({"token": public_token})
    if not link:
        raise HTTPException(status_code=404, detail="Orden no encontrada")
    db = await tenant_database(link["tenant_id"])
    repair = await db.repairs.find_one({"id": link["repair_id"], "public_token": public_token}, {"_id": 0})
    if not repair:
        raise HTTPException(status_code=404, detail="Orden no encontrada")
    
    # Convert datetime strings
    if isinstance(repair.get('received_date'), str):
        repair['received_date'] = datetime.fromisoformat(repair['received_date'])
    if repair.get('estimated_delivery') and isinstance(repair['estimated_delivery'], str):
        repair['estimated_delivery'] = datetime.fromisoformat(repair['estimated_delivery'])
    if repair.get('completed_date') and isinstance(repair['completed_date'], str):
        repair['completed_date'] = datetime.fromisoformat(repair['completed_date'])
    
    # Return only public information
    public_data = {
        "ticket_number": repair['ticket_number'],
        "customer_name": repair['customer_name'],
        "device_brand": repair['device_brand'],
        "device_model": repair['device_model'],
        "reported_issue": repair['reported_issue'],
        "status": repair['status'],
        "received_date": repair['received_date'],
        "estimated_delivery": repair.get('estimated_delivery'),
        "completed_date": repair.get('completed_date')
    }
    
    return public_data

app.include_router(public_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
