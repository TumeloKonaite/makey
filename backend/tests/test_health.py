from __future__ import annotations

from collections.abc import Generator

import pytest
from fastapi.testclient import TestClient
from pydantic import ValidationError

from app.api.routes import health as health_routes
from app.core.config import Settings, get_settings
from app.main import create_app


@pytest.fixture()
def client() -> Generator[TestClient, None, None]:
    test_app = create_app(Settings(APP_ENV="test"))
    with TestClient(test_app) as test_client:
        yield test_client


def test_health_returns_ok(client: TestClient) -> None:
    response = client.get("/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_ready_returns_ok_when_dependencies_are_available(
    client: TestClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(health_routes, "check_database_connection", lambda: True)
    monkeypatch.setattr(
        health_routes,
        "check_listing_images_bucket",
        lambda settings: True,
    )

    response = client.get("/ready")

    assert response.status_code == 200
    assert response.json() == {
        "status": "ok",
        "checks": {
            "database": "ok",
            "object_storage": "ok",
        },
    }


def test_ready_returns_503_when_database_is_unavailable(
    client: TestClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    def database_failure() -> bool:
        raise RuntimeError("database unavailable")

    monkeypatch.setattr(health_routes, "check_database_connection", database_failure)
    monkeypatch.setattr(
        health_routes,
        "check_listing_images_bucket",
        lambda settings: True,
    )

    response = client.get("/ready")

    assert response.status_code == 503
    assert response.json() == {
        "status": "error",
        "checks": {
            "database": "error",
            "object_storage": "ok",
        },
        "errors": {
            "database": "Database dependency is unavailable.",
        },
    }


def test_production_cors_only_allows_configured_frontend_origin() -> None:
    app = create_app(_production_settings())

    with TestClient(app) as client:
        allowed = client.get(
            "/health",
            headers={"Origin": "https://rooms.example.com"},
        )
        blocked = client.get(
            "/health",
            headers={"Origin": "https://unexpected.example.com"},
        )

    assert allowed.headers["access-control-allow-origin"] == "https://rooms.example.com"
    assert allowed.headers["access-control-allow-credentials"] == "true"
    assert "access-control-allow-origin" not in blocked.headers


def test_production_cors_preflight_allows_auth_headers_for_each_configured_origin() -> None:
    app = create_app(
        _production_settings(
            CORS_ALLOWED_ORIGINS="https://rooms.example.com,https://www.rooms.example.com"
        )
    )

    with TestClient(app) as client:
        response = client.options(
            "/me/listings",
            headers={
                "Origin": "https://www.rooms.example.com",
                "Access-Control-Request-Method": "GET",
                "Access-Control-Request-Headers": "authorization,content-type",
            },
        )

    assert response.status_code == 200
    assert response.headers["access-control-allow-origin"] == "https://www.rooms.example.com"
    assert "Authorization" in response.headers["access-control-allow-headers"]
    assert "Content-Type" in response.headers["access-control-allow-headers"]


def test_production_cors_allows_configured_vercel_preview_origin() -> None:
    app = create_app(
        _production_settings(
            FRONTEND_PREVIEW_ORIGIN_REGEX=(
                r"^https://roomwise-marketplace-git-[a-z0-9-]+-roomwise-team\.vercel\.app$"
            )
        )
    )

    with TestClient(app) as client:
        allowed = client.get(
            "/health",
            headers={"Origin": "https://roomwise-marketplace-git-main-roomwise-team.vercel.app"},
        )
        unrelated = client.get(
            "/health",
            headers={"Origin": "https://different-project-git-main-roomwise-team.vercel.app"},
        )
        external = client.get(
            "/health",
            headers={"Origin": "https://unexpected.example.com"},
        )

    assert (
        allowed.headers["access-control-allow-origin"]
        == "https://roomwise-marketplace-git-main-roomwise-team.vercel.app"
    )
    assert allowed.headers["access-control-allow-credentials"] == "true"
    assert "access-control-allow-origin" not in unrelated.headers
    assert "access-control-allow-origin" not in external.headers


def test_production_cors_rejects_preview_origin_when_preview_support_is_disabled() -> None:
    app = create_app(_production_settings())

    with TestClient(app) as client:
        blocked = client.get(
            "/health",
            headers={"Origin": "https://roomwise-marketplace-git-main-roomwise-team.vercel.app"},
        )

    assert "access-control-allow-origin" not in blocked.headers


def test_missing_production_frontend_origin_fails_clearly() -> None:
    with pytest.raises(ValidationError, match="CORS_ALLOWED_ORIGINS"):
        _production_settings(FRONTEND_ORIGIN="")


def test_invalid_preview_origin_regex_fails_clearly() -> None:
    with pytest.raises(ValidationError, match="FRONTEND_PREVIEW_ORIGIN_REGEX"):
        _production_settings(FRONTEND_PREVIEW_ORIGIN_REGEX="(")


def test_local_only_storage_host_is_rejected_in_non_local_environment() -> None:
    with pytest.raises(ValidationError, match="MINIO_ENDPOINT"):
        _production_settings(MINIO_ENDPOINT="http://minio:9000")


def test_local_configuration_remains_supported() -> None:
    settings = Settings(APP_ENV="local")

    assert settings.is_local is True
    assert settings.frontend_origin.startswith("http://")
    assert "marketplace_db" in settings.database_url
    assert settings.alembic_database_url == settings.database_url


def test_s3_access_key_aliases_are_supported(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("APP_ENV", "production")
    monkeypatch.setenv("FRONTEND_ORIGIN", "https://rooms.example.com")
    monkeypatch.setenv(
        "DATABASE_URL",
        "postgresql+psycopg://user:password@db.example.com:6543/marketplace",
    )
    monkeypatch.setenv("MINIO_ENDPOINT", "https://storage.example.com/storage/v1/s3")
    monkeypatch.setenv(
        "MINIO_PUBLIC_URL",
        "https://project.supabase.co/storage/v1/object/public",
    )
    monkeypatch.setenv("MINIO_ACCESS_KEY", "access-key")
    monkeypatch.setenv("MINIO_SECRET_KEY", "secret-key")
    monkeypatch.setenv("MINIO_BUCKET_LISTING_IMAGES", "rooms_marketplace")
    monkeypatch.setenv("CLERK_SECRET_KEY", "sk_test_example")
    monkeypatch.setenv("CLERK_WEBHOOK_SIGNING_SECRET", "whsec_example")
    get_settings.cache_clear()
    settings = Settings()

    assert settings.minio_root_user == "access-key"
    assert settings.minio_root_password == "secret-key"


def test_migration_database_url_overrides_runtime_database_url() -> None:
    settings = _production_settings(
        DATABASE_URL="postgresql+psycopg://user:password@aws-eu-west-1.pooler.supabase.com:6543/postgres",
        MIGRATION_DATABASE_URL="postgresql+psycopg://user:password@aws-eu-west-1.pooler.supabase.com:5432/postgres",
    )

    assert settings.alembic_database_url == (
        "postgresql+psycopg://user:password@aws-eu-west-1.pooler.supabase.com:"
        "5432/postgres?sslmode=verify-full"
    )


def test_supabase_pgbouncer_hint_is_removed_for_sqlalchemy() -> None:
    settings = _production_settings(
        DATABASE_URL=(
            "postgresql+psycopg://user:password@aws-eu-west-1.pooler.supabase.com:"
            "6543/postgres?pgbouncer=true&sslmode=verify-full"
        )
    )

    assert settings.sqlalchemy_database_url == (
        "postgresql+psycopg://user:password@aws-eu-west-1.pooler.supabase.com:"
        "6543/postgres?sslmode=verify-full"
    )


def test_production_database_url_defaults_to_certificate_verification() -> None:
    settings = _production_settings()

    assert settings.sqlalchemy_database_url.endswith("?sslmode=verify-full")


def test_production_database_url_rejects_non_verifying_tls_mode() -> None:
    with pytest.raises(ValidationError, match="sslmode"):
        _production_settings(
            DATABASE_URL=(
                "postgresql+psycopg://user:password@db.example.com:5432/"
                "marketplace?sslmode=require"
            )
        )


def test_port_environment_and_object_storage_contract_aliases() -> None:
    settings = Settings(
        ENVIRONMENT="test",
        PORT=9123,
        OBJECT_STORAGE_ENDPOINT="https://storage.example.com",
        OBJECT_STORAGE_BUCKET="images",
        OBJECT_STORAGE_ACCESS_KEY="access",
        OBJECT_STORAGE_SECRET_KEY="secret",
        OBJECT_STORAGE_REGION="westeurope",
        OBJECT_STORAGE_PUBLIC_URL="https://cdn.example.com",
        CLERK_WEBHOOK_SECRET="whsec_example",
    )

    assert settings.api_port == 9123
    assert settings.minio_endpoint == "https://storage.example.com"
    assert settings.minio_bucket_listing_images == "images"
    assert settings.minio_root_user == "access"
    assert settings.minio_root_password == "secret"
    assert settings.clerk_webhook_signing_secret == "whsec_example"


def _production_settings(**overrides: str) -> Settings:
    values = {
        # Use the canonical variable so this fixture takes precedence over the
        # legacy APP_ENV=test exported by the CI job with pydantic-settings 2.7.
        "ENVIRONMENT": "production",
        "FRONTEND_ORIGIN": "https://rooms.example.com",
        "DATABASE_URL": "postgresql+psycopg://user:password@db.example.com:5432/marketplace",
        "MINIO_ENDPOINT": "https://storage.example.com",
        "MINIO_PUBLIC_URL": "https://cdn.example.com",
        "MINIO_ROOT_USER": "access-key",
        "MINIO_ROOT_PASSWORD": "secret-key",
        "MINIO_BUCKET_LISTING_IMAGES": "listing-images",
        "CLERK_SECRET_KEY": "sk_test_example",
        "CLERK_WEBHOOK_SIGNING_SECRET": "whsec_example",
    }
    values.update(overrides)
    return Settings(**values)
