from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes.categories import router as categories_router
from app.api.routes.health import router as health_router
from app.api.routes.listings import router as listings_router
from app.api.routes.webhooks import router as webhooks_router
from app.core.config import Settings, get_settings
from app.repository.storage import ensure_listing_images_bucket

_LOCAL_DEV_ORIGIN_REGEX = (
    r"^https?://"
    r"(?:(?:localhost|127\.0\.0\.1)"
    r"|(?:10(?:\.\d{1,3}){3})"
    r"|(?:172\.(?:1[6-9]|2\d|3[0-1])(?:\.\d{1,3}){2})"
    r"|(?:192\.168(?:\.\d{1,3}){2}))"
    r"(?::\d+)?$"
)


def _cors_origins(settings: Settings) -> list[str]:
    origins = {settings.frontend_origin.rstrip("/")}
    if settings.is_local:
        origins.update(
            {
                "http://127.0.0.1:3000",
                "http://127.0.0.1:5173",
                "http://localhost:3000",
                "http://localhost:5173",
            }
        )
    return sorted(origin for origin in origins if origin)


def _cors_origin_regex(settings: Settings) -> str | None:
    patterns: list[str] = []
    if settings.is_local:
        patterns.append(_LOCAL_DEV_ORIGIN_REGEX)
    if settings.frontend_preview_origin_regex:
        patterns.append(settings.frontend_preview_origin_regex.strip())
    if not patterns:
        return None
    return "|".join(f"(?:{pattern})" for pattern in patterns)


def create_app(settings: Settings | None = None) -> FastAPI:
    runtime_settings = settings or get_settings()

    @asynccontextmanager
    async def lifespan(app: FastAPI) -> AsyncIterator[None]:
        _ = app
        if runtime_settings.should_ensure_listing_images_bucket_on_startup:
            ensure_listing_images_bucket(runtime_settings)
        yield

    web_app = FastAPI(title=runtime_settings.app_name, lifespan=lifespan)
    web_app.add_middleware(
        CORSMiddleware,
        allow_origins=_cors_origins(runtime_settings),
        allow_origin_regex=_cors_origin_regex(runtime_settings),
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    web_app.include_router(health_router)
    web_app.include_router(categories_router)
    web_app.include_router(listings_router)
    web_app.include_router(webhooks_router)
    if settings is not None:
        web_app.dependency_overrides[get_settings] = lambda: runtime_settings
    return web_app


app = create_app()
