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

    keycloak_issuer: str = Field(
        default="http://localhost:8080/realms/marketplace",
        alias="KEYCLOAK_ISSUER",
    )
    keycloak_authorized_party: str = Field(
        default="marketplace-api",
        alias="KEYCLOAK_AUTHORIZED_PARTY",
    )
    keycloak_jwks_url: str = Field(
        default="http://localhost:8080/realms/marketplace/protocol/openid-connect/certs",
        alias="KEYCLOAK_JWKS_URL",
    )

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )


@lru_cache
def get_settings() -> Settings:
    return Settings()
