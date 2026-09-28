from app.scripts.verify_migration_state import revisions_match


def test_revision_verification_requires_one_matching_head() -> None:
    assert revisions_match(("head",), ("head",))
    assert not revisions_match((), ("head",))
    assert not revisions_match(("old",), ("head",))
    assert not revisions_match(("one", "two"), ("one",))
    assert not revisions_match(("one",), ("one", "two"))


from app.core.config import MigrationSettings


def test_migration_settings_require_only_database_configuration() -> None:
    settings = MigrationSettings(
        ENVIRONMENT="production",
        DATABASE_URL=(
            "postgresql+psycopg://user:password@db.example.com/database"
            "?sslmode=verify-full"
        ),
        MIGRATION_DATABASE_URL=None,
    )
    assert "sslmode=verify-full" in settings.alembic_database_url


def test_migration_settings_reject_weak_production_tls() -> None:
    settings = MigrationSettings(
        ENVIRONMENT="production",
        DATABASE_URL="postgresql+psycopg://user:password@db.example.com/database?sslmode=require",
        MIGRATION_DATABASE_URL=None,
    )
    import pytest
    with pytest.raises(ValueError, match="verify PostgreSQL TLS"):
        _ = settings.alembic_database_url
