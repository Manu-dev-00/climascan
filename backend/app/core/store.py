from typing import Dict, List, Optional, Any
from datetime import datetime
import uuid


class DataStore:
    """
    Store en mémoire pour le développement.
    En production : remplacer par PostgreSQL ou Oracle CLIDATA direct.
    """

    def __init__(self):
        self._records: Dict[str, Dict] = {}
        self._audit: List[Dict] = []

    def save_record(self, record: Dict) -> str:
        rid = record.get("id") or str(uuid.uuid4())
        record["id"] = rid
        record["updated_at"] = datetime.now().isoformat()
        self._records[rid] = record
        return rid

    def get_record(self, record_id: str) -> Optional[Dict]:
        return self._records.get(record_id)

    def list_records(
        self,
        station: Optional[str] = None,
        mois: Optional[str] = None,
        annee: Optional[int] = None,
        status: Optional[str] = None,
        validated: Optional[bool] = None
    ) -> List[Dict]:
        results = list(self._records.values())
        if station:
            results = [r for r in results if station.lower() in r.get("station","").lower()]
        if mois:
            results = [r for r in results if r.get("mois","").lower() == mois.lower()]
        if annee:
            results = [r for r in results if r.get("annee") == annee]
        if status:
            results = [r for r in results if r.get("status") == status]
        if validated is not None:
            results = [r for r in results if r.get("validated") == validated]
        return sorted(results, key=lambda r: r.get("updated_at",""), reverse=True)

    def update_field(self, record_id: str, field_path: str, value: Any, operator: str):
        record = self._records.get(record_id)
        if not record:
            return None
        # Log audit
        old_value = self._get_nested(record, field_path)
        self._audit.append({
            "record_id": record_id,
            "field": field_path,
            "old_value": old_value,
            "new_value": value,
            "operator": operator,
            "timestamp": datetime.now().isoformat()
        })
        self._set_nested(record, field_path, value)
        record["updated_at"] = datetime.now().isoformat()
        return record

    def validate_record(self, record_id: str, operator: str) -> Optional[Dict]:
        record = self._records.get(record_id)
        if not record:
            return None
        record["validated"] = True
        record["validated_by"] = operator
        record["validated_at"] = datetime.now().isoformat()
        record["status"] = "validated"
        return record

    def get_audit_log(self, record_id: str) -> List[Dict]:
        return [e for e in self._audit if e["record_id"] == record_id]

    def get_stats(self) -> Dict:
        records = list(self._records.values())
        total = len(records)
        validated = sum(1 for r in records if r.get("validated"))
        flagged = sum(1 for r in records if r.get("flagged_fields", 0) > 0)
        pending = sum(1 for r in records if r.get("status") == "pending")
        avg_conf = (
            sum(r.get("global_confidence", 0) for r in records) / total
            if total > 0 else 0.0
        )
        alerts_total = sum(len(r.get("alerts", [])) for r in records)
        return {
            "total": total,
            "validated": validated,
            "flagged": flagged,
            "pending": pending,
            "avg_confidence": round(avg_conf, 3),
            "total_alerts": alerts_total,
            "audit_entries": len(self._audit)
        }

    def _get_nested(self, obj: Dict, path: str) -> Any:
        keys = path.split(".")
        for k in keys:
            if isinstance(obj, dict):
                obj = obj.get(k)
            else:
                return None
        return obj

    def _set_nested(self, obj: Dict, path: str, value: Any):
        keys = path.split(".")
        for k in keys[:-1]:
            obj = obj.setdefault(k, {})
        obj[keys[-1]] = value


store = DataStore()
