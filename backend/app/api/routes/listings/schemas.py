import hashlib
import math
import uuid
from datetime import date
from decimal import Decimal
from typing import Literal

from pydantic import (
    AliasChoices,
    AliasPath,
    BaseModel,
    ConfigDict,
    Field,
    computed_field,
    model_validator,
)


class ListingSearchParams(BaseModel):
    q: str | None = Field(default=None, min_length=1, max_length=200)
    category_id: uuid.UUID | None = None
    city: str | None = Field(default=None, min_length=1, max_length=160)
    area: str | None = Field(default=None, min_length=1, max_length=160)
    min_rent: Decimal | None = Field(default=None, ge=0)
    max_rent: Decimal | None = Field(default=None, ge=0)
    furnished: bool | None = None
    available_by: date | None = None
    agent_fee: Literal["none", "has"] | None = None
    no_deposit: bool | None = None
    utilities_included: bool | None = None
    parking_available: bool | None = None
    south: float | None = Field(default=None, ge=-90, le=90)
    west: float | None = Field(default=None, ge=-180, le=180)
    north: float | None = Field(default=None, ge=-90, le=90)
    east: float | None = Field(default=None, ge=-180, le=180)

    @model_validator(mode="after")
    def validate_ranges(self) -> "ListingSearchParams":
        bounds = (self.south, self.west, self.north, self.east)
        supplied_bounds = sum(value is not None for value in bounds)
        if supplied_bounds not in (0, 4):
            raise ValueError("south, west, north and east must be supplied together")
        if supplied_bounds == 4:
            assert self.south is not None and self.north is not None
            assert self.west is not None and self.east is not None
            if self.south >= self.north:
                raise ValueError("south must be less than north")
            if self.west >= self.east:
                raise ValueError("west must be less than east")
        if (
            self.min_rent is not None
            and self.max_rent is not None
            and self.min_rent > self.max_rent
        ):
            raise ValueError("min_rent must be less than or equal to max_rent")
        return self

    @property
    def has_bounds(self) -> bool:
        return self.south is not None


class ListingImageCreate(BaseModel):
    object_name: str
    image_url: str
    content_type: str
    size_bytes: int
    display_order: int = 0
    is_cover: bool = False


class ListingImageRead(ListingImageCreate):
    id: uuid.UUID
    listing_id: uuid.UUID
    url: str

    model_config = ConfigDict(from_attributes=True)


class ListingImageSummary(BaseModel):
    id: uuid.UUID
    url: str
    content_type: str
    size_bytes: int
    display_order: int
    is_cover: bool

    model_config = ConfigDict(from_attributes=True)


class ListingCreate(BaseModel):
    category_id: uuid.UUID
    title: str
    slug: str | None = None
    description: str | None = None
    price: Decimal
    rent_amount: Decimal | None = None
    deposit_amount: Decimal | None = None
    agent_fee: Decimal | None = None
    available_date: date | None = None
    is_furnished: bool | None = None
    utilities_included: bool | None = None
    parking_available: bool | None = None
    max_occupants: int | None = None
    area: str | None = None
    address_line: str | None = None
    city: str | None = None
    province: str | None = None
    postal_code: str | None = None
    country_code: str | None = Field(default=None, min_length=2, max_length=2)
    latitude: Decimal | None = Field(default=None, ge=-90, le=90)
    longitude: Decimal | None = Field(default=None, ge=-180, le=180)
    geocoding_provider: str | None = None
    geocoding_place_id: str | None = None
    currency: str = "ZAR"
    location: str | None = None
    status: str = "draft"


class ListingUpdate(BaseModel):
    category_id: uuid.UUID | None = None
    title: str | None = None
    slug: str | None = None
    description: str | None = None
    price: Decimal | None = None
    rent_amount: Decimal | None = None
    deposit_amount: Decimal | None = None
    agent_fee: Decimal | None = None
    available_date: date | None = None
    is_furnished: bool | None = None
    utilities_included: bool | None = None
    parking_available: bool | None = None
    max_occupants: int | None = None
    area: str | None = None
    address_line: str | None = None
    city: str | None = None
    province: str | None = None
    postal_code: str | None = None
    country_code: str | None = Field(default=None, min_length=2, max_length=2)
    latitude: Decimal | None = Field(default=None, ge=-90, le=90)
    longitude: Decimal | None = Field(default=None, ge=-180, le=180)
    geocoding_provider: str | None = None
    geocoding_place_id: str | None = None
    currency: str | None = None
    location: str | None = None
    status: str | None = None


class ListingRead(BaseModel):
    id: uuid.UUID
    provider_id: uuid.UUID
    provider_name: str | None = Field(
        default=None,
        validation_alias=AliasChoices(
            "provider_name",
            AliasPath("provider", "display_name"),
        ),
    )
    category_id: uuid.UUID
    title: str
    slug: str
    description: str | None = None
    price: Decimal
    rent_amount: Decimal | None = None
    deposit_amount: Decimal | None = None
    agent_fee: Decimal | None = None
    available_date: date | None = None
    is_furnished: bool | None = None
    utilities_included: bool | None = None
    parking_available: bool | None = None
    max_occupants: int | None = None
    area: str | None = None
    address_line: str | None = None
    city: str | None = None
    province: str | None = None
    postal_code: str | None = None
    country_code: str | None = Field(default=None, min_length=2, max_length=2)
    latitude: Decimal | None = Field(default=None, ge=-90, le=90)
    longitude: Decimal | None = Field(default=None, ge=-180, le=180)
    geocoding_provider: str | None = None
    geocoding_place_id: str | None = None
    currency: str
    location: str | None = None
    status: str
    images: list[ListingImageSummary] = Field(default_factory=list)

    model_config = ConfigDict(from_attributes=True)

    @computed_field
    @property
    def owner_id(self) -> uuid.UUID:
        return self.provider_id

    @computed_field
    @property
    def owner_name(self) -> str | None:
        return self.provider_name


PUBLIC_LOCATION_MAX_OFFSET_DEGREES = 0.003

def public_listing_read(listing: object) -> ListingRead:
    """Return a stable, approximate public point while preserving exact owner data."""
    result = ListingRead.model_validate(listing)
    if result.latitude is None or result.longitude is None:
        return result.model_copy(update={"address_line": None, "geocoding_place_id": None})
    digest = hashlib.sha256(result.id.bytes + b"roomwise-public-location-v1").digest()
    angle = int.from_bytes(digest[:4], "big") / (2**32) * math.tau
    radius = (0.35 + int.from_bytes(digest[4:8], "big") / (2**32) * 0.65) * PUBLIC_LOCATION_MAX_OFFSET_DEGREES
    latitude = float(result.latitude) + math.sin(angle) * radius
    longitude_scale = max(math.cos(math.radians(float(result.latitude))), 0.25)
    longitude = float(result.longitude) + math.cos(angle) * radius / longitude_scale
    return result.model_copy(update={"latitude": Decimal(f"{latitude:.6f}"), "longitude": Decimal(f"{longitude:.6f}"), "address_line": None, "geocoding_provider": "approximate", "geocoding_place_id": None})
