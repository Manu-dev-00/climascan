from fastapi import APIRouter
from app.core.store import store

router = APIRouter()


@router.get("/")
def get_stats():
    return store.get_stats()


@router.get("/by-month")
def get_stats_by_month():
    records = store.list_records()
    by_month = {}
    for r in records:
        key = f"{r.get('mois','?')} {r.get('annee','?')}"
        if key not in by_month:
            by_month[key] = {"total": 0, "validated": 0, "flagged": 0}
        by_month[key]["total"] += 1
        if r.get("validated"):
            by_month[key]["validated"] += 1
        if r.get("flagged_fields", 0) > 0:
            by_month[key]["flagged"] += 1
    return by_month


@router.get("/alerts/summary")
def get_alert_summary():
    records = store.list_records()
    summary = {"error": 0, "warning": 0, "info": 0}
    top_fields: dict = {}
    for r in records:
        for a in r.get("alerts", []):
            t = a.get("type", "info")
            summary[t] = summary.get(t, 0) + 1
            field = a.get("field", "?")
            top_fields[field] = top_fields.get(field, 0) + 1
    sorted_fields = sorted(top_fields.items(), key=lambda x: x[1], reverse=True)[:10]
    return {"by_type": summary, "top_flagged_fields": dict(sorted_fields)}
