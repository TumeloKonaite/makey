from pydantic import BaseModel, Field


class CurrentUser(BaseModel):
    sub: str
    email: str | None = None
    username: str | None = None
    roles: list[str] = Field(default_factory=list)

    @property
    def id(self) -> str:
        return self.sub
