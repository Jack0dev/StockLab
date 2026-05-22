"""
StockLab ML Service — Configuration Settings
Load from .env file or environment variables.
"""
import os
from pathlib import Path
from dotenv import load_dotenv

# Load .env from project root (stocklab-ml/)
_env_path = Path(__file__).resolve().parent.parent / ".env"
load_dotenv(_env_path)


class Settings:
    """Central configuration for the ML service."""

    # --- Database ---
    DB_HOST: str = os.getenv("DB_HOST", "localhost")
    DB_PORT: int = int(os.getenv("DB_PORT", "3307"))
    DB_NAME: str = os.getenv("DB_NAME", "stock_lap")
    DB_USER: str = os.getenv("DB_USER", "root")
    DB_PASSWORD: str = os.getenv("DB_PASSWORD", "stocklab2026")

    # --- Redis ---
    REDIS_HOST: str = os.getenv("REDIS_HOST", "localhost")
    REDIS_PORT: int = int(os.getenv("REDIS_PORT", "6380"))

    # --- ML ---
    MODEL_VERSION: str = os.getenv("ML_MODEL_VERSION", "v1")
    ADMIN_TOKEN: str = os.getenv("ML_ADMIN_TOKEN", "change_me_too")

    # --- Gemini (Phase 3) ---
    GEMINI_API_KEY: str = os.getenv("GEMINI_API_KEY", "")

    @property
    def DATABASE_URL(self) -> str:
        return (
            f"mysql+pymysql://{self.DB_USER}:{self.DB_PASSWORD}"
            f"@{self.DB_HOST}:{self.DB_PORT}/{self.DB_NAME}"
            f"?charset=utf8mb4"
        )

    @property
    def REDIS_URL(self) -> str:
        return f"redis://{self.REDIS_HOST}:{self.REDIS_PORT}/0"


settings = Settings()
