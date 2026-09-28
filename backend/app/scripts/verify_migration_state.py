"""Fail unless the connected database is at the repository's single Alembic head."""

from alembic.config import Config
from alembic.runtime.migration import MigrationContext
from alembic.script import ScriptDirectory
from sqlalchemy import create_engine
from sqlalchemy.pool import NullPool

from app.core.config import get_migration_settings


def revisions_match(current: tuple[str, ...], expected: tuple[str, ...]) -> bool:
    return len(expected) == 1 and len(current) == 1 and current == expected


def main() -> int:
    config = Config("/app/alembic.ini")
    expected = tuple(ScriptDirectory.from_config(config).get_heads())
    if len(expected) != 1:
        print(f"ERROR: repository has {len(expected)} Alembic heads: {', '.join(expected)}")
        return 1

    engine = create_engine(
        get_migration_settings().alembic_database_url,
        poolclass=NullPool,
    )
    try:
        with engine.connect() as connection:
            current = tuple(MigrationContext.configure(connection).get_current_heads())
    finally:
        engine.dispose()

    print(f"Expected Alembic head: {expected[0]}")
    print(f"Current database revision(s): {', '.join(current) or '<none>'}")
    if not revisions_match(current, expected):
        print("ERROR: database revision does not match the repository head.")
        return 1
    print("Database revision matches the repository head.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
