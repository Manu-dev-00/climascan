from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime
from enum import Enum


class FormType(str, Enum):
    TCM = "tableau_climatologique_mensuel"
    PRECIPITATION = "precipitation_evaporation"
    TEMPERATURE = "temperature_air"
    VAPEUR_PRESSION = "vapeur_pression_humidite"
    SYNOPTIQUE = "tableau_synoptique_precipitations"
    RESUME_TEMPS = "resume_temps"


class FieldValue(BaseModel):
    value: Optional[Any] = None
    confidence: float = Field(ge=0.0, le=1.0)
    flagged: bool = False
    original_text: Optional[str] = None
    corrected: bool = False
    corrected_by: Optional[str] = None
    corrected_at: Optional[datetime] = None


class DailyTemperature(BaseModel):
    date: int
    obs_0h: Optional[FieldValue] = None
    obs_3h: Optional[FieldValue] = None
    obs_6h: Optional[FieldValue] = None
    obs_9h: Optional[FieldValue] = None
    obs_12h: Optional[FieldValue] = None
    obs_15h: Optional[FieldValue] = None
    obs_18h: Optional[FieldValue] = None
    obs_21h: Optional[FieldValue] = None
    total: Optional[FieldValue] = None
    moyenne: Optional[FieldValue] = None
    minimum: Optional[FieldValue] = None
    maximum: Optional[FieldValue] = None


class DailyPrecipitation(BaseModel):
    date: int
    duree_6h_18h: Optional[FieldValue] = None
    duree_18h_6h: Optional[FieldValue] = None
    hauteur_matin: Optional[FieldValue] = None
    hauteur_soir: Optional[FieldValue] = None
    total: Optional[FieldValue] = None
    piche_mm: Optional[FieldValue] = None
    bac_mm: Optional[FieldValue] = None


class TCMSummary(BaseModel):
    tn_moyenne: Optional[FieldValue] = None
    tx_moyenne: Optional[FieldValue] = None
    tmoy: Optional[FieldValue] = None
    tn_absolu: Optional[FieldValue] = None
    tx_absolu: Optional[FieldValue] = None
    precip_hauteur: Optional[FieldValue] = None
    precip_duree: Optional[FieldValue] = None
    evaporation_piche: Optional[FieldValue] = None
    evaporation_bac: Optional[FieldValue] = None
    insolation: Optional[FieldValue] = None
    caracteres_dominants: Optional[str] = None


class ScanRecord(BaseModel):
    id: str
    station: str
    mois: str
    annee: int
    form_type: FormType
    scan_at: datetime
    file_path: str
    archive_path: Optional[str] = None
    status: str = "pending"
    global_confidence: float = 0.0
    flagged_fields: int = 0
    validated: bool = False
    validated_by: Optional[str] = None
    validated_at: Optional[datetime] = None
    data: Dict[str, Any] = {}
    alerts: List[str] = []
    audit_log: List[Dict[str, Any]] = []


class ValidationPatch(BaseModel):
    field_path: str
    new_value: Any
    operator: str
    reason: Optional[str] = None


class ExportRequest(BaseModel):
    record_ids: List[str]
    format: str = "csv"  # csv | excel | sql
    include_metadata: bool = True
