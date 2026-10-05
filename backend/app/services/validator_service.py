from typing import List, Dict, Any, Optional
from dataclasses import dataclass

# Normales climatologiques 1991-2020 Lomé (approx.)
NORMALS_LOME = {
    "Tn": {
        "Jan": 23.5, "Fev": 24.1, "Mar": 24.9, "Avr": 25.4,
        "Mai": 24.9, "Jun": 24.2, "Jul": 23.4, "Aou": 23.3,
        "Sep": 23.4, "Oct": 23.8, "Nov": 24.0, "Dec": 23.7
    },
    "Tx": {
        "Jan": 32.1, "Fev": 33.0, "Mar": 33.1, "Avr": 32.5,
        "Mai": 31.1, "Jun": 29.5, "Jul": 28.5, "Aou": 28.4,
        "Sep": 29.1, "Oct": 30.5, "Nov": 31.8, "Dec": 31.9
    },
    "RR": {
        "Jan": 13.3, "Fev": 34.0, "Mar": 93.0, "Avr": 131.0,
        "Mai": 133.0, "Jun": 219.0, "Jul": 68.0, "Aou": 25.0,
        "Sep": 90.0, "Oct": 119.0, "Nov": 27.0, "Dec": 8.0
    }
}

PHYSICAL_LIMITS = {
    "Tn": (15.0, 35.0),
    "Tx": (22.0, 42.0),
    "T": (10.0, 45.0),
    "HR": (0.0, 100.0),
    "P": (990.0, 1030.0),
    "RR": (0.0, 200.0),
    "ETP": (0.0, 20.0),
    "Insolation": (0.0, 14.0),
}


@dataclass
class Alert:
    type: str          # error | warning | info
    field: str
    date: Optional[int]
    message: str
    expected_range: Optional[str] = None
    found_value: Optional[Any] = None


class ClimatologyValidator:
    """
    Validation automatique des règles physiques et climatologiques.
    Spécialisé pour la station DGMN Lomé, Togo.
    """

    def validate_record(self, data: Dict[str, Any], mois: str) -> List[Alert]:
        alerts: List[Alert] = []
        daily = data.get("data", {}).get("daily", [])

        for day in daily:
            date = day.get("date")
            vals = day.get("values", {})

            # --- Cohérence Tx/Tn ---
            tn_obj = vals.get("Tn") or vals.get("tn")
            tx_obj = vals.get("Tx") or vals.get("tx")
            if tn_obj and tx_obj:
                tn = tn_obj.get("value")
                tx = tx_obj.get("value")
                if tn is not None and tx is not None:
                    if tx < tn:
                        alerts.append(Alert(
                            type="error",
                            field="Tx/Tn",
                            date=date,
                            message=f"Jour {date}: Tx ({tx}°C) < Tn ({tn}°C) — impossible",
                            expected_range="Tx >= Tn",
                            found_value=f"Tx={tx}, Tn={tn}"
                        ))
                    # Plages physiques
                    self._check_range(alerts, "Tn", tn, date)
                    self._check_range(alerts, "Tx", tx, date)

            # --- Précipitations ---
            rr_obj = vals.get("RR") or vals.get("precip_total")
            if rr_obj:
                rr = rr_obj.get("value")
                if rr is not None and rr < 0:
                    alerts.append(Alert(
                        type="error",
                        field="Précipitations",
                        date=date,
                        message=f"Jour {date}: précipitation négative ({rr} mm)",
                        found_value=rr
                    ))

            # --- Humidité relative ---
            hr_obj = vals.get("HR") or vals.get("humidite")
            if hr_obj:
                hr = hr_obj.get("value")
                if hr is not None:
                    self._check_range(alerts, "HR", hr, date)

            # --- Pression ---
            p_obj = vals.get("P") or vals.get("pression")
            if p_obj:
                p = p_obj.get("value")
                if p is not None:
                    self._check_range(alerts, "P", p, date)

        # --- Comparaison aux normales mensuelles ---
        self._check_monthly_normals(alerts, data, mois)

        return alerts

    def _check_range(self, alerts, field, value, date):
        limits = PHYSICAL_LIMITS.get(field)
        if limits and value is not None:
            lo, hi = limits
            if not (lo <= value <= hi):
                alerts.append(Alert(
                    type="warning",
                    field=field,
                    date=date,
                    message=f"Jour {date}: {field}={value} hors plage [{lo}, {hi}]",
                    expected_range=f"[{lo}, {hi}]",
                    found_value=value
                ))

    def _check_monthly_normals(self, alerts, data, mois):
        summary = data.get("data", {}).get("summary", {})
        mois_key = mois[:3].capitalize()
        normals = NORMALS_LOME

        if mois_key in normals.get("RR", {}):
            normal_rr = normals["RR"][mois_key]
            rr_obs = summary.get("precip_total")
            if rr_obs is not None:
                rr_val = rr_obs.get("value") if isinstance(rr_obs, dict) else rr_obs
                if rr_val is not None and abs(rr_val - normal_rr) > normal_rr * 1.5:
                    alerts.append(Alert(
                        type="info",
                        field="Précipitations mensuelles",
                        date=None,
                        message=f"Précipitations ({rr_val} mm) très différentes de la normale {mois_key} ({normal_rr} mm)",
                        expected_range=f"~{normal_rr} mm",
                        found_value=rr_val
                    ))

    def compute_confidence_flags(self, data: Dict) -> Dict:
        """
        Marque les champs avec confiance < seuil comme flagged.
        Retourne les données enrichies + compte des champs flaggés.
        """
        from app.core.config import settings
        threshold = settings.MIN_CONFIDENCE_SCORE
        flagged_count = 0

        daily = data.get("data", {}).get("daily", [])
        for day in daily:
            for field, obj in day.get("values", {}).items():
                if isinstance(obj, dict):
                    conf = obj.get("confidence", 1.0)
                    if conf < threshold:
                        obj["flagged"] = True
                        flagged_count += 1

        data["flagged_fields"] = flagged_count
        return data


validator = ClimatologyValidator()
