"""Backend API tests for ServiceTec - Telephony repair management system."""
import os
import uuid
import pytest
import requests

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://import-track.preview.emergentagent.com').rstrip('/')
API = f"{BASE_URL}/api"

ADMIN = {"email": "admin@servicetec.com", "password": "Admin123!"}


@pytest.fixture(scope="session")
def admin_token():
    r = requests.post(f"{API}/auth/login", json=ADMIN, timeout=30)
    assert r.status_code == 200, f"Admin login failed: {r.status_code} {r.text}"
    return r.json()["token"]


@pytest.fixture(scope="session")
def auth_headers(admin_token):
    return {"Authorization": f"Bearer {admin_token}", "Content-Type": "application/json"}


# ============ AUTH ============
class TestAuth:
    def test_login_admin(self):
        r = requests.post(f"{API}/auth/login", json=ADMIN, timeout=30)
        assert r.status_code == 200
        data = r.json()
        assert "token" in data and "user" in data
        assert data["user"]["email"] == ADMIN["email"]
        assert data["user"]["role"] == "admin"

    def test_login_technician(self):
        r = requests.post(f"{API}/auth/login", json={"email": "tecnico@servicetec.com", "password": "Tecnico123!"}, timeout=30)
        assert r.status_code == 200
        assert r.json()["user"]["role"] == "technician"

    def test_login_receptionist(self):
        r = requests.post(f"{API}/auth/login", json={"email": "recepcion@servicetec.com", "password": "Recepcion123!"}, timeout=30)
        assert r.status_code == 200
        assert r.json()["user"]["role"] == "receptionist"

    def test_login_invalid(self):
        r = requests.post(f"{API}/auth/login", json={"email": "admin@servicetec.com", "password": "wrong"}, timeout=30)
        assert r.status_code == 401

    def test_register_new_user_and_duplicate(self):
        email = f"TEST_{uuid.uuid4().hex[:8]}@test.com"
        payload = {"email": email, "password": "Test123!", "name": "Test User", "role": "technician"}
        r = requests.post(f"{API}/auth/register", json=payload, timeout=30)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["email"] == email
        assert "id" in data
        # duplicate
        r2 = requests.post(f"{API}/auth/register", json=payload, timeout=30)
        assert r2.status_code == 400

    def test_me_requires_auth(self):
        r = requests.get(f"{API}/auth/me", timeout=30)
        assert r.status_code in (401, 403)

    def test_me_with_token(self, auth_headers):
        r = requests.get(f"{API}/auth/me", headers=auth_headers, timeout=30)
        assert r.status_code == 200
        assert r.json()["email"] == ADMIN["email"]


# ============ CUSTOMERS ============
class TestCustomers:
    def test_customer_crud(self, auth_headers):
        payload = {"name": "TEST_Cliente", "phone": "+5491100000", "email": "c@test.com", "address": "Calle 1"}
        r = requests.post(f"{API}/customers", json=payload, headers=auth_headers, timeout=30)
        assert r.status_code == 200, r.text
        cid = r.json()["id"]
        assert r.json()["name"] == "TEST_Cliente"

        # GET by id
        r = requests.get(f"{API}/customers/{cid}", headers=auth_headers, timeout=30)
        assert r.status_code == 200
        assert r.json()["phone"] == "+5491100000"

        # List
        r = requests.get(f"{API}/customers", headers=auth_headers, timeout=30)
        assert r.status_code == 200
        assert any(c["id"] == cid for c in r.json())

        # Update
        upd = {"name": "TEST_Cliente_Upd", "phone": "+5491100001", "email": None, "address": None}
        r = requests.put(f"{API}/customers/{cid}", json=upd, headers=auth_headers, timeout=30)
        assert r.status_code == 200
        assert r.json()["name"] == "TEST_Cliente_Upd"

        # Verify persistence
        r = requests.get(f"{API}/customers/{cid}", headers=auth_headers, timeout=30)
        assert r.json()["name"] == "TEST_Cliente_Upd"

        # Delete
        r = requests.delete(f"{API}/customers/{cid}", headers=auth_headers, timeout=30)
        assert r.status_code == 200
        r = requests.get(f"{API}/customers/{cid}", headers=auth_headers, timeout=30)
        assert r.status_code == 404


