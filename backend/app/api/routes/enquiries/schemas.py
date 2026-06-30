import uuid

from pydantic import BaseModel, ConfigDict, Field


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
