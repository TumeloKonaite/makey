import re
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
    "minio",
}


class Settings(BaseSettings):
    app_name: str = Field(default="rooms-marketplace-api", alias="APP_NAME")
    app_env: str = Field(
        default="local",
        validation_alias=AliasChoices("ENVIRONMENT", "APP_ENV"),
    )
    api_port: int = Field(
        default=8000,
        validation_alias=AliasChoices("PORT", "API_PORT"),
    )
    frontend_origin: str = Field(
        default="http://localhost:5173",
        validation_alias=AliasChoices("CORS_ALLOWED_ORIGINS", "FRONTEND_ORIGIN"),
    )
    frontend_preview_origin_regex: str | None = Field(
        default=None,
        alias="FRONTEND_PREVIEW_ORIGIN_REGEX",
    )

    database_url: str = Field(
        default="postgresql+psycopg://marketplace_user:marketplace_password@postgres:5432/marketplace_db",
        alias="DATABASE_URL",
    )
    migration_database_url: str | None = Field(
        default=None,
        alias="MIGRATION_DATABASE_URL",
    )
    database_pool_size: int = Field(default=5, alias="DATABASE_POOL_SIZE", ge=1)
    database_max_overflow: int = Field(default=5, alias="DATABASE_MAX_OVERFLOW", ge=0)
    database_pool_timeout: int = Field(default=10, alias="DATABASE_POOL_TIMEOUT", ge=1)
    database_pool_recycle: int = Field(default=1800, alias="DATABASE_POOL_RECYCLE", ge=1)
    database_connect_timeout: int = Field(
        default=5,
        alias="DATABASE_CONNECT_TIMEOUT",
        ge=1,
    )

    minio_endpoint: str = Field(
        default="http://localhost:9000",
        validation_alias=AliasChoices("OBJECT_STORAGE_ENDPOINT", "MINIO_ENDPOINT"),
    )
    minio_region: str | None = Field(
        default=None,
        validation_alias=AliasChoices("OBJECT_STORAGE_REGION", "MINIO_REGION"),
    )
    minio_public_url: str = Field(
        default="http://localhost:9000",
        validation_alias=AliasChoices("OBJECT_STORAGE_PUBLIC_URL", "MINIO_PUBLIC_URL"),
    )
    minio_root_user: str = Field(
        default="minioadmin",
        validation_alias=AliasChoices(
            "OBJECT_STORAGE_ACCESS_KEY",
            "MINIO_ACCESS_KEY",
            "MINIO_ROOT_USER",
        ),
    )
    minio_root_password: str = Field(
        default="minioadmin",
        validation_alias=AliasChoices(
            "OBJECT_STORAGE_SECRET_KEY",
            "MINIO_SECRET_KEY",
            "MINIO_ROOT_PASSWORD",
        ),
    )
    minio_bucket_listing_images: str = Field(
        default="listing-images",
        validation_alias=AliasChoices(
            "OBJECT_STORAGE_BUCKET",
            "MINIO_BUCKET_LISTING_IMAGES",
        ),
    )
    max_image_upload_mb: int = Field(default=5, alias="MAX_IMAGE_UPLOAD_MB")

    clerk_secret_key: str = Field(default="", alias="CLERK_SECRET_KEY")
    clerk_webhook_signing_secret: str = Field(
        default="",
        validation_alias=AliasChoices(
            "CLERK_WEBHOOK_SECRET",
            "CLERK_WEBHOOK_SIGNING_SECRET",
        ),
    )
    clerk_authorized_parties: str | None = Field(
        default=None,
        alias="CLERK_AUTHORIZED_PARTIES",
    )
    clerk_publishable_key: str | None = Field(default=None, alias="CLERK_PUBLISHABLE_KEY")
    clerk_jwt_issuer: str | None = Field(default=None, alias="CLERK_JWT_ISSUER")
    clerk_jwks_url: str | None = Field(default=None, alias="CLERK_JWKS_URL")
    clerk_jwt_audience: str | None = Field(default=None, alias="CLERK_JWT_AUDIENCE")

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
        self._validate_frontend_preview_origin_regex()
        self._validate_external_service("DATABASE_URL", self.database_url)
        self._validate_database_tls("DATABASE_URL", self.database_url)
        if self.migration_database_url:
            self._validate_external_service(
                "MIGRATION_DATABASE_URL",
                self.migration_database_url,
            )
            self._validate_database_tls(
                "MIGRATION_DATABASE_URL",
                self.migration_database_url,
            )
        self._validate_external_service("MINIO_ENDPOINT", self.minio_endpoint)
        self._validate_external_service("MINIO_PUBLIC_URL", self.minio_public_url)
        self._validate_required("MINIO_BUCKET_LISTING_IMAGES", self.minio_bucket_listing_images)
        self._validate_required("MINIO_ROOT_USER", self.minio_root_user)
        self._validate_required("MINIO_ROOT_PASSWORD", self.minio_root_password)
        self._validate_required("CLERK_SECRET_KEY", self.clerk_secret_key)
        self._validate_required(
            "CLERK_WEBHOOK_SIGNING_SECRET",
            self.clerk_webhook_signing_secret,
        )
        return self

    @property
    def clerk_authorized_party_list(self) -> list[str]:
        configured = self.clerk_authorized_parties or self.frontend_origin
        return [value.strip().rstrip("/") for value in configured.split(",") if value.strip()]

    @property
    def cors_allowed_origin_list(self) -> list[str]:
        return [
            value.strip().rstrip("/")
            for value in self.frontend_origin.split(",")
            if value.strip()
        ]

    @property
    def clerk_jwt_audience_list(self) -> list[str] | None:
        if not self.clerk_jwt_audience:
            return None
        values = [value.strip() for value in self.clerk_jwt_audience.split(",") if value.strip()]
        return values or None

    def _validate_frontend_origin(self) -> None:
        origins = self.cors_allowed_origin_list
        if not origins or "*" in origins:
            raise ValueError(
                "CORS_ALLOWED_ORIGINS must contain deployed frontend origins when ENVIRONMENT is not local."
            )

        for origin in origins:
            host = _extract_host(origin)
            if host in _LOCAL_ONLY_HOSTS:
                raise ValueError(
                    "CORS_ALLOWED_ORIGINS must not contain localhost or Docker-only hosts "
                    "in non-local environments."
                )

    def _validate_frontend_preview_origin_regex(self) -> None:
        pattern = (self.frontend_preview_origin_regex or "").strip()
        if not pattern:
            return

        try:
            re.compile(pattern)
        except re.error as exc:
            raise ValueError(
                "FRONTEND_PREVIEW_ORIGIN_REGEX must be a valid regular expression."
            ) from exc

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

    def _validate_database_tls(self, name: str, value: str) -> None:
        parsed = urlparse(value)
        if not parsed.scheme.startswith("postgresql"):
            raise ValueError(f"{name} must use postgresql+psycopg://.")
        if parsed.scheme != "postgresql+psycopg":
            raise ValueError(f"{name} must use the synchronous psycopg SQLAlchemy driver.")

        query = dict(parse_qsl(parsed.query, keep_blank_values=True))
        sslmode = query.get("sslmode", "").lower()
        if sslmode and sslmode not in {"verify-ca", "verify-full"}:
            raise ValueError(
                f"{name} sslmode must be verify-ca or verify-full in non-local environments."
            )

    @property
    def alembic_database_url(self) -> str:
        return _normalize_sqlalchemy_database_url(
            self.migration_database_url or self.database_url,
            require_tls=not self.is_local,
        )

    @property
    def sqlalchemy_database_url(self) -> str:
        return _normalize_sqlalchemy_database_url(
            self.database_url,
            require_tls=not self.is_local,
        )


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


def _normalize_sqlalchemy_database_url(
    value: str | None,
    *,
    require_tls: bool = False,
) -> str:
    candidate = (value or "").strip()
    if not candidate:
        return candidate

    parsed = urlparse(candidate)
    filtered_query = [
        (key, query_value)
        for key, query_value in parse_qsl(parsed.query, keep_blank_values=True)
        if key.lower() != "pgbouncer"
    ]
    if require_tls and not any(key.lower() == "sslmode" for key, _ in filtered_query):
        filtered_query.append(("sslmode", "verify-full"))
    return urlunparse(parsed._replace(query=urlencode(filtered_query)))