# ============ REPAIRS ============
class TestRepairs:
    def test_repair_lifecycle(self, auth_headers):
        # Create customer first
        cust = requests.post(f"{API}/customers", json={"name": "TEST_RepCust", "phone": "+549222"}, headers=auth_headers, timeout=30).json()

        payload = {
            "customer_id": cust["id"], "customer_name": cust["name"],
            "device_brand": "Apple", "device_model": "iPhone 12",
            "device_imei": f"IMEI{uuid.uuid4().hex[:10]}",
            "reported_issue": "Pantalla rota", "budget_estimate": 150.0
        }
        r = requests.post(f"{API}/repairs", json=payload, headers=auth_headers, timeout=30)
        assert r.status_code == 200, r.text
        data = r.json()
        rid = data["id"]
        assert data["ticket_number"].startswith("REP-")
        assert data["status"] == "received"

        # List
        r = requests.get(f"{API}/repairs", headers=auth_headers, timeout=30)
        assert r.status_code == 200

        # Filter by status
        r = requests.get(f"{API}/repairs?status=received", headers=auth_headers, timeout=30)
        assert r.status_code == 200
        assert all(rep["status"] == "received" for rep in r.json())

        # Update status -> completed (should set completed_date)
        r = requests.patch(f"{API}/repairs/{rid}", json={"status": "completed", "diagnosis": "Reemplazo"}, headers=auth_headers, timeout=30)
        assert r.status_code == 200
        assert r.json()["status"] == "completed"
        assert r.json()["completed_date"] is not None

        # Update status -> delivered
        r = requests.patch(f"{API}/repairs/{rid}", json={"status": "delivered"}, headers=auth_headers, timeout=30)
        assert r.status_code == 200
        assert r.json()["delivered_date"] is not None

        # Delete
        r = requests.delete(f"{API}/repairs/{rid}", headers=auth_headers, timeout=30)
        assert r.status_code == 200
        requests.delete(f"{API}/customers/{cust['id']}", headers=auth_headers, timeout=30)

    def test_repair_not_found(self, auth_headers):
        r = requests.get(f"{API}/repairs/nonexistent-id", headers=auth_headers, timeout=30)
        assert r.status_code == 404


# ============ INVENTORY ============
class TestInventory:
    def test_inventory_crud(self, auth_headers):
        payload = {"name": "TEST_Pantalla", "code": f"TST{uuid.uuid4().hex[:6]}", "quantity": 10, "price": 99.5, "location": "A1", "min_stock": 3}
        r = requests.post(f"{API}/inventory", json=payload, headers=auth_headers, timeout=30)
        assert r.status_code == 200, r.text
        iid = r.json()["id"]
        assert r.json()["quantity"] == 10

        # Get
        r = requests.get(f"{API}/inventory/{iid}", headers=auth_headers, timeout=30)
        assert r.status_code == 200

        # List
        r = requests.get(f"{API}/inventory", headers=auth_headers, timeout=30)
        assert r.status_code == 200

        # Update
        r = requests.patch(f"{API}/inventory/{iid}", json={"quantity": 2}, headers=auth_headers, timeout=30)
        assert r.status_code == 200
        assert r.json()["quantity"] == 2

        # Delete
        r = requests.delete(f"{API}/inventory/{iid}", headers=auth_headers, timeout=30)
        assert r.status_code == 200


# ============ DASHBOARD ============
class TestDashboard:
    def test_dashboard_stats(self, auth_headers):
        r = requests.get(f"{API}/dashboard/stats", headers=auth_headers, timeout=30)
        assert r.status_code == 200, r.text
        d = r.json()
        for key in ["total_repairs", "active_repairs", "completed_today", "pending_delivery", "low_stock_items", "repairs_by_status", "weekly_repairs"]:
            assert key in d
        assert isinstance(d["weekly_repairs"], list)
        assert isinstance(d["repairs_by_status"], dict)


# ============ SEARCH ============
class TestSearch:
    def test_global_search(self, auth_headers):
        r = requests.get(f"{API}/search?q=test", headers=auth_headers, timeout=30)
        assert r.status_code == 200
        d = r.json()
        assert "repairs" in d and "customers" in d and "inventory" in d

    def test_search_requires_auth(self):
        r = requests.get(f"{API}/search?q=test", timeout=30)
        assert r.status_code in (401, 403)
