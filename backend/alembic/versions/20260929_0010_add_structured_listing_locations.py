"""add structured listing locations and PostGIS coordinates

Revision ID: 20260929_0010
Revises: 20260827_0009
Create Date: 2026-09-29 00:00:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "20260929_0010"
down_revision: str | None = "20260827_0009"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute("CREATE EXTENSION IF NOT EXISTS postgis")
    op.add_column("listings", sa.Column("address_line", sa.String(length=255), nullable=True))
    op.add_column("listings", sa.Column("city", sa.String(length=160), nullable=True))
    op.add_column("listings", sa.Column("province", sa.String(length=160), nullable=True))
    op.add_column("listings", sa.Column("postal_code", sa.String(length=20), nullable=True))
    op.add_column("listings", sa.Column("country_code", sa.String(length=2), nullable=True))
    op.add_column("listings", sa.Column("latitude", sa.Numeric(9, 6), nullable=True))
    op.add_column("listings", sa.Column("longitude", sa.Numeric(10, 6), nullable=True))
    op.add_column("listings", sa.Column("geocoding_provider", sa.String(length=80), nullable=True))
    op.add_column("listings", sa.Column("geocoding_place_id", sa.String(length=255), nullable=True))
    op.create_check_constraint(
        "ck_listings_latitude_range",
        "listings",
        "latitude IS NULL OR latitude BETWEEN -90 AND 90",
    )
    op.create_check_constraint(
        "ck_listings_longitude_range",
        "listings",
        "longitude IS NULL OR longitude BETWEEN -180 AND 180",
    )
    op.execute(
        """
        ALTER TABLE listings
        ADD COLUMN coordinates geography(Point, 4326)
        GENERATED ALWAYS AS (
            CASE
                WHEN latitude IS NOT NULL AND longitude IS NOT NULL
                THEN ST_SetSRID(
                    ST_MakePoint(longitude::double precision, latitude::double precision),
                    4326
                )::geography
                ELSE NULL
            END
        ) STORED
        """
    )
    op.execute(
        "CREATE INDEX ix_listings_coordinates_gist "
        "ON listings USING GIST (coordinates)"
    )


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS ix_listings_coordinates_gist")
    op.execute("ALTER TABLE listings DROP COLUMN coordinates")
    op.drop_constraint("ck_listings_longitude_range", "listings", type_="check")
    op.drop_constraint("ck_listings_latitude_range", "listings", type_="check")
    op.drop_column("listings", "geocoding_place_id")
    op.drop_column("listings", "geocoding_provider")
    op.drop_column("listings", "longitude")
    op.drop_column("listings", "latitude")
    op.drop_column("listings", "country_code")
    op.drop_column("listings", "postal_code")
    op.drop_column("listings", "province")
    op.drop_column("listings", "city")
    op.drop_column("listings", "address_line")
