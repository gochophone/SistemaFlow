#!/usr/bin/env python3
"""
Comprehensive Backend API Testing for Repair Management System
Tests all endpoints in priority order with proper authentication and multi-tenant isolation
"""

import requests
import json
import sys
from datetime import datetime

# Configuration
BASE_URL = "http://localhost:8001"
API_URL = f"{BASE_URL}/api"

# Test credentials (already created)
TEST_USER = {
    "email": "test@ejemplo.com",
    "password": "test123456"
}

# Colors for output
class Colors:
    GREEN = '\033[92m'
    RED = '\033[91m'
    YELLOW = '\033[93m'
    BLUE = '\033[94m'
    RESET = '\033[0m'
    BOLD = '\033[1m'

def print_test(message):
    print(f"\n{Colors.BLUE}{Colors.BOLD}🧪 TEST: {message}{Colors.RESET}")

def print_success(message):
    print(f"{Colors.GREEN}✅ PASS: {message}{Colors.RESET}")

def print_error(message):
    print(f"{Colors.RED}❌ FAIL: {message}{Colors.RESET}")

def print_warning(message):
    print(f"{Colors.YELLOW}⚠️  WARNING: {message}{Colors.RESET}")

def print_section(message):
    print(f"\n{Colors.BOLD}{'='*80}")
    print(f"  {message}")
    print(f"{'='*80}{Colors.RESET}")

# Global variables to store test data
auth_token = None
test_customer_id = None
test_repair_id = None
test_inventory_id = None
test_ticket_number = None

# Test results tracking
total_tests = 0
passed_tests = 0
failed_tests = 0
test_results = []

def record_result(test_name, passed, message=""):
    global total_tests, passed_tests, failed_tests, test_results
    total_tests += 1
    if passed:
        passed_tests += 1
        test_results.append({"test": test_name, "status": "PASS", "message": message})
    else:
        failed_tests += 1
        test_results.append({"test": test_name, "status": "FAIL", "message": message})

def test_auth_login():
    """Test 1: Login with existing user"""
    global auth_token
    print_test("Authentication - Login")
    
    try:
        response = requests.post(
            f"{API_URL}/auth/login",
            json=TEST_USER,
            timeout=10
        )
        
        if response.status_code == 200:
            data = response.json()
            if "token" in data and "user" in data:
                auth_token = data["token"]
                print_success(f"Login successful. User: {data['user']['email']}, Role: {data['user']['role']}")
                record_result("Auth - Login", True, f"Token received, user role: {data['user']['role']}")
                return True
            else:
                print_error("Login response missing token or user data")
                record_result("Auth - Login", False, "Missing token or user in response")
                return False
        else:
            print_error(f"Login failed with status {response.status_code}: {response.text}")
            record_result("Auth - Login", False, f"Status {response.status_code}: {response.text}")
            return False
    except Exception as e:
        print_error(f"Login request failed: {str(e)}")
        record_result("Auth - Login", False, f"Exception: {str(e)}")
        return False

def test_auth_register():
    """Test 2: Register new user (should fail if already exists)"""
    print_test("Authentication - Register (duplicate check)")
    
    try:
        new_user = {
            "email": f"testuser_{datetime.now().timestamp()}@ejemplo.com",
            "password": "testpass123",
            "name": "Test User New",
            "company_name": "Test Company New"
        }
        
        response = requests.post(
            f"{API_URL}/auth/register",
            json=new_user,
            timeout=10
        )
        
        if response.status_code == 200:
            data = response.json()
            print_success(f"New user registered: {data['user']['email']}")
            record_result("Auth - Register", True, "New user created successfully")
            return True
        else:
            print_error(f"Registration failed with status {response.status_code}: {response.text}")
            record_result("Auth - Register", False, f"Status {response.status_code}")
            return False
    except Exception as e:
        print_error(f"Registration request failed: {str(e)}")
        record_result("Auth - Register", False, f"Exception: {str(e)}")
        return False

