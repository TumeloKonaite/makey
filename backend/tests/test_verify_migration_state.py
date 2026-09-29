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


class MigrationRecorder:
    def __init__(self) -> None:
        self.calls: list[tuple[str, object]] = []

    def execute(self, statement: object) -> None:
        self.calls.append(("execute", str(statement)))

    def add_column(self, table: str, column: object) -> None:
        self.calls.append(("add_column", (table, column.name)))

    def create_check_constraint(self, name: str, table: str, condition: str) -> None:
        self.calls.append(("create_check_constraint", (name, table, condition)))

    def drop_constraint(self, name: str, table: str, **kwargs: str) -> None:
        self.calls.append(("drop_constraint", (name, table, kwargs)))

    def drop_column(self, table: str, column: str) -> None:
        self.calls.append(("drop_column", (table, column)))


def load_location_migration() -> object:
    import importlib.util
    from pathlib import Path

    path = (
        Path(__file__).resolve().parents[1]
        / "alembic"
        / "versions"
        / "20260929_0010_add_structured_listing_locations.py"
    )
    spec = importlib.util.spec_from_file_location("location_migration", path)
    assert spec is not None and spec.loader is not None
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def test_location_migration_upgrade_and_downgrade_operations() -> None:
    migration = load_location_migration()
    recorder = MigrationRecorder()
    migration.op = recorder

    migration.upgrade()

    upgrade_sql = " ".join(call[1] for call in recorder.calls if call[0] == "execute")
    added_columns = {call[1][1] for call in recorder.calls if call[0] == "add_column"}
    assert "CREATE EXTENSION IF NOT EXISTS postgis" in upgrade_sql
    assert "geography(Point, 4326)" in upgrade_sql
    assert "USING GIST (coordinates)" in upgrade_sql
    assert added_columns == {
        "address_line",
        "city",
        "province",
        "postal_code",
        "country_code",
        "latitude",
        "longitude",
        "geocoding_provider",
        "geocoding_place_id",
    }

    recorder.calls.clear()
    migration.downgrade()

    downgrade_sql = " ".join(call[1] for call in recorder.calls if call[0] == "execute")
    dropped_columns = {call[1][1] for call in recorder.calls if call[0] == "drop_column"}
    assert "DROP INDEX IF EXISTS ix_listings_coordinates_gist" in downgrade_sql
    assert "DROP COLUMN coordinates" in downgrade_sql
    assert dropped_columns == added_columns
