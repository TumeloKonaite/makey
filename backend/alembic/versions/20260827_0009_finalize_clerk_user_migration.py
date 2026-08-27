"""finalize Clerk user migration after reconciliation

Revision ID: 20260827_0009
Revises: 20260827_0008
Create Date: 2026-08-27 00:00:01.000000
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "20260827_0009"
down_revision: Union[str, None] = "20260827_0008"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    connection = op.get_bind()
    missing = connection.scalar(
        sa.text("SELECT count(*) FROM users WHERE clerk_user_id IS NULL")
    )
    if missing:
        raise RuntimeError(
            f"Cannot finalize Clerk cutover: {missing} user(s) are not reconciled. "
            "Run python -m scripts.reconcile_clerk_users before upgrading to head."
        )

    op.alter_column(
        "users",
        "clerk_user_id",
        existing_type=sa.String(length=255),
        nullable=False,
    )
    op.drop_index(op.f("ix_users_keycloak_user_id"), table_name="users")
    op.drop_column("users", "keycloak_user_id")


def downgrade() -> None:
    op.add_column(
        "users",
        sa.Column("keycloak_user_id", sa.String(length=255), nullable=True),
    )
    op.execute("UPDATE users SET keycloak_user_id = clerk_user_id")
    op.alter_column(
        "users",
        "keycloak_user_id",
        existing_type=sa.String(length=255),
        nullable=False,
    )
    op.create_index(
        op.f("ix_users_keycloak_user_id"),
        "users",
        ["keycloak_user_id"],
        unique=True,
    )
    op.alter_column(
        "users",
        "clerk_user_id",
        existing_type=sa.String(length=255),
        nullable=True,
    )
