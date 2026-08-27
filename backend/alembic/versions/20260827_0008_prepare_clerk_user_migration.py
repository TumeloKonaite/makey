"""prepare Clerk user migration

Revision ID: 20260827_0008
Revises: 20260630_0007
Create Date: 2026-08-27 00:00:00.000000
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "20260827_0008"
down_revision: Union[str, None] = "20260630_0007"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column("clerk_user_id", sa.String(length=255), nullable=True),
    )
    op.create_index(
        op.f("ix_users_clerk_user_id"),
        "users",
        ["clerk_user_id"],
        unique=True,
    )
    op.alter_column(
        "users",
        "keycloak_user_id",
        existing_type=sa.String(length=255),
        nullable=True,
    )

    # Legacy owner-like accounts are deliberately not promoted.
    op.drop_constraint("ck_users_role", "users", type_="check")
    op.execute(
        """
        UPDATE users
        SET role = CASE
            WHEN role = 'admin' THEN 'admin'
            ELSE 'renter'
        END
        """
    )
    op.create_check_constraint(
        "ck_users_role",
        "users",
        "role IN ('admin', 'renter')",
    )
    op.alter_column("users", "role", server_default="renter")


def downgrade() -> None:
    op.alter_column("users", "role", server_default="customer")
    op.drop_constraint("ck_users_role", "users", type_="check")
    op.execute("UPDATE users SET role = 'customer' WHERE role = 'renter'")
    op.create_check_constraint(
        "ck_users_role",
        "users",
        "role IN ('provider', 'customer', 'admin')",
    )
    op.execute(
        "UPDATE users SET keycloak_user_id = clerk_user_id WHERE keycloak_user_id IS NULL"
    )
    op.alter_column(
        "users",
        "keycloak_user_id",
        existing_type=sa.String(length=255),
        nullable=False,
    )
    op.drop_index(op.f("ix_users_clerk_user_id"), table_name="users")
    op.drop_column("users", "clerk_user_id")
