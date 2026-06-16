from decimal import Decimal
import uuid

from pydantic import BaseModel, ConfigDict


class ListingImageCreate(BaseModel):
    object_name: str
    image_url: str
    display_order: int = 0
    is_cover: bool = False


class ListingImageRead(ListingImageCreate):
    id: uuid.UUID
    listing_id: uuid.UUID

    model_config = ConfigDict(from_attributes=True)


class ListingCreate(BaseModel):
    category_id: uuid.UUID
    title: str
    slug: str | None = None
    description: str | None = None
    price: Decimal
    currency: str = "ZAR"
    location: str | None = None
    status: str = "draft"


class ListingUpdate(BaseModel):
    category_id: uuid.UUID | None = None
    title: str | None = None
    slug: str | None = None
    description: str | None = None
    price: Decimal | None = None
    currency: str | None = None
    location: str | None = None
    status: str | None = None


class ListingRead(BaseModel):
    id: uuid.UUID
    provider_id: uuid.UUID
    category_id: uuid.UUID
    title: str
    slug: str
    description: str | None = None
    price: Decimal
    currency: str
    location: str | None = None
    status: str

    model_config = ConfigDict(from_attributes=True)
