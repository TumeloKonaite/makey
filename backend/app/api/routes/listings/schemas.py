from decimal import Decimal
import uuid

from pydantic import BaseModel, ConfigDict, Field


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
    images: list[ListingImageSummary] = Field(default_factory=list)

    model_config = ConfigDict(from_attributes=True)


class EnquiryCreate(BaseModel):
    name: str = Field(min_length=1, max_length=160)
    email: str = Field(min_length=1, max_length=255)
    phone: str | None = Field(default=None, max_length=50)
    message: str = Field(min_length=1)


class EnquiryRead(BaseModel):
    id: uuid.UUID
    listing_id: uuid.UUID
    name: str
    email: str
    phone: str | None = None
    message: str

    model_config = ConfigDict(from_attributes=True)
