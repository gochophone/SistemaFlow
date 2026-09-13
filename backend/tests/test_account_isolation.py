"""Integration tests; requires a disposable MongoDB at TEST_MONGO_URL.
Never points to Railway/Atlas or the legacy test suite's external URL.
"""
import os
import sys
import uuid
from pathlib import Path
import pytest
from pymongo import MongoClient
from fastapi.testclient import TestClient

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
TEST_URI = os.environ.get("TEST_MONGO_URL", "mongodb://127.0.0.1:18770")
os.environ["MONGO_URL"] = TEST_URI
os.environ["DB_NAME"] = "sf_test_" + uuid.uuid4().hex
os.environ["JWT_SECRET"] = "test-isolation-secret-not-for-production-123456789"
import server
from migrate_account_databases import migrate

@pytest.fixture(scope="session")
def api():
    with TestClient(server.app) as app:
        yield app
    with MongoClient(TEST_URI) as mongo:
        for tenant in mongo[os.environ['DB_NAME']].tenants.find():
            mongo.drop_database(server.database_name(tenant['_id']))
        mongo.drop_database(os.environ['DB_NAME'])

def account(api, label):
    email = f"{label}-{uuid.uuid4().hex}@example.com"
    credentials = {"email": email, "password": "Password123!"}
    r = api.post('/api/auth/register', json={**credentials, 'name': label, 'company_name': label})
    assert r.status_code == 200, r.text
    login = api.post('/api/auth/login', json=credentials)
    assert login.status_code == 200, login.text
    return login.json()['user'], {'Authorization': 'Bearer ' + login.json()['token']}

