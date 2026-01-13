"""Application configuration using pydantic-settings."""

from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
    )

    # Application
    app_name: str = "TalentAI"
    debug: bool = False

    # Supabase
    supabase_url: str
    supabase_service_key: str

    # Google ADK / Gemini
    google_api_key: str
    google_genai_use_vertexai: bool = False
    google_cloud_project: str | None = None
    google_cloud_location: str = "us-central1"

    # Gemini Model
    gemini_model: str = "gemini-2.5-flash"

    # LinkedIn (optional)
    linkedin_client_id: str | None = None
    linkedin_client_secret: str | None = None

    # Email
    smtp_host: str = "smtp.gmail.com"
    smtp_port: int = 587
    smtp_user: str | None = None
    smtp_password: str | None = None

    # Redis (for Celery)
    redis_url: str = "redis://localhost:6379/0"


@lru_cache
def get_settings() -> Settings:
    """Get cached settings instance."""
    return Settings()


settings = get_settings()
