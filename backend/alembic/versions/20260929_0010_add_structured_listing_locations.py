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
    # Azure must allow-list PostGIS. Preserve scalar coordinates if extension
    # installation is unsupported or the migration role lacks permission.
    op.execute("""
        DO $$ BEGIN
            CREATE EXTENSION IF NOT EXISTS postgis;
        EXCEPTION
            WHEN insufficient_privilege OR undefined_file THEN
                RAISE NOTICE 'PostGIS unavailable; using latitude/longitude fallback';
        END $$
    """)
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
    op.execute("""
        DO $$ BEGIN
            IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'postgis') THEN
                EXECUTE $spatial$
                    ALTER TABLE listings
                    ADD COLUMN coordinates geography(Point, 4326)
                    GENERATED ALWAYS AS (
                        CASE WHEN latitude IS NOT NULL AND longitude IS NOT NULL
                        THEN ST_SetSRID(ST_MakePoint(
                            longitude::double precision, latitude::double precision
                        ), 4326)::geography ELSE NULL END
                    ) STORED
                $spatial$;
                EXECUTE 'CREATE INDEX ix_listings_coordinates_gist '
                        'ON listings USING GIST (coordinates)';
            END IF;
        END $$
    """)


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS ix_listings_coordinates_gist")
    op.execute("""
        DO $$ BEGIN
            IF EXISTS (SELECT 1 FROM information_schema.columns WHERE
                       table_name = 'listings' AND column_name = 'coordinates') THEN
                EXECUTE 'ALTER TABLE listings DROP COLUMN coordinates';
            END IF;
        END $$
    """)
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
