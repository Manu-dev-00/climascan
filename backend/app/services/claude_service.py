import anthropic
import json
import re
from typing import Dict, Any, List
from app.core.config import settings
import logging

logger = logging.getLogger(__name__)

client = anthropic.Anthropic(api_key=settings.ANTHROPIC_API_KEY)


EXTRACTION_PROMPT = """Tu es un expert en climatologie chargé d'extraire les données d'une fiche climatologique manuscrite de la station DGMN Lomé, Togo.

Type de formulaire : {form_type}
Station : {station}
Mois/Année : {mois} {annee}

Texte brut extrait par OCR :
---
{ocr_text}
---

INSTRUCTIONS :
1. Extrais TOUTES les valeurs numériques présentes pour chaque jour du mois (1 à 31).
2. Pour chaque valeur, estime un score de confiance entre 0.0 et 1.0 :
   - 1.0 = valeur clairement lisible, cohérente
   - 0.7-0.9 = valeur probable mais légèrement ambiguë
   - 0.4-0.6 = valeur incertaine, à vérifier
   - < 0.4 = valeur illisible ou très douteuse
3. Signale les valeurs flaggées (flagged: true) si confiance < 0.75.
4. Respecte les unités : températures en °C (dixièmes), précipitations en mm (dixièmes), pression en hPa.
5. Une valeur manquante = null (pas zéro).

Retourne UNIQUEMENT un JSON valide selon ce format (pas de texte autour) :
{{
  "station": "...",
  "mois": "...",
  "annee": ...,
  "form_type": "...",
  "global_confidence": 0.0,
  "data": {{
    "daily": [
      {{
        "date": 1,
        "values": {{
          "champ_name": {{
            "value": ...,
            "confidence": 0.0,
            "flagged": false,
            "original_text": "..."
          }}
        }}
      }}
    ],
    "totaux": {{}},
    "moyennes": {{}},
    "summary": {{}}
  }},
  "alerts": []
}}
"""

VALIDATION_PROMPT = """Tu es un expert en climatologie tropicale (Togo, Afrique de l'Ouest).
Analyse ces données climatologiques extraites pour la station DGMN Lomé et identifie toutes les incohérences.

Données :
{data_json}

Vérifie :
1. Température : Tx >= Tn pour chaque jour. Tx et Tn dans les plages normales Lomé (Tn: 20-28°C, Tx: 28-38°C)
2. Précipitations : valeurs positives, cohérence entre total et synoptique
3. Pression : plage normale Lomé (1005-1020 hPa)
4. Humidité : entre 0% et 100%
5. Insolation : entre 0 et 14h/jour
6. Évaporation : valeurs positives, cohérentes avec température
7. Comparaison aux normales climatologiques 1991-2020 Lomé

Retourne UNIQUEMENT un JSON :
{{
  "alerts": [
    {{
      "type": "error|warning|info",
      "field": "...",
      "date": ...,
      "message": "...",
      "expected_range": "...",
      "found_value": ...
    }}
  ],
  "quality_score": 0.0,
  "validation_summary": "..."
}}
"""


class ClaudeService:
    """
    Service d'extraction intelligente et de validation
    des fiches climatologiques via l'API Claude.
    """

    def extract_from_image(
        self,
        image_path: str,
        ocr_text: str,
        form_type: str,
        station: str,
        mois: str,
        annee: int
    ) -> Dict[str, Any]:
        """
        Extraction des champs depuis l'image + texte OCR.
        Utilise la vision de Claude pour les champs ambigus.
        """
        with open(image_path, "rb") as f:
            import base64
            image_data = base64.standard_b64encode(f.read()).decode("utf-8")

        ext = image_path.split(".")[-1].lower()
        media_type_map = {
            "jpg": "image/jpeg", "jpeg": "image/jpeg",
            "png": "image/png", "pdf": "application/pdf"
        }
        media_type = media_type_map.get(ext, "image/jpeg")

        prompt = EXTRACTION_PROMPT.format(
            form_type=form_type,
            station=station,
            mois=mois,
            annee=annee,
            ocr_text=ocr_text[:4000]
        )

        try:
            response = client.messages.create(
                model=settings.CLAUDE_MODEL,
                max_tokens=4096,
                messages=[
                    {
                        "role": "user",
                        "content": [
                            {
                                "type": "image",
                                "source": {
                                    "type": "base64",
                                    "media_type": media_type,
                                    "data": image_data
                                }
                            },
                            {
                                "type": "text",
                                "text": prompt
                            }
                        ]
                    }
                ]
            )

            raw = response.content[0].text.strip()
            # Nettoyage au cas où Claude ajoute des backticks
            raw = re.sub(r'^```json\s*', '', raw)
            raw = re.sub(r'\s*```$', '', raw)
            return json.loads(raw)

        except json.JSONDecodeError as e:
            logger.error(f"JSON invalide retourné par Claude: {e}")
            return self._empty_result(station, mois, annee, form_type)
        except Exception as e:
            logger.error(f"Erreur Claude API: {e}")
            return self._empty_result(station, mois, annee, form_type)

    def validate_data(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Validation climatologique des données extraites.
        Détecte incohérences, valeurs aberrantes, alertes.
        """
        try:
            response = client.messages.create(
                model=settings.CLAUDE_MODEL,
                max_tokens=2048,
                messages=[
                    {
                        "role": "user",
                        "content": VALIDATION_PROMPT.format(
                            data_json=json.dumps(data, ensure_ascii=False, indent=2)[:6000]
                        )
                    }
                ]
            )

            raw = response.content[0].text.strip()
            raw = re.sub(r'^```json\s*', '', raw)
            raw = re.sub(r'\s*```$', '', raw)
            return json.loads(raw)

        except Exception as e:
            logger.error(f"Erreur validation Claude: {e}")
            return {"alerts": [], "quality_score": 0.5, "validation_summary": "Validation échouée"}

    def generate_summary(self, month_data: List[Dict]) -> str:
        """Génère le résumé climatologique du mois en français."""
        try:
            response = client.messages.create(
                model=settings.CLAUDE_MODEL,
                max_tokens=500,
                messages=[
                    {
                        "role": "user",
                        "content": f"""À partir de ces données climatologiques mensuelles de Lomé, Togo,
rédige un résumé climatologique court (3-4 phrases) en français, style OMM :
{json.dumps(month_data, ensure_ascii=False)[:3000]}"""
                    }
                ]
            )
            return response.content[0].text.strip()
        except Exception:
            return ""

    def _empty_result(self, station, mois, annee, form_type) -> Dict:
        return {
            "station": station,
            "mois": mois,
            "annee": annee,
            "form_type": form_type,
            "global_confidence": 0.0,
            "data": {"daily": [], "totaux": {}, "moyennes": {}, "summary": {}},
            "alerts": [{"type": "error", "message": "Extraction échouée"}]
        }


claude_service = ClaudeService()
