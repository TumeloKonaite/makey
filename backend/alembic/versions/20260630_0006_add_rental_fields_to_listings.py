"""add rental fields to listings

Revision ID: 20260630_0006
Revises: 20260630_0005
Create Date: 2026-06-30 00:00:00.000000
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "20260630_0006"
down_revision: Union[str, None] = "20260630_0005"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("listings", sa.Column("rent_amount", sa.Numeric(10, 2), nullable=True))
    op.add_column(
        "listings",
        sa.Column("deposit_amount", sa.Numeric(10, 2), nullable=True),
    )
    op.add_column("listings", sa.Column("agent_fee", sa.Numeric(10, 2), nullable=True))
    op.add_column("listings", sa.Column("available_date", sa.Date(), nullable=True))
    op.add_column("listings", sa.Column("is_furnished", sa.Boolean(), nullable=True))
    op.add_column(
        "listings",
        sa.Column("utilities_included", sa.Boolean(), nullable=True),
    )
    op.add_column(
        "listings",
        sa.Column("parking_available", sa.Boolean(), nullable=True),
    )
    op.add_column("listings", sa.Column("max_occupants", sa.Integer(), nullable=True))
    op.add_column("listings", sa.Column("area", sa.String(length=160), nullable=True))


def downgrade() -> None:
    op.drop_column("listings", "area")
    op.drop_column("listings", "max_occupants")
    op.drop_column("listings", "parking_available")
    op.drop_column("listings", "utilities_included")
    op.drop_column("listings", "is_furnished")
    op.drop_column("listings", "available_date")
    op.drop_column("listings", "agent_fee")
    op.drop_column("listings", "deposit_amount")
    op.drop_column("listings", "rent_amount")
