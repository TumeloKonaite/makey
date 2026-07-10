from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes.categories import router as categories_router
from app.api.routes.enquiries import router as enquiries_router
from app.api.routes.health import router as health_router
from app.api.routes.listings import router as listings_router
from app.core.config import get_settings
from app.repository.storage import ensure_listing_images_bucket

settings = get_settings()
_LOCAL_DEV_ORIGIN_REGEX = (
    r"^https?://"
    r"(?:(?:localhost|127\.0\.0\.1)"
    r"|(?:10(?:\.\d{1,3}){3})"
    r"|(?:172\.(?:1[6-9]|2\d|3[0-1])(?:\.\d{1,3}){2})"
    r"|(?:192\.168(?:\.\d{1,3}){2}))"
    r"(?::\d+)?$"
)


def _cors_origins() -> list[str]:
    origins = {settings.frontend_origin.rstrip("/")}
    if settings.app_env == "local":
        origins.update(
            {
                "http://127.0.0.1:3000",
                "http://127.0.0.1:5173",
                "http://localhost:3000",
                "http://localhost:5173",
            }
        )
    return sorted(origin for origin in origins if origin)


def _cors_origin_regex() -> str | None:
    if settings.app_env != "local":
        return None
    return _LOCAL_DEV_ORIGIN_REGEX


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    _ = app
    ensure_listing_images_bucket(settings)
    yield


app = FastAPI(title=settings.app_name, lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins(),
    allow_origin_regex=_cors_origin_regex(),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.include_router(health_router)
app.include_router(categories_router)
app.include_router(enquiries_router)
app.include_router(listings_router)