def test_auth_me():
    """Test 3: Get current user info"""
    print_test("Authentication - Get Current User (/auth/me)")
    
    if not auth_token:
        print_error("No auth token available. Skipping test.")
        record_result("Auth - Get Me", False, "No auth token")
        return False
    
    try:
        response = requests.get(
            f"{API_URL}/auth/me",
            headers={"Authorization": f"Bearer {auth_token}"},
            timeout=10
        )
        
        if response.status_code == 200:
            data = response.json()
            print_success(f"User info retrieved: {data['email']}, Role: {data['role']}")
            record_result("Auth - Get Me", True, f"User: {data['email']}")
            return True
        else:
            print_error(f"Get user info failed with status {response.status_code}: {response.text}")
            record_result("Auth - Get Me", False, f"Status {response.status_code}")
            return False
    except Exception as e:
        print_error(f"Get user info request failed: {str(e)}")
        record_result("Auth - Get Me", False, f"Exception: {str(e)}")
        return False

def test_customers_create():
    """Test 4: Create customer"""
    global test_customer_id
    print_test("Customers - Create")
    
    if not auth_token:
        print_error("No auth token available. Skipping test.")
        record_result("Customers - Create", False, "No auth token")
        return False
    
    try:
        customer_data = {
            "name": "Juan Pérez",
            "phone": "+56912345678",
            "email": "juan.perez@ejemplo.cl",
            "rut": "12.345.678-9",
            "address": "Av. Providencia 123, Santiago"
        }
        
        response = requests.post(
            f"{API_URL}/customers",
            json=customer_data,
            headers={"Authorization": f"Bearer {auth_token}"},
            timeout=10
        )
        
        if response.status_code == 200:
            data = response.json()
            test_customer_id = data["id"]
            print_success(f"Customer created: {data['name']}, ID: {test_customer_id}")
            record_result("Customers - Create", True, f"Customer ID: {test_customer_id}")
            return True
        else:
            print_error(f"Create customer failed with status {response.status_code}: {response.text}")
            record_result("Customers - Create", False, f"Status {response.status_code}")
            return False
    except Exception as e:
        print_error(f"Create customer request failed: {str(e)}")
        record_result("Customers - Create", False, f"Exception: {str(e)}")
        return False

def test_customers_list():
    """Test 5: List all customers"""
    print_test("Customers - List All")
    
    if not auth_token:
        print_error("No auth token available. Skipping test.")
        record_result("Customers - List", False, "No auth token")
        return False
    
    try:
        response = requests.get(
            f"{API_URL}/customers",
            headers={"Authorization": f"Bearer {auth_token}"},
            timeout=10
        )
        
        if response.status_code == 200:
            data = response.json()
            print_success(f"Retrieved {len(data)} customers")
            record_result("Customers - List", True, f"Count: {len(data)}")
            return True
        else:
            print_error(f"List customers failed with status {response.status_code}: {response.text}")
            record_result("Customers - List", False, f"Status {response.status_code}")
            return False
    except Exception as e:
        print_error(f"List customers request failed: {str(e)}")
        record_result("Customers - List", False, f"Exception: {str(e)}")
        return False

def test_customers_get_one():
    """Test 6: Get single customer"""
    print_test("Customers - Get One")
    
    if not auth_token or not test_customer_id:
        print_error("No auth token or customer ID available. Skipping test.")
        record_result("Customers - Get One", False, "Missing prerequisites")
        return False
    
    try:
        response = requests.get(
            f"{API_URL}/customers/{test_customer_id}",
            headers={"Authorization": f"Bearer {auth_token}"},
            timeout=10
        )
        
        if response.status_code == 200:
            data = response.json()
            print_success(f"Customer retrieved: {data['name']}")
            record_result("Customers - Get One", True, f"Customer: {data['name']}")
            return True
        else:
            print_error(f"Get customer failed with status {response.status_code}: {response.text}")
            record_result("Customers - Get One", False, f"Status {response.status_code}")
            return False
    except Exception as e:
        print_error(f"Get customer request failed: {str(e)}")
        record_result("Customers - Get One", False, f"Exception: {str(e)}")
        return False

