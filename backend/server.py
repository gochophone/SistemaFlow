from fastapi import FastAPI, APIRouter, HTTPException, Depends, status, File, UploadFile, Response, Query
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict, EmailStr
from typing import List, Optional
import uuid
from datetime import datetime, timezone, timedelta
import bcrypt
import jwt
import time
import cloudinary
import cloudinary.utils
from email_service import send_repair_ready_notification

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

JWT_SECRET = os.environ.get('JWT_SECRET', 'your-secret-key-change-in-production')
JWT_ALGORITHM = 'HS256'

# Configure Cloudinary
cloudinary.config(
    cloud_name=os.environ.get('CLOUDINARY_CLOUD_NAME'),
    api_key=os.environ.get('CLOUDINARY_API_KEY'),
    api_secret=os.environ.get('CLOUDINARY_API_SECRET'),
    secure=True
)

app = FastAPI()
api_router = APIRouter(prefix="/api")
security = HTTPBearer()

class User(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    email: EmailStr
    name: str
    role: str
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class UserCreate(BaseModel):
    email: EmailStr
    password: str
    name: str
    role: str = "technician"

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class Customer(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    phone: str
    email: Optional[str] = None
    rut: Optional[str] = None
    address: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

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
    ticket_number: str
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
    name: str
    code: str
    quantity: int
    price: float
    location: Optional[str] = None
    min_stock: int = 5
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class InventoryCreate(BaseModel):
    name: str
    code: str
    quantity: int
    price: float
    location: Optional[str] = None
    min_stock: int = 5

class InventoryUpdate(BaseModel):
    name: Optional[str] = None
    code: Optional[str] = None
    quantity: Optional[int] = None
    price: Optional[float] = None
    location: Optional[str] = None
    min_stock: Optional[int] = None

class DashboardStats(BaseModel):
    total_repairs: int
    active_repairs: int
    completed_today: int
    pending_delivery: int
    low_stock_items: int
    repairs_by_status: dict
    weekly_repairs: List[dict]

def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

def verify_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode('utf-8'), hashed.encode('utf-8'))

def create_token(user_id: str, email: str, role: str) -> str:
    payload = {
        'user_id': user_id,
        'email': email,
        'role': role,
        'exp': datetime.now(timezone.utc) + timedelta(days=7)
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    try:
        token = credentials.credentials
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        return payload
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expirado")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Token inválido")

@api_router.post("/auth/register", response_model=User)
async def register(user_data: UserCreate):
    existing = await db.users.find_one({"email": user_data.email}, {"_id": 0})
    if existing:
        raise HTTPException(status_code=400, detail="El email ya está registrado")
    
    user_dict = user_data.model_dump()
    password = user_dict.pop('password')
    user_dict['password_hash'] = hash_password(password)
    
    user_obj = User(**{k: v for k, v in user_dict.items() if k != 'password_hash'})
    doc = user_obj.model_dump()
    doc['password_hash'] = user_dict['password_hash']
    doc['created_at'] = doc['created_at'].isoformat()
    
    await db.users.insert_one(doc)
    return user_obj

@api_router.post("/auth/login")
async def login(credentials: UserLogin):
    user = await db.users.find_one({"email": credentials.email}, {"_id": 0})
    if not user or not verify_password(credentials.password, user['password_hash']):
        raise HTTPException(status_code=401, detail="Credenciales inválidas")
    
    token = create_token(user['id'], user['email'], user['role'])
    return {
        "token": token,
        "user": {
            "id": user['id'],
            "email": user['email'],
            "name": user['name'],
            "role": user['role']
        }
    }

@api_router.get("/auth/me", response_model=User)
async def get_me(current_user: dict = Depends(get_current_user)):
    user = await db.users.find_one({"id": current_user['user_id']}, {"_id": 0, "password_hash": 0})
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    
    if isinstance(user.get('created_at'), str):
        user['created_at'] = datetime.fromisoformat(user['created_at'])
    
    return User(**user)

@api_router.post("/customers", response_model=Customer)
async def create_customer(customer: CustomerCreate, current_user: dict = Depends(get_current_user)):
    customer_obj = Customer(**customer.model_dump())
    doc = customer_obj.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    
    await db.customers.insert_one(doc)
    return customer_obj

@api_router.get("/customers", response_model=List[Customer])
async def get_customers(current_user: dict = Depends(get_current_user)):
    customers = await db.customers.find({}, {"_id": 0}).to_list(1000)
    for c in customers:
        if isinstance(c.get('created_at'), str):
            c['created_at'] = datetime.fromisoformat(c['created_at'])
    return customers

@api_router.get("/customers/{customer_id}", response_model=Customer)
async def get_customer(customer_id: str, current_user: dict = Depends(get_current_user)):
    customer = await db.customers.find_one({"id": customer_id}, {"_id": 0})
    if not customer:
        raise HTTPException(status_code=404, detail="Cliente no encontrado")
    if isinstance(customer.get('created_at'), str):
        customer['created_at'] = datetime.fromisoformat(customer['created_at'])
    return Customer(**customer)

@api_router.put("/customers/{customer_id}", response_model=Customer)
async def update_customer(customer_id: str, customer_update: CustomerCreate, current_user: dict = Depends(get_current_user)):
    update_data = customer_update.model_dump()
    result = await db.customers.update_one({"id": customer_id}, {"$set": update_data})
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Cliente no encontrado")
    
    updated = await db.customers.find_one({"id": customer_id}, {"_id": 0})
    if isinstance(updated.get('created_at'), str):
        updated['created_at'] = datetime.fromisoformat(updated['created_at'])
    return Customer(**updated)

@api_router.delete("/customers/{customer_id}")
async def delete_customer(customer_id: str, current_user: dict = Depends(get_current_user)):
    result = await db.customers.delete_one({"id": customer_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Cliente no encontrado")
    return {"message": "Cliente eliminado"}

@api_router.post("/repairs", response_model=Repair)
async def create_repair(repair: RepairCreate, current_user: dict = Depends(get_current_user)):
    count = await db.repairs.count_documents({})
    ticket_number = f"REP-{count + 1:05d}"
    
    repair_dict = repair.model_dump()
    repair_dict['ticket_number'] = ticket_number
    repair_obj = Repair(**repair_dict)
    
    doc = repair_obj.model_dump()
    doc['received_date'] = doc['received_date'].isoformat()
    if doc.get('estimated_delivery'):
        doc['estimated_delivery'] = doc['estimated_delivery'].isoformat()
    
    await db.repairs.insert_one(doc)
    return repair_obj

@api_router.get("/repairs", response_model=List[Repair])
async def get_repairs(status: Optional[str] = None, current_user: dict = Depends(get_current_user)):
    query = {}
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
    repair = await db.repairs.find_one({"id": repair_id}, {"_id": 0})
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
    update_data = {k: v for k, v in repair_update.model_dump().items() if v is not None}
    
    # Get the repair before update to check status change
    current_repair = await db.repairs.find_one({"id": repair_id}, {"_id": 0})
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
    
    result = await db.repairs.update_one({"id": repair_id}, {"$set": update_data})
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Orden no encontrada")
    
    updated = await db.repairs.find_one({"id": repair_id}, {"_id": 0})
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
        # Get customer info
        customer = await db.customers.find_one({"id": updated['customer_id']}, {"_id": 0})
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
    result = await db.repairs.delete_one({"id": repair_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Orden no encontrada")
    return {"message": "Orden eliminada"}

@api_router.post("/inventory", response_model=InventoryItem)
async def create_inventory_item(item: InventoryCreate, current_user: dict = Depends(get_current_user)):
    item_obj = InventoryItem(**item.model_dump())
    doc = item_obj.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    doc['updated_at'] = doc['updated_at'].isoformat()
    
    await db.inventory.insert_one(doc)
    return item_obj

@api_router.get("/inventory", response_model=List[InventoryItem])
async def get_inventory(current_user: dict = Depends(get_current_user)):
    items = await db.inventory.find({}, {"_id": 0}).to_list(1000)
    for item in items:
        if isinstance(item.get('created_at'), str):
            item['created_at'] = datetime.fromisoformat(item['created_at'])
        if isinstance(item.get('updated_at'), str):
            item['updated_at'] = datetime.fromisoformat(item['updated_at'])
    return items

@api_router.get("/inventory/{item_id}", response_model=InventoryItem)
async def get_inventory_item(item_id: str, current_user: dict = Depends(get_current_user)):
    item = await db.inventory.find_one({"id": item_id}, {"_id": 0})
    if not item:
        raise HTTPException(status_code=404, detail="Artículo no encontrado")
    if isinstance(item.get('created_at'), str):
        item['created_at'] = datetime.fromisoformat(item['created_at'])
    if isinstance(item.get('updated_at'), str):
        item['updated_at'] = datetime.fromisoformat(item['updated_at'])
    return InventoryItem(**item)

@api_router.patch("/inventory/{item_id}", response_model=InventoryItem)
async def update_inventory_item(item_id: str, item_update: InventoryUpdate, current_user: dict = Depends(get_current_user)):
    update_data = {k: v for k, v in item_update.model_dump().items() if v is not None}
    update_data['updated_at'] = datetime.now(timezone.utc).isoformat()
    
    result = await db.inventory.update_one({"id": item_id}, {"$set": update_data})
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Artículo no encontrado")
    
    updated = await db.inventory.find_one({"id": item_id}, {"_id": 0})
    if isinstance(updated.get('created_at'), str):
        updated['created_at'] = datetime.fromisoformat(updated['created_at'])
    if isinstance(updated.get('updated_at'), str):
        updated['updated_at'] = datetime.fromisoformat(updated['updated_at'])
    return InventoryItem(**updated)

@api_router.delete("/inventory/{item_id}")
async def delete_inventory_item(item_id: str, current_user: dict = Depends(get_current_user)):
    result = await db.inventory.delete_one({"id": item_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Artículo no encontrado")
    return {"message": "Artículo eliminado"}

@api_router.get("/dashboard/stats", response_model=DashboardStats)
async def get_dashboard_stats(current_user: dict = Depends(get_current_user)):
    total_repairs = await db.repairs.count_documents({})
    active_repairs = await db.repairs.count_documents({"status": {"$nin": ["delivered", "cancelled"]}})
    
    today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    completed_today = await db.repairs.count_documents({
        "status": "completed",
        "completed_date": {"$gte": today_start.isoformat()}
    })
    
    pending_delivery = await db.repairs.count_documents({"status": "completed"})
    
    low_stock_items = await db.inventory.count_documents({
        "$expr": {"$lte": ["$quantity", "$min_stock"]}
    })
    
    status_pipeline = [
        {"$group": {"_id": "$status", "count": {"$sum": 1}}}
    ]
    status_results = await db.repairs.aggregate(status_pipeline).to_list(100)
    repairs_by_status = {item['_id']: item['count'] for item in status_results}
    
    week_ago = datetime.now(timezone.utc) - timedelta(days=7)
    weekly_pipeline = [
        {"$match": {"received_date": {"$gte": week_ago.isoformat()}}},
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
    results = {
        "repairs": [],
        "customers": [],
        "inventory": []
    }
    
    search_pattern = {"$regex": q, "$options": "i"}
    
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
    
    timestamp = int(time.time())
    params = {
        "timestamp": timestamp,
        "folder": folder,
        "resource_type": resource_type
    }
    
    signature = cloudinary.utils.api_sign_request(
        params,
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