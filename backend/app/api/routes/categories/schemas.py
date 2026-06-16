import uuid

from pydantic import BaseModel, ConfigDict


class CategoryRead(BaseModel):
    id: uuid.UUID
    name: str
    slug: str
    description: str | None = None

    model_config = ConfigDict(from_attributes=True)
