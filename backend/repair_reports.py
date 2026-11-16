"""Monthly repair and payment summaries for one business."""

from collections import defaultdict
from datetime import date, datetime, timezone
from zoneinfo import ZoneInfo


CHILE_TIME = ZoneInfo("America/Santiago")
REPAIRED = {"completed", "delivered"}
UNREPAIRED = {"not_repaired", "cancelled"}


def local_date(value):
    if not value:
        return None
    try:
        instant = value if isinstance(value, datetime) else datetime.fromisoformat(str(value).replace("Z", "+00:00"))
        if instant.tzinfo is None:
            instant = instant.replace(tzinfo=timezone.utc)
        return instant.astimezone(CHILE_TIME).date()
    except (TypeError, ValueError, OverflowError):
        return None


def amount(value):
    try:
        return max(0, round(float(value or 0)))
    except (TypeError, ValueError, OverflowError):
        return 0


def repair_value(repair):
    if repair.get("budget_estimate") is not None:
        return amount(repair["budget_estimate"])
    return sum(amount(item.get("amount")) for item in repair.get("budget_items") or [])


def repair_cost(repair):
    return sum(amount(item.get("cost_price")) for item in repair.get("budget_items") or [])


def completion_date(repair):
    status = repair.get("status")
    if status in REPAIRED:
        return local_date(repair.get("completed_date") or repair.get("delivered_date") or repair.get("updated_at"))
    if status in UNREPAIRED:
        return local_date(repair.get("updated_at"))
    return None


def matches_technician(repair, technician):
    if not technician:
        return True
    if repair.get("assigned_technician_id"):
        return repair["assigned_technician_id"] == technician["id"]
    return technician["match_legacy_name"] and repair.get("assigned_technician") == technician["name"]


def build_repair_report(repairs, start: date, end: date, technician=None):
    summary = {
        "finished": 0, "repaired": 0, "not_repaired": 0, "delivered": 0,
        "final_value": 0, "recorded_cost": 0, "paid_count": 0, "collected": 0,
    }
    rows = []
    daily = defaultdict(int)
    by_technician = {}
    by_issue = {}

    for repair in repairs:
        if not matches_technician(repair, technician):
            continue
        status = repair.get("status")
        value = repair_value(repair)
        finished = completion_date(repair)
        delivered = local_date(repair.get("delivered_date"))
        paid = local_date(repair.get("paid_at")) if repair.get("paid") else None

        if delivered and start <= delivered <= end:
            summary["delivered"] += 1
        if paid and start <= paid <= end:
            summary["paid_count"] += 1
            summary["collected"] += value
        if not finished or not start <= finished <= end:
            continue

        cost = repair_cost(repair)
        summary["finished"] += 1
        summary["repaired" if status in REPAIRED else "not_repaired"] += 1
        summary["final_value"] += value
        summary["recorded_cost"] += cost
        daily[finished.isoformat()] += 1
        issues = list(dict.fromkeys(
            str(item.get("issue") or "").strip() for item in repair.get("budget_items") or []
            if str(item.get("issue") or "").strip()
        )) or [str(repair.get("reported_issue") or "").strip()]
        issues = [issue for issue in issues if issue]
        for issue in issues:
            group_key = issue.casefold()
            issue_group = by_issue.setdefault(group_key, {"name": issue, "count": 0})
            issue_group["count"] += 1

        technician_id = repair.get("assigned_technician_id") or repair.get("assigned_technician") or "unassigned"
        technician_name = repair.get("assigned_technician") or "Sin asignar"
        group = by_technician.setdefault(technician_id, {"id": technician_id, "name": technician_name, "finished": 0, "final_value": 0})
        group["finished"] += 1
        group["final_value"] += value
        rows.append({
            "id": repair.get("id"), "ticket_number": repair.get("ticket_number") or "—",
            "customer_name": repair.get("customer_name") or "—",
            "device": " ".join(filter(None, [repair.get("device_brand"), repair.get("device_model")])) or "—",
            "technician": technician_name,
            "work": ", ".join(issues) or "—",
            "status": "Sin reparación" if status in UNREPAIRED else "Entregado" if status == "delivered" else "Reparado",
            "finished_date": finished.isoformat(), "value": value, "cost": cost,
        })

    rows.sort(key=lambda item: (item["finished_date"], item["ticket_number"]), reverse=True)
    return {
        "start": start.isoformat(), "end": end.isoformat(), "summary": summary,
        "daily": [{"date": day, "count": count} for day, count in sorted(daily.items())],
        "by_technician": sorted(by_technician.values(), key=lambda item: (-item["finished"], item["name"])),
        "by_issue": sorted(by_issue.values(), key=lambda item: (-item["count"], item["name"])),
        "rows": rows,
    }
