from pydantic_settings import BaseSettings
from typing import List

class Settings(BaseSettings):
    APP_NAME: str = "CliMaScan"
    DEBUG: bool = False
    ALLOWED_ORIGINS: List[str] = ["http://localhost:3000", "http://localhost:5173"]

    # Anthropic Claude
    ANTHROPIC_API_KEY: str = ""
    CLAUDE_MODEL: str = "claude-sonnet-4-20250514"

    # OCR
    OCR_ENGINE: str = "tesseract"  # tesseract | google_vision
    GOOGLE_VISION_KEY: str = ""

    # Storage
    UPLOAD_DIR: str = "./uploads"
    ARCHIVE_DIR: str = "./archives"
    MAX_FILE_SIZE_MB: int = 20

    # CLIDATA / Oracle
    ORACLE_DSN: str = ""
    ORACLE_USER: str = ""
    ORACLE_PASSWORD: str = ""

    # Thresholds qualité
    MIN_CONFIDENCE_SCORE: float = 0.75
    ALERT_TX_TN_DIFF: float = 0.0  # Tx doit être >= Tn

    class Config:
        env_file = ".env"

settings = Settings()
