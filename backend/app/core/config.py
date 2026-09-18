"""Application settings. Single source of runtime configuration."""
from __future__ import annotations

from functools import lru_cache

from pydantic import model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env", env_file_encoding="utf-8", extra="ignore"
    )

    APP_NAME: str = "Alibaba Real Estate Platform"
    APP_CODE: str = "AREP"
    ENV: str = "local"  # local | staging | production
    DEBUG: bool = True
    API_V1_PREFIX: str = "/api/v1"

    # SQLite by default so the project runs on Android/Termux with no Docker.
    # Production overrides with: postgresql+asyncpg://user:pass@host:5432/arep
    DATABASE_URL: str = "sqlite+aiosqlite:///./arep_dev.db"
    DB_ECHO: bool = False

    REDIS_URL: str | None = None

    JWT_SECRET: str = "dev-only-insecure-secret"
    JWT_ALGORITHM: str = "HS256"
    JWT_TTL_MINUTES: int = 720

    TELEGRAM_BOT_TOKEN: str | None = None
    TELEGRAM_INITDATA_MAX_AGE: int = 86400

    # Dev-only shortcut to obtain a token without Telegram. Never in production.
    ALLOW_DEV_LOGIN: bool = True

    CORS_ORIGINS: str = "*"

    @property
    def is_production(self) -> bool:
        return self.ENV.lower() == "production"

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.CORS_ORIGINS.split(",") if o.strip()]

    @model_validator(mode="after")
    def _guard_production(self) -> "Settings":
        if self.is_production:
            if self.JWT_SECRET == "dev-only-insecure-secret":
                raise ValueError("JWT_SECRET must be set in production")
            if self.ALLOW_DEV_LOGIN:
                raise ValueError("ALLOW_DEV_LOGIN must be false in production")
            if not self.TELEGRAM_BOT_TOKEN:
                raise ValueError("TELEGRAM_BOT_TOKEN must be set in production")
        return self


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