def test_physical_isolation_roles_and_public_links(api):
    a, ah = account(api, 'Alpha')
    b, bh = account(api, 'Beta')
    assert a['is_owner'] and a['tenant_id'] != b['tenant_id']
    mongo = MongoClient(TEST_URI)
    da, db = mongo[server.database_name(a['tenant_id'])], mongo[server.database_name(b['tenant_id'])]
    customer_a = api.post('/api/customers', headers=ah, json={'name':'Alpha customer', 'phone':'123'}).json()
    customer_b = api.post('/api/customers', headers=bh, json={'name':'Beta customer', 'phone':'456'}).json()
    assert da.customers.count_documents({}) == db.customers.count_documents({}) == 1
    assert mongo[os.environ['DB_NAME']].customers.count_documents({}) == 0
    assert api.get('/api/customers',headers=ah).json()[0]['name']=='Alpha customer'
    assert api.get('/api/customers/'+customer_b['id'],headers=ah).status_code == 404
    assert api.put('/api/customers/'+customer_b['id'],headers=ah,json={'name':'intruder','phone':'0'}).status_code==404
    assert api.delete('/api/customers/'+customer_b['id'],headers=ah).status_code==404
    repair_data={'customer_id':customer_a['id'],'customer_name':'Alpha customer','device_brand':'Apple','device_model':'Phone','device_imei':'123','reported_issue':'screen'}
    ra=api.post('/api/repairs',headers=ah,json=repair_data)
    assert ra.status_code==200,ra.text
    rb=api.post('/api/repairs',headers=bh,json={**repair_data,'customer_id':customer_b['id'],'customer_name':'Beta customer'})
    assert rb.status_code==200,rb.text
    ra,rb=ra.json(),rb.json()
    assert ra['ticket_number']==rb['ticket_number']
    assert ra['public_token']!=rb['public_token']
    assert api.get('/api/repairs/'+rb['id'],headers=ah).status_code==404
    assert api.get('/api/repairs/'+rb['id']+'/delivery-pdf',headers=ah).status_code==404
    assert api.patch('/api/repairs/'+rb['id'],headers=ah,json={'status':'completed'}).status_code==404
    assert api.delete('/api/repairs/'+rb['id'],headers=ah).status_code==404
    assert api.get('/public/repair/'+ra['public_token']).json()['customer_name']=='Alpha customer'
    assert api.get('/public/repair/'+rb['public_token']).json()['customer_name']=='Beta customer'
    assert api.get('/public/repair/'+ra['ticket_number']).status_code==404
    admin_email=f"admin-{uuid.uuid4().hex}@example.com"
    technician_email=f"tech-{uuid.uuid4().hex}@example.com"
    users={}
    for role,email in [('admin',admin_email),('technician',technician_email)]:
        r=api.post('/api/team',headers=ah,json={'name':role,'email':email,'password':'Password123!','role':role})
        assert r.status_code==201,r.text
        assert r.json()['tenant_id']==a['tenant_id'] and not r.json()['is_owner']
        login=api.post('/api/auth/login',json={'email':email,'password':'Password123!'})
        users[role]=(r.json(),{'Authorization':'Bearer '+login.json()['token']})
    tech,th=users['technician']; admin,adm_h=users['admin']
    assert api.get('/api/customers',headers=th).json()[0]['name']=='Alpha customer'
    assert len(api.get('/api/team',headers=ah).json())==3
    assert len(api.get('/api/team',headers=bh).json())==1
    assert api.get('/api/team',headers=th).status_code==403
    assert api.post('/api/team',headers=th,json={'name':'x','email':'x@example.com','password':'Password123!','role':'admin'}).status_code==403
    assert api.post('/api/team',headers=ah,json={'name':'x','email':'x@example.com','password':'Password123!','role':'admin','tenant_id':b['tenant_id']}).status_code==422
    item={'name':'screen','code':'SCR','quantity':1,'min_stock':1,'price':100}
    ir=api.post('/api/inventory',headers=adm_h,json=item)
    assert ir.status_code==200,ir.text
    inventory_id=ir.json()['id']
    assert api.get('/api/inventory',headers=bh).json()==[]
    assert api.get('/api/inventory/'+inventory_id,headers=bh).status_code==404
    for method,path,payload in [('get','/api/inventory',None),('post','/api/inventory',item),('get','/api/inventory/'+inventory_id,None),('patch','/api/inventory/'+inventory_id,{'quantity':2}),('delete','/api/inventory/'+inventory_id,None)]:
        response=api.request(method,path,headers=th,json=payload)
        assert response.status_code==403,(method,response.text)
    assert api.get('/api/cloudinary/signature?folder=inventory',headers=th).status_code==403
    search=api.get('/api/search?q=',headers=th).json()
    assert search['inventory']==[] and all(c['tenant_id']==a['tenant_id'] for c in search['customers'])
    assert api.get('/api/dashboard/stats',headers=th).json()['low_stock_items'] is None
    assert api.get('/api/dashboard/stats',headers=ah).json()['low_stock_items']==1
    # Signed old claims cannot override current server-side membership or role.
    forged_claims=server.create_token(tech['id'],tech['email'],'admin',b['tenant_id'])
    fh={'Authorization':'Bearer '+forged_claims}
    assert api.get('/api/inventory',headers=fh).status_code==403
    assert api.get('/api/customers',headers=fh).json()[0]['tenant_id']==a['tenant_id']
    assert api.patch('/api/team/'+tech['id'],headers=bh,json={'role':'admin'}).status_code==404
    assert api.patch('/api/team/'+a['id'],headers=adm_h,json={'active':False}).status_code==403
    assert api.patch('/api/team/'+admin['id'],headers=ah,json={'role':'technician'}).status_code==200
    assert api.get('/api/inventory',headers=adm_h).status_code==403
    assert api.patch('/api/team/'+tech['id'],headers=ah,json={'active':False}).status_code==200
    assert api.get('/api/customers',headers=th).status_code==401
    assert api.post('/api/auth/login',json={'email':technician_email,'password':'Password123!'}).status_code==401
    assert api.delete('/api/repairs/'+ra['id'],headers=ah).status_code==200
    assert api.get('/public/repair/'+ra['public_token']).status_code==404
    mongo.close()

def test_migration_copies_preserves_and_is_idempotent():
    mongo=MongoClient(TEST_URI)
    directory='sf_migration_test_'+uuid.uuid4().hex
    control=mongo[directory]
    tid='legacy_'+uuid.uuid4().hex
    try:
        control.users.insert_one({'id':'owner','tenant_id':tid,'email':'OWNER@example.com','role':'admin'})
        for name in ('customers','repairs','inventory'):
            control[name].insert_one({'id':name,'tenant_id':tid,'name':'original','ticket_number':'REP-00007'})
        assert migrate(mongo,directory)[0]['status']=='dry_run'
        assert control.tenants.count_documents({})==0
        assert migrate(mongo,directory,True)[0]['status']=='copy'
        target=mongo[server.database_name(tid)]
        assert target.customers.find_one()['name']=='original'
        assert control.customers.count_documents({})==1
        assert control.users.find_one()['is_owner'] is True
        assert control.users.find_one()['email']=='owner@example.com'
        assert target.counters.find_one()['value']==7
        assert control.public_links.count_documents({})==1
        target.customers.update_one({}, {'$set':{'name':'new data'}})
        assert migrate(mongo,directory,True)[0]['status']=='already_migrated'
        assert target.customers.find_one()['name']=='new data'
        control.inventory.insert_one({'id':'orphan'})
        with pytest.raises(RuntimeError): migrate(mongo,directory,True)
    finally:
        mongo.drop_database(directory);mongo.drop_database(server.database_name(tid));mongo.close()

