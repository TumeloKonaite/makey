from decimal import Decimal

from pydantic import BaseModel, Field


class GeocodingResult(BaseModel):
    display_name: str
    address_line: str | None = None
    area: str | None = None
    city: str | None = None
    province: str | None = None
    postal_code: str | None = None
    country_code: str | None = Field(default=None, min_length=2, max_length=2)
    latitude: Decimal = Field(ge=-90, le=90)
    longitude: Decimal = Field(ge=-180, le=180)
    provider: str
    place_id: str