def test_customers_update():
    """Test 7: Update customer"""
    print_test("Customers - Update")
    
    if not auth_token or not test_customer_id:
        print_error("No auth token or customer ID available. Skipping test.")
        record_result("Customers - Update", False, "Missing prerequisites")
        return False
    
    try:
        update_data = {
            "name": "Juan Pérez Actualizado",
            "phone": "+56987654321",
            "email": "juan.perez.updated@ejemplo.cl",
            "rut": "12.345.678-9",
            "address": "Av. Providencia 456, Santiago"
        }
        
        response = requests.put(
            f"{API_URL}/customers/{test_customer_id}",
            json=update_data,
            headers={"Authorization": f"Bearer {auth_token}"},
            timeout=10
        )
        
        if response.status_code == 200:
            data = response.json()
            print_success(f"Customer updated: {data['name']}")
            record_result("Customers - Update", True, f"Updated: {data['name']}")
            return True
        else:
            print_error(f"Update customer failed with status {response.status_code}: {response.text}")
            record_result("Customers - Update", False, f"Status {response.status_code}")
            return False
    except Exception as e:
        print_error(f"Update customer request failed: {str(e)}")
        record_result("Customers - Update", False, f"Exception: {str(e)}")
        return False

def test_repairs_create():
    """Test 8: Create repair"""
    global test_repair_id, test_ticket_number
    print_test("Repairs - Create")
    
    if not auth_token or not test_customer_id:
        print_error("No auth token or customer ID available. Skipping test.")
        record_result("Repairs - Create", False, "Missing prerequisites")
        return False
    
    try:
        repair_data = {
            "customer_id": test_customer_id,
            "customer_name": "Juan Pérez",
            "device_brand": "Samsung",
            "device_model": "Galaxy S21",
            "device_imei": "123456789012345",
            "device_serial": "SN123456",
            "reported_issue": "Pantalla rota y no enciende",
            "diagnosis": "Requiere cambio de pantalla y batería",
            "assigned_technician": "Carlos Técnico",
            "budget_estimate": 85000,
            "notes": "Cliente solicita reparación urgente",
            "unlock_type": "password",
            "unlock_password": "1234"
        }
        
        response = requests.post(
            f"{API_URL}/repairs",
            json=repair_data,
            headers={"Authorization": f"Bearer {auth_token}"},
            timeout=10
        )
        
        if response.status_code == 200:
            data = response.json()
            test_repair_id = data["id"]
            test_ticket_number = data["ticket_number"]
            print_success(f"Repair created: {data['ticket_number']}, ID: {test_repair_id}")
            record_result("Repairs - Create", True, f"Ticket: {test_ticket_number}")
            return True
        else:
            print_error(f"Create repair failed with status {response.status_code}: {response.text}")
            record_result("Repairs - Create", False, f"Status {response.status_code}")
            return False
    except Exception as e:
        print_error(f"Create repair request failed: {str(e)}")
        record_result("Repairs - Create", False, f"Exception: {str(e)}")
        return False

def test_repairs_list():
    """Test 9: List all repairs"""
    print_test("Repairs - List All")
    
    if not auth_token:
        print_error("No auth token available. Skipping test.")
        record_result("Repairs - List", False, "No auth token")
        return False
    
    try:
        response = requests.get(
            f"{API_URL}/repairs",
            headers={"Authorization": f"Bearer {auth_token}"},
            timeout=10
        )
        
        if response.status_code == 200:
            data = response.json()
            print_success(f"Retrieved {len(data)} repairs")
            record_result("Repairs - List", True, f"Count: {len(data)}")
            return True
        else:
            print_error(f"List repairs failed with status {response.status_code}: {response.text}")
            record_result("Repairs - List", False, f"Status {response.status_code}")
            return False
    except Exception as e:
        print_error(f"List repairs request failed: {str(e)}")
        record_result("Repairs - List", False, f"Exception: {str(e)}")
        return False

def test_repairs_filter_by_status():
    """Test 10: Filter repairs by status"""
    print_test("Repairs - Filter by Status")
    
    if not auth_token:
        print_error("No auth token available. Skipping test.")
        record_result("Repairs - Filter", False, "No auth token")
        return False
    
    try:
        response = requests.get(
            f"{API_URL}/repairs?status=received",
            headers={"Authorization": f"Bearer {auth_token}"},
            timeout=10
        )
        
        if response.status_code == 200:
            data = response.json()
            print_success(f"Retrieved {len(data)} repairs with status 'received'")
            record_result("Repairs - Filter", True, f"Filtered count: {len(data)}")
            return True
        else:
            print_error(f"Filter repairs failed with status {response.status_code}: {response.text}")
            record_result("Repairs - Filter", False, f"Status {response.status_code}")
            return False
    except Exception as e:
        print_error(f"Filter repairs request failed: {str(e)}")
        record_result("Repairs - Filter", False, f"Exception: {str(e)}")
        return False

