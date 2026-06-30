from datetime import date
from decimal import Decimal
import uuid

from pydantic import AliasChoices, AliasPath, BaseModel, ConfigDict, Field, computed_field


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
