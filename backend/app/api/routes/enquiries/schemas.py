from datetime import date, datetime, time
import uuid

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator


class EnquiryCreate(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    name: str = Field(min_length=1, max_length=160)
    email: str | None = Field(default=None, max_length=255)
    phone: str | None = Field(default=None, max_length=50)
    message: str = Field(min_length=1)
    desired_move_in_date: date | None = None
    occupant_count: int | None = Field(default=None, gt=0)
    is_viewing_requested: bool = False
    preferred_viewing_date: date | None = None
    preferred_viewing_time: time | None = None
    viewing_notes: str | None = None

    @field_validator("email", "phone", "viewing_notes", mode="before")
    @classmethod
    def blank_strings_to_none(cls, value: str | None) -> str | None:
        if value is None:
            return None
        cleaned = value.strip()
        return cleaned or None

    @model_validator(mode="after")
    def validate_contact_details(self) -> "EnquiryCreate":
        if not self.email and not self.phone:
            raise ValueError("Either email or phone is required.")
        return self


class EnquiryListingRead(BaseModel):
    id: uuid.UUID
    title: str
    status: str
    category_id: uuid.UUID | None = None
    category_name: str | None = None

    model_config = ConfigDict(from_attributes=True)


class EnquiryRead(BaseModel):
    id: uuid.UUID
    listing_id: uuid.UUID
    name: str
    email: str | None = None
    phone: str | None = None
    message: str
    desired_move_in_date: date | None = None
    occupant_count: int | None = None
    is_viewing_requested: bool
    preferred_viewing_date: date | None = None
    preferred_viewing_time: time | None = None
    viewing_notes: str | None = None
    listing: EnquiryListingRead | None = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