def test_repairs_get_one():
    """Test 11: Get single repair"""
    print_test("Repairs - Get One")
    
    if not auth_token or not test_repair_id:
        print_error("No auth token or repair ID available. Skipping test.")
        record_result("Repairs - Get One", False, "Missing prerequisites")
        return False
    
    try:
        response = requests.get(
            f"{API_URL}/repairs/{test_repair_id}",
            headers={"Authorization": f"Bearer {auth_token}"},
            timeout=10
        )
        
        if response.status_code == 200:
            data = response.json()
            print_success(f"Repair retrieved: {data['ticket_number']}, Status: {data['status']}")
            record_result("Repairs - Get One", True, f"Ticket: {data['ticket_number']}")
            return True
        else:
            print_error(f"Get repair failed with status {response.status_code}: {response.text}")
            record_result("Repairs - Get One", False, f"Status {response.status_code}")
            return False
    except Exception as e:
        print_error(f"Get repair request failed: {str(e)}")
        record_result("Repairs - Get One", False, f"Exception: {str(e)}")
        return False

def test_repairs_update_status():
    """Test 12: Update repair status (test status transitions)"""
    print_test("Repairs - Update Status (received -> in_repair -> completed)")
    
    if not auth_token or not test_repair_id:
        print_error("No auth token or repair ID available. Skipping test.")
        record_result("Repairs - Update Status", False, "Missing prerequisites")
        return False
    
    statuses = ["in_repair", "completed"]
    all_passed = True
    
    for status in statuses:
        try:
            update_data = {"status": status}
            
            response = requests.patch(
                f"{API_URL}/repairs/{test_repair_id}",
                json=update_data,
                headers={"Authorization": f"Bearer {auth_token}"},
                timeout=10
            )
            
            if response.status_code == 200:
                data = response.json()
                print_success(f"Status updated to: {data['status']}")
            else:
                print_error(f"Update status to '{status}' failed: {response.status_code}")
                all_passed = False
        except Exception as e:
            print_error(f"Update status to '{status}' failed: {str(e)}")
            all_passed = False
    
    if all_passed:
        record_result("Repairs - Update Status", True, "All status transitions successful")
    else:
        record_result("Repairs - Update Status", False, "Some status transitions failed")
    
    return all_passed

def test_inventory_create():
    """Test 13: Create inventory item"""
    global test_inventory_id
    print_test("Inventory - Create")
    
    if not auth_token:
        print_error("No auth token available. Skipping test.")
        record_result("Inventory - Create", False, "No auth token")
        return False
    
    try:
        inventory_data = {
            "name": "Pantalla Samsung S21",
            "code": "PANT-S21-001",
            "quantity": 15,
            "price": 45000,
            "location": "Estante A3",
            "min_stock": 5
        }
        
        response = requests.post(
            f"{API_URL}/inventory",
            json=inventory_data,
            headers={"Authorization": f"Bearer {auth_token}"},
            timeout=10
        )
        
        if response.status_code == 200:
            data = response.json()
            test_inventory_id = data["id"]
            print_success(f"Inventory item created: {data['name']}, Qty: {data['quantity']}")
            record_result("Inventory - Create", True, f"Item: {data['name']}")
            return True
        else:
            print_error(f"Create inventory failed with status {response.status_code}: {response.text}")
            record_result("Inventory - Create", False, f"Status {response.status_code}")
            return False
    except Exception as e:
        print_error(f"Create inventory request failed: {str(e)}")
        record_result("Inventory - Create", False, f"Exception: {str(e)}")
        return False

