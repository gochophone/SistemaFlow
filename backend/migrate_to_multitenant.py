"""
Script to migrate existing data to multi-tenant structure
Assigns a default tenant_id to existing records
"""
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
import os
from dotenv import load_dotenv

load_dotenv('/app/backend/.env')

# Default tenant for existing data
DEFAULT_TENANT_ID = "tenant_default_001"

async def migrate_data():
    mongo_url = os.environ['MONGO_URL']
    client = AsyncIOMotorClient(mongo_url)
    db = client[os.environ['DB_NAME']]
    
    print("🚀 Starting data migration to multi-tenant structure...")
    
    # Migrate customers
    customers_updated = await db.customers.update_many(
        {"tenant_id": {"$exists": False}},
        {"$set": {"tenant_id": DEFAULT_TENANT_ID}}
    )
    print(f"✅ Customers migrated: {customers_updated.modified_count}")
    
    # Migrate repairs
    repairs_updated = await db.repairs.update_many(
        {"tenant_id": {"$exists": False}},
        {"$set": {"tenant_id": DEFAULT_TENANT_ID}}
    )
    print(f"✅ Repairs migrated: {repairs_updated.modified_count}")
    
    # Migrate inventory
    inventory_updated = await db.inventory.update_many(
        {"tenant_id": {"$exists": False}},
        {"$set": {"tenant_id": DEFAULT_TENANT_ID}}
    )
    print(f"✅ Inventory items migrated: {inventory_updated.modified_count}")
    
    # Migrate users (assign default tenant to existing users)
    users_updated = await db.users.update_many(
        {"tenant_id": {"$exists": False}},
        {"$set": {"tenant_id": DEFAULT_TENANT_ID}}
    )
    print(f"✅ Users migrated: {users_updated.modified_count}")
    
    print("\n🎉 Migration completed successfully!")
    print(f"All existing data now belongs to tenant: {DEFAULT_TENANT_ID}")
    
    client.close()

if __name__ == "__main__":
    asyncio.run(migrate_data())
