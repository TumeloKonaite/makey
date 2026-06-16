"""create marketplace tables

Revision ID: 20260616_0001
Revises:
Create Date: 2026-06-16 00:00:00.000000
"""

from typing import Sequence, Union
import uuid

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "20260616_0001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

categories_table = sa.table(
    "categories",
    sa.column("id", postgresql.UUID(as_uuid=True)),
    sa.column("name", sa.String),
    sa.column("slug", sa.String),
    sa.column("description", sa.Text),
)


def upgrade() -> None:
    op.create_table(
        "users",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("keycloak_user_id", sa.String(length=255), nullable=False),
        sa.Column("email", sa.String(length=255), nullable=False),
        sa.Column("display_name", sa.String(length=160), nullable=False),
        sa.Column(
            "role",
            sa.String(length=30),
            server_default="customer",
            nullable=False,
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("CURRENT_TIMESTAMP"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("CURRENT_TIMESTAMP"),
            nullable=False,
        ),
        sa.CheckConstraint(
            "role IN ('provider', 'customer', 'admin')",
            name="ck_users_role",
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_users_email"), "users", ["email"], unique=True)
    op.create_index(
        op.f("ix_users_keycloak_user_id"),
        "users",
        ["keycloak_user_id"],
        unique=True,
    )

    op.create_table(
        "categories",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("name", sa.String(length=120), nullable=False),
        sa.Column("slug", sa.String(length=140), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("CURRENT_TIMESTAMP"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("CURRENT_TIMESTAMP"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_categories_name"), "categories", ["name"], unique=True)
    op.create_index(op.f("ix_categories_slug"), "categories", ["slug"], unique=True)

    op.create_table(
        "listings",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("provider_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("category_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("title", sa.String(length=180), nullable=False),
        sa.Column("slug", sa.String(length=220), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("price", sa.Numeric(precision=10, scale=2), nullable=False),
        sa.Column(
            "currency",
            sa.String(length=3),
            server_default="ZAR",
            nullable=False,
        ),
        sa.Column("location", sa.String(length=255), nullable=True),
        sa.Column(
            "status",
            sa.String(length=30),
            server_default="draft",
            nullable=False,
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("CURRENT_TIMESTAMP"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("CURRENT_TIMESTAMP"),
            nullable=False,
        ),
        sa.CheckConstraint(
            "status IN ('draft', 'published', 'archived')",
            name="ck_listings_status",
        ),
        sa.ForeignKeyConstraint(["category_id"], ["categories.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["provider_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_listings_category_id"), "listings", ["category_id"])
    op.create_index(op.f("ix_listings_provider_id"), "listings", ["provider_id"])
    op.create_index(op.f("ix_listings_slug"), "listings", ["slug"], unique=True)

    op.create_table(
        "listing_images",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("listing_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("object_name", sa.String(length=512), nullable=False),
        sa.Column("image_url", sa.String(length=2048), nullable=False),
        sa.Column("display_order", sa.Integer(), server_default="0", nullable=False),
        sa.Column("is_cover", sa.Boolean(), server_default="false", nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("CURRENT_TIMESTAMP"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["listing_id"], ["listings.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_listing_images_listing_id"),
        "listing_images",
        ["listing_id"],
    )

    op.create_table(
        "enquiries",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("listing_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("customer_name", sa.String(length=160), nullable=False),
        sa.Column("customer_email", sa.String(length=255), nullable=False),
        sa.Column("customer_phone", sa.String(length=50), nullable=True),
        sa.Column("message", sa.Text(), nullable=False),
        sa.Column(
            "status",
            sa.String(length=30),
            server_default="new",
            nullable=False,
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("CURRENT_TIMESTAMP"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("CURRENT_TIMESTAMP"),
            nullable=False,
        ),
        sa.CheckConstraint(
            "status IN ('new', 'responded', 'closed')",
            name="ck_enquiries_status",
        ),
        sa.ForeignKeyConstraint(["listing_id"], ["listings.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_enquiries_customer_email"), "enquiries", ["customer_email"])
    op.create_index(op.f("ix_enquiries_listing_id"), "enquiries", ["listing_id"])

    op.bulk_insert(
        categories_table,
        [
            {
                "id": uuid.UUID("3c67a6cc-29c5-4d46-b6f9-262056d9cb70"),
                "name": "Hair",
                "slug": "hair",
                "description": "Hair styling, treatments, and care services.",
            },
            {
                "id": uuid.UUID("ff0cd8f5-e0aa-4874-8ad6-4566ed6e851e"),
                "name": "Nails",
                "slug": "nails",
                "description": "Manicures, pedicures, nail art, and nail care.",
            },
            {
                "id": uuid.UUID("b4d3a492-5b4f-4082-98fd-65d02af692e8"),
                "name": "Makeup",
                "slug": "makeup",
                "description": "Makeup artists and cosmetic beauty services.",
            },
            {
                "id": uuid.UUID("47011f81-cdb4-4878-b703-f1a95bcf1325"),
                "name": "Lashes",
                "slug": "lashes",
                "description": "Lash extensions, lifts, tinting, and care.",
            },
            {
                "id": uuid.UUID("75935698-a0a9-460e-9935-7971ca54ed7d"),
                "name": "Brows",
                "slug": "brows",
                "description": "Brow shaping, tinting, lamination, and styling.",
            },
            {
                "id": uuid.UUID("8b40fe62-0cd5-4a74-8575-2c7025189293"),
                "name": "Skincare",
                "slug": "skincare",
                "description": "Facials, skin treatments, and skincare services.",
            },
            {
                "id": uuid.UUID("e738b4e8-d77d-49c4-8f96-becaa1a9c8aa"),
                "name": "Massage",
                "slug": "massage",
                "description": "Massage therapy and relaxation services.",
            },
            {
                "id": uuid.UUID("4714361d-c8dc-44d0-93fb-b905d1f4726f"),
                "name": "Barber",
                "slug": "barber",
                "description": "Barber cuts, grooming, shaving, and styling.",
            },
            {
                "id": uuid.UUID("9559be3e-48a2-41ea-95ef-43e0ad85de55"),
                "name": "Spa",
                "slug": "spa",
                "description": "Spa packages, wellness treatments, and pampering.",
            },
        ],
    )


def downgrade() -> None:
    op.drop_index(op.f("ix_enquiries_listing_id"), table_name="enquiries")
    op.drop_index(op.f("ix_enquiries_customer_email"), table_name="enquiries")
    op.drop_table("enquiries")

    op.drop_index(op.f("ix_listing_images_listing_id"), table_name="listing_images")
    op.drop_table("listing_images")

    op.drop_index(op.f("ix_listings_slug"), table_name="listings")
    op.drop_index(op.f("ix_listings_provider_id"), table_name="listings")
    op.drop_index(op.f("ix_listings_category_id"), table_name="listings")
    op.drop_table("listings")

    op.drop_index(op.f("ix_categories_slug"), table_name="categories")
    op.drop_index(op.f("ix_categories_name"), table_name="categories")
    op.drop_table("categories")

    op.drop_index(op.f("ix_users_keycloak_user_id"), table_name="users")
    op.drop_index(op.f("ix_users_email"), table_name="users")
    op.drop_table("users")
