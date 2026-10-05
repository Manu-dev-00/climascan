import os
import uuid
import shutil
from datetime import datetime
from pathlib import Path
from fastapi import APIRouter, UploadFile, File, Form, HTTPException, BackgroundTasks
from fastapi.responses import JSONResponse
from typing import List, Optional
from app.core.config import settings
from app.core.store import store
from app.services.ocr_service import ocr_service
from app.services.claude_service import claude_service
from app.services.validator_service import validator
import logging

router = APIRouter()
logger = logging.getLogger(__name__)

ALLOWED_TYPES = {"image/jpeg", "image/png", "image/jpg", "application/pdf"}


@router.post("/single")
async def upload_single(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    station: str = Form(default="DGMN LOME"),
    mois: str = Form(default=""),
    annee: int = Form(default=2026),
):
    """Upload et traitement d'une seule fiche climatologique."""
    if file.content_type not in ALLOWED_TYPES:
        raise HTTPException(400, f"Type de fichier non supporté: {file.content_type}")

    file_size = 0
    upload_dir = Path(settings.UPLOAD_DIR)
    upload_dir.mkdir(parents=True, exist_ok=True)
    archive_dir = Path(settings.ARCHIVE_DIR)
    archive_dir.mkdir(parents=True, exist_ok=True)

    # Sauvegarde du fichier
    ext = file.filename.split(".")[-1].lower()
    record_id = str(uuid.uuid4())
    filename = f"{record_id}.{ext}"
    file_path = upload_dir / filename

    with open(file_path, "wb") as f:
        content = await file.read()
        file_size = len(content)
        if file_size > settings.MAX_FILE_SIZE_MB * 1024 * 1024:
            raise HTTPException(413, "Fichier trop volumineux")
        f.write(content)

    # Copie archive
    archive_path = archive_dir / filename
    shutil.copy2(file_path, archive_path)

    # Création record initial
    record = {
        "id": record_id,
        "station": station,
        "mois": mois,
        "annee": annee,
        "form_type": "unknown",
        "scan_at": datetime.now().isoformat(),
        "file_path": str(file_path),
        "archive_path": str(archive_path),
        "status": "processing",
        "global_confidence": 0.0,
        "flagged_fields": 0,
        "validated": False,
        "data": {},
        "alerts": [],
        "audit_log": []
    }
    store.save_record(record)

    # Traitement en background
    background_tasks.add_task(
        process_file, record_id, str(file_path), station, mois, annee
    )

    return {"record_id": record_id, "status": "processing", "message": "Traitement en cours"}


@router.post("/batch")
async def upload_batch(
    background_tasks: BackgroundTasks,
    files: List[UploadFile] = File(...),
    station: str = Form(default="DGMN LOME"),
    mois: str = Form(default=""),
    annee: int = Form(default=2026),
):
    """Upload batch : toutes les fiches d'un mois en une fois."""
    if len(files) > 10:
        raise HTTPException(400, "Maximum 10 fichiers par batch")

    record_ids = []
    for file in files:
        if file.content_type not in ALLOWED_TYPES:
            continue
        ext = file.filename.split(".")[-1].lower()
        record_id = str(uuid.uuid4())
        filename = f"{record_id}.{ext}"

        upload_dir = Path(settings.UPLOAD_DIR)
        upload_dir.mkdir(parents=True, exist_ok=True)
        file_path = upload_dir / filename

        with open(file_path, "wb") as f:
            f.write(await file.read())

        archive_dir = Path(settings.ARCHIVE_DIR)
        archive_dir.mkdir(parents=True, exist_ok=True)
        shutil.copy2(file_path, archive_dir / filename)

        record = {
            "id": record_id,
            "station": station,
            "mois": mois,
            "annee": annee,
            "form_type": "unknown",
            "scan_at": datetime.now().isoformat(),
            "file_path": str(file_path),
            "archive_path": str(archive_dir / filename),
            "status": "processing",
            "global_confidence": 0.0,
            "flagged_fields": 0,
            "validated": False,
            "data": {},
            "alerts": [],
            "audit_log": []
        }
        store.save_record(record)
        background_tasks.add_task(process_file, record_id, str(file_path), station, mois, annee)
        record_ids.append(record_id)

    return {
        "batch_size": len(record_ids),
        "record_ids": record_ids,
        "status": "processing"
    }


@router.get("/{record_id}/status")
def get_status(record_id: str):
    """Vérifie le statut du traitement d'un fichier."""
    record = store.get_record(record_id)
    if not record:
        raise HTTPException(404, "Enregistrement non trouvé")
    return {
        "record_id": record_id,
        "status": record.get("status"),
        "form_type": record.get("form_type"),
        "global_confidence": record.get("global_confidence"),
        "flagged_fields": record.get("flagged_fields"),
        "alerts_count": len(record.get("alerts", [])),
    }


@router.get("/list")
def list_uploads(
    station: Optional[str] = None,
    mois: Optional[str] = None,
    annee: Optional[int] = None,
    status: Optional[str] = None,
):
    """Liste tous les enregistrements avec filtres."""
    records = store.list_records(station=station, mois=mois, annee=annee, status=status)
    return {
        "total": len(records),
        "records": [
            {
                "id": r["id"],
                "station": r.get("station"),
                "mois": r.get("mois"),
                "annee": r.get("annee"),
                "form_type": r.get("form_type"),
                "status": r.get("status"),
                "global_confidence": r.get("global_confidence"),
                "flagged_fields": r.get("flagged_fields"),
                "validated": r.get("validated"),
                "scan_at": r.get("scan_at"),
                "alerts_count": len(r.get("alerts", [])),
            }
            for r in records
        ]
    }


async def process_file(record_id: str, file_path: str, station: str, mois: str, annee: int):
    """Pipeline complet de traitement en background."""
    try:
        logger.info(f"Traitement démarré: {record_id}")

        # 1. OCR
        ocr_text, ocr_confidence = ocr_service.extract_text(file_path)
        form_type = ocr_service.detect_form_type(ocr_text)

        # 2. Extraction IA (Claude)
        extracted = claude_service.extract_from_image(
            file_path, ocr_text, form_type, station, mois, annee
        )

        # 3. Validation des flags de confiance
        extracted = validator.compute_confidence_flags(extracted)

        # 4. Validation climatologique
        clim_alerts = validator.validate_record(extracted, mois)
        alert_list = [
            {
                "type": a.type,
                "field": a.field,
                "date": a.date,
                "message": a.message,
                "expected_range": a.expected_range,
                "found_value": a.found_value
            }
            for a in clim_alerts
        ]

        # Ajout des alertes IA
        ai_alerts = extracted.get("alerts", [])
        all_alerts = alert_list + (ai_alerts if isinstance(ai_alerts, list) else [])

        # 5. Mise à jour du record
        record = store.get_record(record_id)
        if record:
            record["form_type"] = extracted.get("form_type", form_type)
            record["global_confidence"] = extracted.get("global_confidence", ocr_confidence)
            record["flagged_fields"] = extracted.get("flagged_fields", 0)
            record["data"] = extracted.get("data", {})
            record["alerts"] = all_alerts
            record["status"] = "ready"
            store.save_record(record)

        logger.info(f"Traitement terminé: {record_id} — {len(all_alerts)} alertes")

    except Exception as e:
        logger.error(f"Erreur traitement {record_id}: {e}")
        record = store.get_record(record_id)
        if record:
            record["status"] = "error"
            record["alerts"] = [{"type": "error", "message": str(e)}]
            store.save_record(record)
