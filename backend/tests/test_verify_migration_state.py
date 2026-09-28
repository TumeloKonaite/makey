import subprocess
import sys

import pytest
from app.core.config import MigrationSettings
from app.scripts.verify_migration_state import revisions_match


def test_revision_verification_requires_one_matching_head() -> None:
    assert revisions_match(("head",), ("head",))
    assert not revisions_match((), ("head",))
    assert not revisions_match(("old",), ("head",))
    assert not revisions_match(("one", "two"), ("one",))
    assert not revisions_match(("one",), ("one", "two"))


def test_migration_settings_require_only_database_configuration() -> None:
    settings = MigrationSettings(
        ENVIRONMENT="production",
        DATABASE_URL=(
            "postgresql+psycopg://user:password@db.example.com/database?sslmode=verify-full"
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
    with pytest.raises(ValueError, match="verify PostgreSQL TLS"):
        _ = settings.alembic_database_url


def test_alembic_metadata_import_does_not_initialize_api_settings() -> None:
    result = subprocess.run(
        [
            sys.executable,
            "-c",
            (
                "from unittest.mock import patch; "
                "with_patch = patch('app.core.config.get_settings', "
                "side_effect=AssertionError('full settings initialized')); "
                "with_patch.start(); "
                "import app.repository.database.tables.alembic_bootstrap"
            ),
        ],
        cwd=".",
        capture_output=True,
        text=True,
        check=False,
    )
    assert result.returncode == 0, result.stderr