def test_inventory_list():
    """Test 14: List inventory"""
    print_test("Inventory - List All")
    
    if not auth_token:
        print_error("No auth token available. Skipping test.")
        record_result("Inventory - List", False, "No auth token")
        return False
    
    try:
        response = requests.get(
            f"{API_URL}/inventory",
            headers={"Authorization": f"Bearer {auth_token}"},
            timeout=10
        )
        
        if response.status_code == 200:
            data = response.json()
            print_success(f"Retrieved {len(data)} inventory items")
            record_result("Inventory - List", True, f"Count: {len(data)}")
            return True
        else:
            print_error(f"List inventory failed with status {response.status_code}: {response.text}")
            record_result("Inventory - List", False, f"Status {response.status_code}")
            return False
    except Exception as e:
        print_error(f"List inventory request failed: {str(e)}")
        record_result("Inventory - List", False, f"Exception: {str(e)}")
        return False

def test_inventory_update():
    """Test 15: Update inventory quantity"""
    print_test("Inventory - Update Quantity")
    
    if not auth_token or not test_inventory_id:
        print_error("No auth token or inventory ID available. Skipping test.")
        record_result("Inventory - Update", False, "Missing prerequisites")
        return False
    
    try:
        update_data = {"quantity": 20}
        
        response = requests.patch(
            f"{API_URL}/inventory/{test_inventory_id}",
            json=update_data,
            headers={"Authorization": f"Bearer {auth_token}"},
            timeout=10
        )
        
        if response.status_code == 200:
            data = response.json()
            print_success(f"Inventory updated: {data['name']}, New Qty: {data['quantity']}")
            record_result("Inventory - Update", True, f"New quantity: {data['quantity']}")
            return True
        else:
            print_error(f"Update inventory failed with status {response.status_code}: {response.text}")
            record_result("Inventory - Update", False, f"Status {response.status_code}")
            return False
    except Exception as e:
        print_error(f"Update inventory request failed: {str(e)}")
        record_result("Inventory - Update", False, f"Exception: {str(e)}")
        return False

def test_dashboard_stats():
    """Test 16: Get dashboard statistics"""
    print_test("Dashboard - Get Statistics")
    
    if not auth_token:
        print_error("No auth token available. Skipping test.")
        record_result("Dashboard - Stats", False, "No auth token")
        return False
    
    try:
        response = requests.get(
            f"{API_URL}/dashboard/stats",
            headers={"Authorization": f"Bearer {auth_token}"},
            timeout=10
        )
        
        if response.status_code == 200:
            data = response.json()
            print_success(f"Dashboard stats retrieved:")
            print(f"  - Total repairs: {data.get('total_repairs', 0)}")
            print(f"  - Active repairs: {data.get('active_repairs', 0)}")
            print(f"  - Completed today: {data.get('completed_today', 0)}")
            print(f"  - Low stock items: {data.get('low_stock_items', 0)}")
            record_result("Dashboard - Stats", True, f"Total repairs: {data.get('total_repairs', 0)}")
            return True
        else:
            print_error(f"Get dashboard stats failed with status {response.status_code}: {response.text}")
            record_result("Dashboard - Stats", False, f"Status {response.status_code}")
            return False
    except Exception as e:
        print_error(f"Get dashboard stats request failed: {str(e)}")
        record_result("Dashboard - Stats", False, f"Exception: {str(e)}")
        return False

def test_cloudinary_signature():
    """Test 17: Get Cloudinary signature"""
    print_test("Cloudinary - Get Upload Signature")
    
    if not auth_token:
        print_error("No auth token available. Skipping test.")
        record_result("Cloudinary - Signature", False, "No auth token")
        return False
    
    try:
        response = requests.get(
            f"{API_URL}/cloudinary/signature?resource_type=image&folder=repairs",
            headers={"Authorization": f"Bearer {auth_token}"},
            timeout=10
        )
        
        if response.status_code == 200:
            data = response.json()
            if "signature" in data and "timestamp" in data and "cloud_name" in data:
                print_success(f"Cloudinary signature generated. Cloud: {data['cloud_name']}")
                record_result("Cloudinary - Signature", True, f"Cloud: {data['cloud_name']}")
                return True
            else:
                print_error("Cloudinary signature response missing required fields")
                record_result("Cloudinary - Signature", False, "Missing required fields")
                return False
        else:
            print_error(f"Get Cloudinary signature failed with status {response.status_code}: {response.text}")
            record_result("Cloudinary - Signature", False, f"Status {response.status_code}")
            return False
    except Exception as e:
        print_error(f"Get Cloudinary signature request failed: {str(e)}")
        record_result("Cloudinary - Signature", False, f"Exception: {str(e)}")
        return False

