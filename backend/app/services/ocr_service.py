import cv2
import numpy as np
import pytesseract
from PIL import Image
import base64
import io
from pathlib import Path
from typing import Tuple
import logging

logger = logging.getLogger(__name__)


class OCRService:
    """
    Service OCR avec prétraitement OpenCV pour améliorer
    la qualité de lecture des fiches climatologiques manuscrites.
    """

    TESSERACT_CONFIG = r'--oem 3 --psm 6 -l fra+eng'

    def preprocess_image(self, image_path: str) -> np.ndarray:
        """Pipeline de prétraitement adapté aux fiches papier."""
        img = cv2.imread(image_path)
        if img is None:
            raise ValueError(f"Impossible de lire l'image: {image_path}")

        # 1. Correction de l'orientation (deskew)
        img = self._deskew(img)

        # 2. Conversion en niveaux de gris
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)

        # 3. Suppression du bruit
        denoised = cv2.fastNlMeansDenoising(gray, h=10)

        # 4. Binarisation adaptative (gère les variations d'éclairage)
        binary = cv2.adaptiveThreshold(
            denoised, 255,
            cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
            cv2.THRESH_BINARY, 21, 10
        )

        # 5. Dilatation légère pour améliorer les lettres manuscrites
        kernel = np.ones((1, 1), np.uint8)
        processed = cv2.dilate(binary, kernel, iterations=1)

        return processed

    def _deskew(self, img: np.ndarray) -> np.ndarray:
        """Correction automatique de l'inclinaison du scan."""
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        gray = cv2.bitwise_not(gray)
        coords = np.column_stack(np.where(gray > 0))
        if len(coords) == 0:
            return img
        angle = cv2.minAreaRect(coords)[-1]
        if angle < -45:
            angle = -(90 + angle)
        else:
            angle = -angle
        if abs(angle) < 0.5:
            return img
        (h, w) = img.shape[:2]
        center = (w // 2, h // 2)
        M = cv2.getRotationMatrix2D(center, angle, 1.0)
        rotated = cv2.warpAffine(
            img, M, (w, h),
            flags=cv2.INTER_CUBIC,
            borderMode=cv2.BORDER_REPLICATE
        )
        return rotated

    def extract_text(self, image_path: str) -> Tuple[str, float]:
        """
        Extrait le texte et retourne (texte_brut, score_confiance_moyen).
        """
        try:
            processed = self.preprocess_image(image_path)
            pil_img = Image.fromarray(processed)

            # Extraction avec données de confiance
            data = pytesseract.image_to_data(
                pil_img,
                config=self.TESSERACT_CONFIG,
                output_type=pytesseract.Output.DICT
            )

            # Calcul du score de confiance moyen
            confidences = [
                int(c) for c in data['conf']
                if str(c).isdigit() and int(c) > 0
            ]
            avg_confidence = (
                sum(confidences) / len(confidences) / 100.0
                if confidences else 0.0
            )

            text = pytesseract.image_to_string(
                pil_img, config=self.TESSERACT_CONFIG
            )

            return text, avg_confidence

        except Exception as e:
            logger.error(f"Erreur OCR sur {image_path}: {e}")
            return "", 0.0

    def image_to_base64(self, image_path: str) -> str:
        """Convertit une image en base64 pour l'API Claude."""
        with open(image_path, "rb") as f:
            data = f.read()
        return base64.standard_b64encode(data).decode("utf-8")

    def detect_form_type(self, text: str) -> str:
        """
        Détecte automatiquement le type de formulaire
        à partir du texte extrait.
        """
        text_lower = text.lower()
        if "tableau climatologique mensuel" in text_lower:
            return "tableau_climatologique_mensuel"
        elif "tableau synoptique des précipitations" in text_lower:
            return "tableau_synoptique_precipitations"
        elif "température de l'air sous abri" in text_lower:
            return "temperature_air"
        elif "tension de la vapeur" in text_lower:
            return "vapeur_pression_humidite"
        elif "résumé du temps" in text_lower:
            return "resume_temps"
        elif "précipitations" in text_lower and "évaporation" in text_lower:
            return "precipitation_evaporation"
        return "unknown"


ocr_service = OCRService()
