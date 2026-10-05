from fastapi import APIRouter, HTTPException
from fastapi.responses import Response
from typing import Optional
from app.core.store import store
from app.models.schemas import ValidationPatch, ExportRequest
from app.services.export_service import export_service
from datetime import datetime

# ─── Validation Router ────────────────────────────────────────────
router = APIRouter()

@router.get("/{record_id}")
def get_record_detail(record_id: str):
    """Retourne le détail complet d'un enregistrement pour révision."""
    record = store.get_record(record_id)
    if not record:
        raise HTTPException(404, "Enregistrement non trouvé")
    record["audit_log"] = store.get_audit_log(record_id)
    return record


@router.patch("/{record_id}/field")
def patch_field(record_id: str, patch: ValidationPatch):
    """Correction manuelle d'un champ — loggée dans l'audit trail."""
    record = store.get_record(record_id)
    if not record:
        raise HTTPException(404, "Enregistrement non trouvé")
    if record.get("validated"):
        raise HTTPException(409, "Enregistrement déjà validé — modifications interdites")
    updated = store.update_field(
        record_id, patch.field_path, patch.new_value, patch.operator
    )
    return {"success": True, "record": updated}


@router.post("/{record_id}/validate")
def validate_record(record_id: str, operator: str = "system"):
    """
    Valide définitivement un enregistrement après révision humaine.
    Déclenche l'envoi vers CLIDATA si connecté.
    """
    record = store.get_record(record_id)
    if not record:
        raise HTTPException(404, "Enregistrement non trouvé")

    # Refus si trop d'erreurs critiques non corrigées
    errors = [a for a in record.get("alerts", []) if a.get("type") == "error"]
    if errors:
        raise HTTPException(
            422,
            f"{len(errors)} erreur(s) critique(s) non résolue(s). Corrigez avant validation."
        )

    validated = store.validate_record(record_id, operator)
    return {"success": True, "record_id": record_id, "validated_by": operator, "record": validated}


@router.get("/{record_id}/audit")
def get_audit(record_id: str):
    """Retourne l'historique complet des modifications."""
    return {"record_id": record_id, "audit_log": store.get_audit_log(record_id)}
