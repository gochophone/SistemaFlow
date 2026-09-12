"""Copy legacy business data into account databases. Stop all writers first.

Dry run by default; --apply copies and verifies before enabling routing.
Original collections are retained for recovery. Never rerun against live writers.
"""
import argparse
import hashlib
import os
import uuid
from pymongo import MongoClient

COLLECTIONS = ("customers", "repairs", "inventory")

def database_name(tenant_id):
    return "sf_" + hashlib.sha256(tenant_id.encode()).hexdigest()[:40]

def migrate(client, directory_name, apply=False):
    control = client[directory_name]
    users = list(control.users.find({}))
    emails = [u.get("email", "").strip().lower() for u in users]
    if any(not e for e in emails) or len(emails) != len(set(emails)):
        raise RuntimeError("Hay correos vacíos o duplicados; resolver antes de migrar.")
    if any(not u.get("tenant_id") or not u.get("id") for u in users):
        raise RuntimeError("Hay usuarios sin id/tenant_id. Se requiere asignación explícita.")
    tenants = {u["tenant_id"] for u in users}
    for collection in COLLECTIONS:
        if control[collection].count_documents({"tenant_id": {"$nin": list(tenants)}}):
            raise RuntimeError(f"{collection}: datos sin cuenta válida; migración detenida.")
    report = []
    for tenant_id in sorted(tenants):
        existing = control.tenants.find_one({"_id": tenant_id, "ready": True})
        if existing:
            report.append({"tenant_id": tenant_id, "status": "already_migrated"})
            continue
        members = [u for u in users if u["tenant_id"] == tenant_id]
        owners = [u for u in members if u.get("is_owner")]
        admins = sorted([u for u in members if u.get("role") == "admin"], key=lambda u: str(u.get("created_at", "")))
        if len(owners) > 1 or not (owners or admins):
            raise RuntimeError("Cada cuenta debe tener un propietario o administrador válido.")
        owner = (owners or admins)[0]
        counts = {name: control[name].count_documents({"tenant_id": tenant_id}) for name in COLLECTIONS}
        report.append({"tenant_id": tenant_id, "database": database_name(tenant_id), "counts": counts, "status": "copy" if apply else "dry_run"})
        if not apply:
            continue
        target = client[database_name(tenant_id)]
        max_ticket = 0
        for name in COLLECTIONS:
            for source in control[name].find({"tenant_id": tenant_id}):
                doc = dict(source)
                if name == "repairs":
                    previous = target.repairs.find_one({"_id": doc["_id"]})
                    doc["public_token"] = (previous or {}).get("public_token") or doc.get("public_token") or uuid.uuid4().hex
                    control.public_links.update_one({"token": doc["public_token"]}, {"$set": {"tenant_id": tenant_id, "repair_id": doc["id"]}}, upsert=True)
                    number = str(doc.get("ticket_number", "")).removeprefix("REP-")
                    if number.isdigit():
                        max_ticket = max(max_ticket, int(number))
                target[name].replace_one({"_id": doc["_id"]}, doc, upsert=True)
                stored = target[name].find_one({"_id": doc["_id"]})
                if any(stored.get(key) != value for key, value in source.items()):
                    raise RuntimeError(f"Falló verificación de copia: {name}")
            if target[name].count_documents({"tenant_id": tenant_id}) != counts[name]:
                raise RuntimeError(f"Conteo diferente: {name}")
        target.counters.update_one({"_id": "repair_number"}, {"$max": {"value": max_ticket}}, upsert=True)
        target.settings.update_one({"_id": "account"}, {"$set": {"owner_id": owner["id"], "company_name": owner.get("company_name", "")}}, upsert=True)
        for member in members:
            control.users.update_one({"_id": member["_id"]}, {"$set": {
                "email": member["email"].strip().lower(), "is_owner": member["id"] == owner["id"], "active": member.get("active", True)}})
        # This is the routing switch: only after all copies have been verified.
        control.tenants.update_one({"_id": tenant_id}, {"$set": {"owner_id": owner["id"], "ready": True}}, upsert=True)
    return report

if __name__ == "__main__":
    import json
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--apply", action="store_true")
    args = parser.parse_args()
    with MongoClient(os.environ["MONGO_URL"], serverSelectionTimeoutMS=10000) as client:
        print(json.dumps(migrate(client, os.environ["DB_NAME"], args.apply), indent=2))
