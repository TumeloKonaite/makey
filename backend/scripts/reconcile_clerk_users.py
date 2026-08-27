from __future__ import annotations

import argparse
import csv
from pathlib import Path

from sqlalchemy import create_engine, text

from app.core.config import get_settings


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Backfill users.clerk_user_id from a reviewed Keycloak-to-Clerk CSV mapping."
    )
    parser.add_argument(
        "mapping",
        type=Path,
        help="CSV with keycloak_user_id and clerk_user_id columns",
    )
    return parser.parse_args()


def load_mapping(path: Path) -> list[dict[str, str]]:
    with path.open(newline="", encoding="utf-8") as handle:
        rows = list(csv.DictReader(handle))
    required = {"keycloak_user_id", "clerk_user_id"}
    if not rows or not required.issubset(rows[0]):
        raise SystemExit(
            "Mapping CSV must contain keycloak_user_id and clerk_user_id columns."
        )
    if any(not row["keycloak_user_id"].strip() or not row["clerk_user_id"].strip() for row in rows):
        raise SystemExit("Mapping CSV contains an empty identity value.")
    clerk_ids = [row["clerk_user_id"].strip() for row in rows]
    if len(clerk_ids) != len(set(clerk_ids)):
        raise SystemExit("Mapping CSV contains duplicate Clerk user IDs.")
    return rows


def main() -> None:
    rows = load_mapping(parse_args().mapping)
    engine = create_engine(get_settings().alembic_database_url)
    updated = 0
    with engine.begin() as connection:
        for row in rows:
            result = connection.execute(
                text(
                    """
                    UPDATE users
                    SET clerk_user_id = :clerk_user_id
                    WHERE keycloak_user_id = :keycloak_user_id
                      AND (clerk_user_id IS NULL OR clerk_user_id = :clerk_user_id)
                    """
                ),
                {
                    "keycloak_user_id": row["keycloak_user_id"].strip(),
                    "clerk_user_id": row["clerk_user_id"].strip(),
                },
            )
            if result.rowcount != 1:
                raise SystemExit(
                    f"No unambiguous local match for Keycloak user {row['keycloak_user_id']!r}."
                )
            updated += 1

        missing = connection.scalar(
            text("SELECT count(*) FROM users WHERE clerk_user_id IS NULL")
        )
        if missing:
            raise SystemExit(
                f"Updated {updated} user(s), but {missing} local user(s) still need reconciliation."
            )

    print(f"Reconciled {updated} user(s); the Clerk finalization migration can now run.")


if __name__ == "__main__":
    main()
