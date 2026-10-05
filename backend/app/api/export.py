from fastapi import APIRouter, HTTPException
from fastapi.responses import Response, StreamingResponse
from app.core.store import store
from app.models.schemas import ExportRequest
from app.services.export_service import export_service
import io

# ─── Export Router ─────────────────────────────────────────────────
router = APIRouter()


@router.post("/csv")
def export_csv(req: ExportRequest):
    """Export CSV format CLIDATA (séparateur ;)."""
    records = []
    for rid in req.record_ids:
        r = store.get_record(rid)
        if r:
            records.append(r)
    if not records:
        raise HTTPException(404, "Aucun enregistrement trouvé")

    csv_content = export_service.to_csv(records, req.include_metadata)
    return Response(
        content=csv_content.encode("utf-8-sig"),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=clidata_export.csv"}
    )


@router.post("/excel")
def export_excel(req: ExportRequest):
    """Export Excel .xlsx multi-feuilles formaté CLIDATA."""
    records = []
    for rid in req.record_ids:
        r = store.get_record(rid)
        if r:
            records.append(r)
    if not records:
        raise HTTPException(404, "Aucun enregistrement trouvé")

    xlsx_bytes = export_service.to_excel(records)
    return Response(
        content=xlsx_bytes,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": "attachment; filename=clidata_export.xlsx"}
    )


@router.post("/sql")
def export_sql(req: ExportRequest):
    """Export script SQL Oracle pour import direct dans CLIDATA."""
    records = []
    for rid in req.record_ids:
        r = store.get_record(rid)
        if r:
            records.append(r)
    if not records:
        raise HTTPException(404, "Aucun enregistrement trouvé")

    sql_content = export_service.to_sql(records)
    return Response(
        content=sql_content.encode("utf-8"),
        media_type="text/plain",
        headers={"Content-Disposition": "attachment; filename=clidata_import.sql"}
    )


@router.get("/validated/all")
def export_all_validated(format: str = "csv"):
    """Export rapide de tous les enregistrements validés."""
    records = store.list_records(validated=True)
    if not records:
        raise HTTPException(404, "Aucun enregistrement validé")

    if format == "excel":
        xlsx = export_service.to_excel(records)
        return Response(
            content=xlsx,
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={"Content-Disposition": "attachment; filename=clidata_valides.xlsx"}
        )
    elif format == "sql":
        sql = export_service.to_sql(records)
        return Response(
            content=sql.encode("utf-8"),
            media_type="text/plain",
            headers={"Content-Disposition": "attachment; filename=clidata_valides.sql"}
        )
    else:
        csv_content = export_service.to_csv(records)
        return Response(
            content=csv_content.encode("utf-8-sig"),
            media_type="text/csv",
            headers={"Content-Disposition": "attachment; filename=clidata_valides.csv"}
        )


# ─── Stats Router ──────────────────────────────────────────────────
stats_router = APIRouter()


@stats_router.get("/")
def get_stats():
    """Tableau de bord — statistiques globales du système."""
    return store.get_stats()


@stats_router.get("/by-month")
def get_stats_by_month():
    """Répartition des enregistrements par mois."""
    records = store.list_records()
    by_month = {}
    for r in records:
        key = f"{r.get('mois', '?')} {r.get('annee', '?')}"
        if key not in by_month:
            by_month[key] = {"total": 0, "validated": 0, "flagged": 0}
        by_month[key]["total"] += 1
        if r.get("validated"):
            by_month[key]["validated"] += 1
        if r.get("flagged_fields", 0) > 0:
            by_month[key]["flagged"] += 1
    return by_month


@stats_router.get("/alerts/summary")
def get_alert_summary():
    """Résumé des types d'alertes détectées."""
    records = store.list_records()
    summary = {"error": 0, "warning": 0, "info": 0}
    top_fields = {}
    for r in records:
        for a in r.get("alerts", []):
            t = a.get("type", "info")
            summary[t] = summary.get(t, 0) + 1
            field = a.get("field", "?")
            top_fields[field] = top_fields.get(field, 0) + 1
    sorted_fields = sorted(top_fields.items(), key=lambda x: x[1], reverse=True)[:10]
    return {"by_type": summary, "top_flagged_fields": dict(sorted_fields)}