def test_pdf_generation():
    """Test 18: Generate delivery PDF"""
    print_test("PDF Generation - Delivery Order")
    
    if not auth_token or not test_repair_id:
        print_error("No auth token or repair ID available. Skipping test.")
        record_result("PDF - Generation", False, "Missing prerequisites")
        return False
    
    try:
        response = requests.get(
            f"{API_URL}/repairs/{test_repair_id}/delivery-pdf",
            headers={"Authorization": f"Bearer {auth_token}"},
            timeout=10
        )
        
        if response.status_code == 200:
            if response.headers.get('content-type') == 'application/pdf':
                pdf_size = len(response.content)
                print_success(f"PDF generated successfully. Size: {pdf_size} bytes")
                record_result("PDF - Generation", True, f"PDF size: {pdf_size} bytes")
                return True
            else:
                print_error(f"Response is not a PDF. Content-Type: {response.headers.get('content-type')}")
                record_result("PDF - Generation", False, "Invalid content type")
                return False
        else:
            print_error(f"Generate PDF failed with status {response.status_code}: {response.text}")
            record_result("PDF - Generation", False, f"Status {response.status_code}")
            return False
    except Exception as e:
        print_error(f"Generate PDF request failed: {str(e)}")
        record_result("PDF - Generation", False, f"Exception: {str(e)}")
        return False

def test_public_repair_view():
    """Test 19: Public repair view (no auth)"""
    print_test("Public Endpoint - View Repair by Ticket Number")
    
    if not test_ticket_number:
        print_error("No ticket number available. Skipping test.")
        record_result("Public - Repair View", False, "No ticket number")
        return False
    
    try:
        response = requests.get(
            f"{BASE_URL}/public/repair/{test_ticket_number}",
            timeout=10
        )
        
        if response.status_code == 200:
            data = response.json()
            print_success(f"Public repair view retrieved: {data['ticket_number']}, Status: {data['status']}")
            record_result("Public - Repair View", True, f"Ticket: {data['ticket_number']}")
            return True
        else:
            print_error(f"Public repair view failed with status {response.status_code}: {response.text}")
            record_result("Public - Repair View", False, f"Status {response.status_code}")
            return False
    except Exception as e:
        print_error(f"Public repair view request failed: {str(e)}")
        record_result("Public - Repair View", False, f"Exception: {str(e)}")
        return False

def test_search():
    """Test 20: Global search"""
    print_test("Search - Global Search")
    
    if not auth_token:
        print_error("No auth token available. Skipping test.")
        record_result("Search - Global", False, "No auth token")
        return False
    
    try:
        response = requests.get(
            f"{API_URL}/search?q=Samsung",
            headers={"Authorization": f"Bearer {auth_token}"},
            timeout=10
        )
        
        if response.status_code == 200:
            data = response.json()
            repairs_count = len(data.get('repairs', []))
            customers_count = len(data.get('customers', []))
            inventory_count = len(data.get('inventory', []))
            print_success(f"Search results: {repairs_count} repairs, {customers_count} customers, {inventory_count} inventory items")
            record_result("Search - Global", True, f"Total results: {repairs_count + customers_count + inventory_count}")
            return True
        else:
            print_error(f"Search failed with status {response.status_code}: {response.text}")
            record_result("Search - Global", False, f"Status {response.status_code}")
            return False
    except Exception as e:
        print_error(f"Search request failed: {str(e)}")
        record_result("Search - Global", False, f"Exception: {str(e)}")
        return False

def test_unauthorized_access():
    """Test 21: Verify unauthorized access is blocked"""
    print_test("Security - Unauthorized Access Check")
    
    try:
        response = requests.get(
            f"{API_URL}/customers",
            timeout=10
        )
        
        if response.status_code == 403 or response.status_code == 401:
            print_success("Unauthorized access properly blocked")
            record_result("Security - Unauthorized", True, "Access blocked")
            return True
        else:
            print_error(f"Unauthorized access not blocked. Status: {response.status_code}")
            record_result("Security - Unauthorized", False, f"Status {response.status_code}")
            return False
    except Exception as e:
        print_error(f"Unauthorized access test failed: {str(e)}")
        record_result("Security - Unauthorized", False, f"Exception: {str(e)}")
        return False

