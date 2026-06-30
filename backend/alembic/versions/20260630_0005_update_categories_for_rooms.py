"""update categories for rooms marketplace

Revision ID: 20260630_0005
Revises: 20260616_0004
Create Date: 2026-06-30 00:00:00.000000
"""

from typing import Sequence, Union
import uuid

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "20260630_0005"
down_revision: Union[str, None] = "20260616_0004"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

categories_table = sa.table(
    "categories",
    sa.column("id", postgresql.UUID(as_uuid=True)),
    sa.column("name", sa.String),
    sa.column("slug", sa.String),
    sa.column("description", sa.Text),
    sa.column("is_active", sa.Boolean),
)

ROOM_CATEGORIES = [
    {
        "id": uuid.UUID("3c67a6cc-29c5-4d46-b6f9-262056d9cb70"),
        "name": "Single room",
        "slug": "single-room",
        "description": "Private single-occupancy rooms for one tenant.",
        "is_active": True,
    },
    {
        "id": uuid.UUID("ff0cd8f5-e0aa-4874-8ad6-4566ed6e851e"),
        "name": "Shared room",
        "slug": "shared-room",
        "description": "Shared rooms with a lower monthly rent option.",
        "is_active": True,
    },
    {
        "id": uuid.UUID("b4d3a492-5b4f-4082-98fd-65d02af692e8"),
        "name": "Ensuite room",
        "slug": "ensuite",
        "description": "Rooms with a private bathroom included.",
        "is_active": True,
    },
    {
        "id": uuid.UUID("47011f81-cdb4-4878-b703-f1a95bcf1325"),
        "name": "Studio",
        "slug": "studio",
        "description": "Open-plan studio spaces with compact living areas.",
        "is_active": True,
    },
    {
        "id": uuid.UUID("75935698-a0a9-460e-9935-7971ca54ed7d"),
        "name": "One-bedroom",
        "slug": "one-bedroom",
        "description": "Self-contained one-bedroom apartments and flats.",
        "is_active": True,
    },
    {
        "id": uuid.UUID("8b40fe62-0cd5-4a74-8575-2c7025189293"),
        "name": "Bachelor flat",
        "slug": "bachelor-flat",
        "description": "Compact bachelor flats for independent living.",
        "is_active": True,
    },
    {
        "id": uuid.UUID("e738b4e8-d77d-49c4-8f96-becaa1a9c8aa"),
        "name": "Two-bedroom",
        "slug": "two-bedroom",
        "description": "Two-bedroom rentals suited to couples or small families.",
        "is_active": True,
    },
    {
        "id": uuid.UUID("4714361d-c8dc-44d0-93fb-b905d1f4726f"),
        "name": "Cottage",
        "slug": "cottage",
        "description": "Standalone cottages and garden flats with extra privacy.",
        "is_active": True,
    },
    {
        "id": uuid.UUID("9559be3e-48a2-41ea-95ef-43e0ad85de55"),
        "name": "House share",
        "slug": "house-share",
        "description": "Rooms in shared houses with communal living spaces.",
        "is_active": True,
    },
]

BEAUTY_CATEGORIES = [
    {
        "id": uuid.UUID("3c67a6cc-29c5-4d46-b6f9-262056d9cb70"),
        "name": "Hair",
        "slug": "hair",
        "description": "Hair styling, treatments, and care services.",
        "is_active": True,
    },
    {
        "id": uuid.UUID("ff0cd8f5-e0aa-4874-8ad6-4566ed6e851e"),
        "name": "Nails",
        "slug": "nails",
        "description": "Manicures, pedicures, nail art, and nail care.",
        "is_active": True,
    },
    {
        "id": uuid.UUID("b4d3a492-5b4f-4082-98fd-65d02af692e8"),
        "name": "Makeup",
        "slug": "makeup",
        "description": "Makeup artists and cosmetic beauty services.",
        "is_active": True,
    },
    {
        "id": uuid.UUID("47011f81-cdb4-4878-b703-f1a95bcf1325"),
        "name": "Lashes",
        "slug": "lashes",
        "description": "Lash extensions, lifts, tinting, and care.",
        "is_active": True,
    },
    {
        "id": uuid.UUID("75935698-a0a9-460e-9935-7971ca54ed7d"),
        "name": "Brows",
        "slug": "brows",
        "description": "Brow shaping, tinting, lamination, and styling.",
        "is_active": True,
    },
    {
        "id": uuid.UUID("8b40fe62-0cd5-4a74-8575-2c7025189293"),
        "name": "Skincare",
        "slug": "skincare",
        "description": "Facials, skin treatments, and skincare services.",
        "is_active": True,
    },
    {
        "id": uuid.UUID("e738b4e8-d77d-49c4-8f96-becaa1a9c8aa"),
        "name": "Massage",
        "slug": "massage",
        "description": "Massage therapy and relaxation services.",
        "is_active": True,
    },
    {
        "id": uuid.UUID("4714361d-c8dc-44d0-93fb-b905d1f4726f"),
        "name": "Barber",
        "slug": "barber",
        "description": "Barber cuts, grooming, shaving, and styling.",
        "is_active": True,
    },
    {
        "id": uuid.UUID("9559be3e-48a2-41ea-95ef-43e0ad85de55"),
        "name": "Spa",
        "slug": "spa",
        "description": "Spa packages, wellness treatments, and pampering.",
        "is_active": True,
    },
]


def _upsert_categories(rows: list[dict[str, object]]) -> None:
    statement = postgresql.insert(categories_table).values(rows)
    op.execute(
        statement.on_conflict_do_update(
            index_elements=["id"],
            set_={
                "name": statement.excluded.name,
                "slug": statement.excluded.slug,
                "description": statement.excluded.description,
                "is_active": statement.excluded.is_active,
            },
        )
    )


def upgrade() -> None:
    _upsert_categories(ROOM_CATEGORIES)


def downgrade() -> None:
    _upsert_categories(BEAUTY_CATEGORIES)
