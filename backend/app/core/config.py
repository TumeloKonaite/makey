from functools import lru_cache
from urllib.parse import parse_qsl, urlencode, urlparse, urlunparse

from pydantic import AliasChoices, Field, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

_LOCAL_LIKE_ENVIRONMENTS = {"local", "test"}
_LOCAL_ONLY_HOSTS = {
    "localhost",
    "127.0.0.1",
    "0.0.0.0",
    "host.docker.internal",
    "postgres",
    "keycloak",
    "minio",
}


class Settings(BaseSettings):
    app_name: str = Field(default="rooms-marketplace-api", alias="APP_NAME")
    app_env: str = Field(default="local", alias="APP_ENV")
    api_port: int = Field(default=8000, alias="API_PORT")
    frontend_origin: str = Field(default="http://localhost:5173", alias="FRONTEND_ORIGIN")

    database_url: str = Field(
        default="postgresql+psycopg://marketplace_user:marketplace_password@postgres:5432/marketplace_db",
        alias="DATABASE_URL",
    )
    migration_database_url: str | None = Field(
        default=None,
        alias="MIGRATION_DATABASE_URL",
    )

    minio_endpoint: str = Field(default="http://localhost:9000", alias="MINIO_ENDPOINT")
    minio_region: str | None = Field(default=None, alias="MINIO_REGION")
    minio_public_url: str = Field(
        default="http://localhost:9000",
        alias="MINIO_PUBLIC_URL",
    )
    minio_root_user: str = Field(
        default="minioadmin",
        validation_alias=AliasChoices("MINIO_ROOT_USER", "MINIO_ACCESS_KEY"),
    )
    minio_root_password: str = Field(
        default="minioadmin",
        validation_alias=AliasChoices("MINIO_ROOT_PASSWORD", "MINIO_SECRET_KEY"),
    )
    minio_bucket_listing_images: str = Field(
        default="listing-images",
        alias="MINIO_BUCKET_LISTING_IMAGES",
    )
    max_image_upload_mb: int = Field(default=5, alias="MAX_IMAGE_UPLOAD_MB")

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

    @property
    def is_local(self) -> bool:
        return self.app_env.lower() in _LOCAL_LIKE_ENVIRONMENTS

    @property
    def should_ensure_listing_images_bucket_on_startup(self) -> bool:
        return self.app_env.lower() == "local"

    @model_validator(mode="after")
    def validate_non_local_configuration(self) -> "Settings":
        if self.is_local:
            return self

        self._validate_frontend_origin()
        self._validate_external_service("DATABASE_URL", self.database_url)
        if self.migration_database_url:
            self._validate_external_service(
                "MIGRATION_DATABASE_URL",
                self.migration_database_url,
            )
        self._validate_external_service("KEYCLOAK_ISSUER", self.keycloak_issuer)
        self._validate_external_service("KEYCLOAK_JWKS_URL", self.keycloak_jwks_url)
        self._validate_external_service("MINIO_ENDPOINT", self.minio_endpoint)
        self._validate_external_service("MINIO_PUBLIC_URL", self.minio_public_url)
        self._validate_required("MINIO_BUCKET_LISTING_IMAGES", self.minio_bucket_listing_images)
        self._validate_required("MINIO_ROOT_USER", self.minio_root_user)
        self._validate_required("MINIO_ROOT_PASSWORD", self.minio_root_password)
        self._validate_required(
            "KEYCLOAK_AUTHORIZED_PARTY",
            self.keycloak_authorized_party,
        )
        return self

    def _validate_frontend_origin(self) -> None:
        origin = (self.frontend_origin or "").strip()
        if not origin or origin == "*":
            raise ValueError(
                "FRONTEND_ORIGIN must be set to the deployed frontend URL when APP_ENV is not local."
            )

        host = _extract_host(origin)
        if host in _LOCAL_ONLY_HOSTS:
            raise ValueError(
                "FRONTEND_ORIGIN must not point at localhost or Docker-only hosts in non-local environments."
            )

    def _validate_external_service(self, name: str, value: str) -> None:
        self._validate_required(name, value)
        host = _extract_host(value)
        if host in _LOCAL_ONLY_HOSTS:
            raise ValueError(
                f"{name} must not use localhost or Docker-only host '{host}' when APP_ENV is not local."
            )

    def _validate_required(self, name: str, value: str) -> None:
        if not (value or "").strip():
            raise ValueError(
                f"{name} must be set when APP_ENV is not local."
            )

    @property
    def alembic_database_url(self) -> str:
        return _normalize_sqlalchemy_database_url(
            self.migration_database_url or self.database_url
        )

    @property
    def sqlalchemy_database_url(self) -> str:
        return _normalize_sqlalchemy_database_url(self.database_url)


@lru_cache
def get_settings() -> Settings:
    return Settings()


def _extract_host(value: str) -> str | None:
    candidate = (value or "").strip()
    if not candidate:
        return None

    parsed = urlparse(candidate if "://" in candidate else f"placeholder://{candidate}")
    if parsed.hostname:
        return parsed.hostname.lower()

    return None


def _normalize_sqlalchemy_database_url(value: str | None) -> str:
    candidate = (value or "").strip()
    if not candidate:
        return candidate

    parsed = urlparse(candidate)
    filtered_query = [
        (key, query_value)
        for key, query_value in parse_qsl(parsed.query, keep_blank_values=True)
        if key.lower() != "pgbouncer"
    ]
    return urlunparse(parsed._replace(query=urlencode(filtered_query)))
