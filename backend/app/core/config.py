from functools import lru_cache

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = Field(default="beauty-marketplace-api", alias="APP_NAME")
    app_env: str = Field(default="local", alias="APP_ENV")
    api_port: int = Field(default=8000, alias="API_PORT")

    database_url: str = Field(
        default="postgresql+psycopg://marketplace_user:marketplace_password@postgres:5432/marketplace_db",
        alias="DATABASE_URL",
    )

    minio_endpoint: str = Field(default="minio:9000", alias="MINIO_ENDPOINT")
    minio_access_key: str = Field(default="minioadmin", alias="MINIO_ACCESS_KEY")
    minio_secret_key: str = Field(default="minioadmin", alias="MINIO_SECRET_KEY")
    minio_bucket: str = Field(default="listings", alias="MINIO_BUCKET")

    keycloak_url: str = Field(default="http://keycloak:8080", alias="KEYCLOAK_URL")
    keycloak_realm: str = Field(default="marketplace", alias="KEYCLOAK_REALM")
    keycloak_client_id: str = Field(
        default="marketplace-web",
        alias="KEYCLOAK_CLIENT_ID",
    )

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )


@lru_cache
def get_settings() -> Settings:
    return Settings()
