"""add rental fields to enquiries

Revision ID: 20260630_0007
Revises: 20260630_0006
Create Date: 2026-06-30 00:00:00.000000
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "20260630_0007"
down_revision: Union[str, None] = "20260630_0006"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.alter_column("enquiries", "customer_email", nullable=True)
    op.add_column(
        "enquiries",
        sa.Column("desired_move_in_date", sa.Date(), nullable=True),
    )
    op.add_column("enquiries", sa.Column("occupant_count", sa.Integer(), nullable=True))
    op.add_column(
        "enquiries",
        sa.Column(
            "is_viewing_requested",
            sa.Boolean(),
            nullable=False,
            server_default=sa.false(),
        ),
    )
    op.add_column(
        "enquiries",
        sa.Column("preferred_viewing_date", sa.Date(), nullable=True),
    )
    op.add_column(
        "enquiries",
        sa.Column("preferred_viewing_time", sa.Time(), nullable=True),
    )
    op.add_column("enquiries", sa.Column("viewing_notes", sa.Text(), nullable=True))
    op.create_check_constraint(
        "ck_enquiries_occupant_count_positive",
        "enquiries",
        "occupant_count IS NULL OR occupant_count > 0",
    )


def downgrade() -> None:
    op.drop_constraint(
        "ck_enquiries_occupant_count_positive",
        "enquiries",
        type_="check",
    )
    op.drop_column("enquiries", "viewing_notes")
    op.drop_column("enquiries", "preferred_viewing_time")
    op.drop_column("enquiries", "preferred_viewing_date")
    op.drop_column("enquiries", "is_viewing_requested")
    op.drop_column("enquiries", "occupant_count")
    op.drop_column("enquiries", "desired_move_in_date")
    op.alter_column("enquiries", "customer_email", nullable=False)
