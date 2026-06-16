"""add listing image metadata

Revision ID: 20260616_0003
Revises: 20260616_0002
Create Date: 2026-06-16 00:00:02.000000
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "20260616_0003"
down_revision: Union[str, None] = "20260616_0002"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "listing_images",
        sa.Column(
            "content_type",
            sa.String(length=100),
            server_default="image/jpeg",
            nullable=False,
        ),
    )
    op.add_column(
        "listing_images",
        sa.Column("size_bytes", sa.Integer(), server_default="0", nullable=False),
    )
    op.alter_column("listing_images", "content_type", server_default=None)
    op.alter_column("listing_images", "size_bytes", server_default=None)


def downgrade() -> None:
    op.drop_column("listing_images", "size_bytes")
    op.drop_column("listing_images", "content_type")
