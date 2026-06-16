"""add enquiry customer and owner

Revision ID: 20260616_0004
Revises: 20260616_0003
Create Date: 2026-06-16 00:00:03.000000
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "20260616_0004"
down_revision: Union[str, None] = "20260616_0003"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "enquiries",
        sa.Column("customer_id", postgresql.UUID(as_uuid=True), nullable=True),
    )
    op.add_column(
        "enquiries",
        sa.Column("listing_owner_id", postgresql.UUID(as_uuid=True), nullable=True),
    )
    op.execute(
        """
        UPDATE enquiries
        SET listing_owner_id = listings.provider_id
        FROM listings
        WHERE enquiries.listing_id = listings.id
        """
    )
    op.alter_column("enquiries", "listing_owner_id", nullable=False)
    op.create_index(op.f("ix_enquiries_customer_id"), "enquiries", ["customer_id"])
    op.create_index(
        op.f("ix_enquiries_listing_owner_id"),
        "enquiries",
        ["listing_owner_id"],
    )
    op.create_foreign_key(
        op.f("fk_enquiries_customer_id_users"),
        "enquiries",
        "users",
        ["customer_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_foreign_key(
        op.f("fk_enquiries_listing_owner_id_users"),
        "enquiries",
        "users",
        ["listing_owner_id"],
        ["id"],
        ondelete="CASCADE",
    )


def downgrade() -> None:
    op.drop_constraint(op.f("fk_enquiries_listing_owner_id_users"), "enquiries")
    op.drop_constraint(op.f("fk_enquiries_customer_id_users"), "enquiries")
    op.drop_index(op.f("ix_enquiries_listing_owner_id"), table_name="enquiries")
    op.drop_index(op.f("ix_enquiries_customer_id"), table_name="enquiries")
    op.drop_column("enquiries", "listing_owner_id")
    op.drop_column("enquiries", "customer_id")
