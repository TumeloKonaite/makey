from typing import Literal

from pydantic import BaseModel


class CurrentUser(BaseModel):
    sub: str
    email: str | None = None
    username: str | None = None
    role: Literal["admin", "renter"] = "renter"

    @property
    def id(self) -> str:
        return self.sub
