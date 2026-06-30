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


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    _ = app
    ensure_listing_images_bucket(settings)
    yield


app = FastAPI(title=settings.app_name, lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.frontend_origin],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.include_router(health_router)
app.include_router(categories_router)
app.include_router(enquiries_router)
app.include_router(listings_router)