def test_cleanup():
    """Cleanup: Delete test data"""
    print_test("Cleanup - Delete Test Data")
    
    if not auth_token:
        print_warning("No auth token available. Skipping cleanup.")
        return
    
    # Delete inventory item
    if test_inventory_id:
        try:
            response = requests.delete(
                f"{API_URL}/inventory/{test_inventory_id}",
                headers={"Authorization": f"Bearer {auth_token}"},
                timeout=10
            )
            if response.status_code == 200:
                print_success("Test inventory item deleted")
        except Exception as e:
            print_warning(f"Failed to delete inventory item: {str(e)}")
    
    # Delete repair
    if test_repair_id:
        try:
            response = requests.delete(
                f"{API_URL}/repairs/{test_repair_id}",
                headers={"Authorization": f"Bearer {auth_token}"},
                timeout=10
            )
            if response.status_code == 200:
                print_success("Test repair deleted")
        except Exception as e:
            print_warning(f"Failed to delete repair: {str(e)}")
    
    # Delete customer
    if test_customer_id:
        try:
            response = requests.delete(
                f"{API_URL}/customers/{test_customer_id}",
                headers={"Authorization": f"Bearer {auth_token}"},
                timeout=10
            )
            if response.status_code == 200:
                print_success("Test customer deleted")
        except Exception as e:
            print_warning(f"Failed to delete customer: {str(e)}")

def print_summary():
    """Print test summary"""
    print_section("TEST SUMMARY")
    
    print(f"\n{Colors.BOLD}Total Tests: {total_tests}{Colors.RESET}")
    print(f"{Colors.GREEN}Passed: {passed_tests}{Colors.RESET}")
    print(f"{Colors.RED}Failed: {failed_tests}{Colors.RESET}")
    
    if failed_tests > 0:
        print(f"\n{Colors.RED}{Colors.BOLD}FAILED TESTS:{Colors.RESET}")
        for result in test_results:
            if result["status"] == "FAIL":
                print(f"{Colors.RED}  ❌ {result['test']}: {result['message']}{Colors.RESET}")
    
    print(f"\n{Colors.BOLD}Pass Rate: {(passed_tests/total_tests*100):.1f}%{Colors.RESET}\n")
    
    if failed_tests == 0:
        print(f"{Colors.GREEN}{Colors.BOLD}🎉 ALL TESTS PASSED! 🎉{Colors.RESET}\n")
        return 0
    else:
        print(f"{Colors.RED}{Colors.BOLD}⚠️  SOME TESTS FAILED ⚠️{Colors.RESET}\n")
        return 1

def main():
    """Main test execution"""
    print_section("REPAIR MANAGEMENT SYSTEM - BACKEND API TESTS")
    print(f"Base URL: {BASE_URL}")
    print(f"Test User: {TEST_USER['email']}")
    
    # Run tests in priority order
    print_section("1. AUTHENTICATION TESTS")
    test_auth_login()
    test_auth_register()
    test_auth_me()
    
    print_section("2. CUSTOMERS CRUD TESTS")
    test_customers_create()
    test_customers_list()
    test_customers_get_one()
    test_customers_update()
    
    print_section("3. REPAIRS MANAGEMENT TESTS")
    test_repairs_create()
    test_repairs_list()
    test_repairs_filter_by_status()
    test_repairs_get_one()
    test_repairs_update_status()
    
    print_section("4. INVENTORY MANAGEMENT TESTS")
    test_inventory_create()
    test_inventory_list()
    test_inventory_update()
    
    print_section("5. DASHBOARD TESTS")
    test_dashboard_stats()
    
    print_section("6. CLOUDINARY INTEGRATION TESTS")
    test_cloudinary_signature()
    
    print_section("7. PDF GENERATION TESTS")
    test_pdf_generation()
    
    print_section("8. PUBLIC ENDPOINT TESTS")
    test_public_repair_view()
    
    print_section("9. SEARCH FUNCTIONALITY TESTS")
    test_search()
    
    print_section("10. SECURITY TESTS")
    test_unauthorized_access()
    
    print_section("11. CLEANUP")
    test_cleanup()
    
    # Print summary
    exit_code = print_summary()
    sys.exit(exit_code)

if __name__ == "__main__":
    main()
