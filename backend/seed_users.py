import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
import os
from dotenv import load_dotenv
from pathlib import Path
import bcrypt

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

async def seed_users():
    users_collection = db.users
    
    existing_admin = await users_collection.find_one({"email": "admin@servicetec.com"})
    if existing_admin:
        print("Los usuarios de prueba ya existen.")
        return
    
    test_users = [
        {
            "id": "admin-001",
            "email": "admin@servicetec.com",
            "password_hash": hash_password("Admin123!"),
            "name": "Administrador",
            "role": "admin",
            "created_at": "2024-01-01T00:00:00Z"
        },
        {
            "id": "tech-001",
            "email": "tecnico@servicetec.com",
            "password_hash": hash_password("Tecnico123!"),
            "name": "Técnico Principal",
            "role": "technician",
            "created_at": "2024-01-01T00:00:00Z"
        },
        {
            "id": "recep-001",
            "email": "recepcion@servicetec.com",
            "password_hash": hash_password("Recepcion123!"),
            "name": "Recepcionista",
            "role": "receptionist",
            "created_at": "2024-01-01T00:00:00Z"
        }
    ]
    
    await users_collection.insert_many(test_users)
    print("✓ Usuarios de prueba creados exitosamente")
    print("\nCredenciales:")
    print("  Admin: admin@servicetec.com / Admin123!")
    print("  Técnico: tecnico@servicetec.com / Tecnico123!")
    print("  Recepcionista: recepcion@servicetec.com / Recepcion123!")

if __name__ == "__main__":
    asyncio.run(seed_users())
    client.close()