import os
from datetime import datetime, timezone
from pymongo import MongoClient
import billing


def test_calendar_month():
    assert billing.month_after(datetime(2024, 1, 31, tzinfo=timezone.utc)).day == 29
    assert billing.month_after(datetime(2025, 12, 31, tzinfo=timezone.utc)).year == 2026


def test_billing_authorization_and_renewal(api):
    owner, headers = account(api, 'billing')
    other, oh = account(api, 'other')
    manager, mh = account(api, 'manager')
    os.environ['BILLING_ADMIN_USER_IDS'] = manager['id']
    bank = dict(holder='Test company', rut='test', bank='Test bank', account_type='Current', account_number='000')
    assert api.put('/api/billing/bank', headers=headers, json=bank).status_code == 403
    assert api.put('/api/billing/bank', headers=mh, json=bank).status_code == 200
    before = api.get('/api/billing', headers=headers).json()
    assert before['active'] and not before['is_manager']
    assert api.get('/api/billing/admin', headers=headers).status_code == 403
    tech_email = 'tech-' + owner['id'] + '@example.com'
    assert api.post('/api/team', headers=headers, json=dict(email=tech_email, name='Tech', password='Password123!', role='technician')).status_code == 201
    th = {'Authorization': 'Bearer ' + api.post('/api/auth/login', json=dict(email=tech_email, password='Password123!')).json()['token']}
    assert api.get('/api/billing', headers=th).json()['bank'] is None
    assert api.post('/api/billing/report', headers=th, json={'reference': 'test'}).status_code == 403
    with MongoClient(TEST_URI) as mongo:
        db = mongo[os.environ['DB_NAME']]
        db.subscriptions.update_one({'_id': owner['tenant_id']}, {'$set': {'expires_at': '2020-01-01T00:00:00+00:00'}})
        for h in (headers, th):
            for path in ('/customers', '/repairs', '/inventory', '/team'):
                assert api.get('/api' + path, headers=h).status_code == 402
            assert api.get('/api/auth/me', headers=h).status_code == 200
            assert api.get('/api/billing', headers=h).json()['active'] is False
        assert api.get('/api/customers', headers=oh).status_code == 200
        assert api.post('/api/customers', headers=headers, json={'name': 'Blocked', 'phone': '123'}).status_code == 402
        assert api.post('/api/billing/report', headers=headers, json={'reference': 'Test', 'tenant_id': other['tenant_id']}).status_code == 422
        assert api.post('/api/billing/report', headers=headers, json={'reference': 'Test transfer'}).status_code == 200
        assert api.post('/api/billing/report', headers=headers, json={'reference': 'Duplicate'}).status_code == 409
        reported = api.get('/api/billing', headers=headers).json()
        assert not reported['active']
        rid = reported['pending']['id']
        route = f"/api/billing/admin/{owner['tenant_id']}/{rid}"
        assert api.post(route, headers=headers, json={'approve': True, 'note': 'Fake'}).status_code == 403
        assert api.post(route, headers=mh, json={'approve': True, 'note': 'Verified'}).status_code == 200
        renewed = api.get('/api/billing', headers=headers).json()
        assert renewed['active'] and renewed['pending'] is None
        assert api.get('/api/customers', headers=th).status_code == 200
        assert api.post(route, headers=mh, json={'approve': True, 'note': 'Duplicate'}).status_code == 200
        assert api.get('/api/billing', headers=headers).json()['expires_at'] == renewed['expires_at']
        assert len(db.subscriptions.find_one({'_id': owner['tenant_id']})['history']) == 1
        assert api.get('/api/billing', headers=oh).json()['expires_at'] != renewed['expires_at']
        assert api.post('/api/billing/report', headers=headers, json={'reference': 'Rejected transfer'}).status_code == 200
        rid = api.get('/api/billing', headers=headers).json()['pending']['id']
        assert api.post(f"/api/billing/admin/{owner['tenant_id']}/{rid}", headers=mh, json={'approve': False, 'note': 'Not received'}).status_code == 200
        assert api.get('/api/billing', headers=headers).json()['expires_at'] == renewed['expires_at']
    os.environ.pop('BILLING_ADMIN_USER_IDS')
