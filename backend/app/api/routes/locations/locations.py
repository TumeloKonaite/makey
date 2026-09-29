from functools import lru_cache
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.core.config import Settings, get_settings
from app.services.geocoding.service import (
    GeocodingError,
    GeocodingNotConfiguredError,
    GeocodingService,
    GeocodingTimeoutError,
    HttpJsonGeocodingProvider,
)

from .schemas import GeocodingResult

router = APIRouter()


@lru_cache
def _service_for_config(
    base_url: str | None, timeout: float, api_key: str | None, ttl: int, max_entries: int
) -> GeocodingService:
    return GeocodingService(
        HttpJsonGeocodingProvider(base_url, timeout, api_key),
        ttl_seconds=ttl,
        max_entries=max_entries,
    )


def get_geocoding_service(settings: Settings = Depends(get_settings)) -> GeocodingService:
    return _service_for_config(
        settings.geocoding_base_url,
        settings.geocoding_timeout_seconds,
        settings.geocoding_api_key,
        settings.geocoding_cache_ttl_seconds,
        settings.geocoding_cache_max_entries,
    )


@router.get("/locations/search", response_model=list[GeocodingResult], tags=["locations"])
def search_locations(
    q: Annotated[str, Query(min_length=3, max_length=200, pattern=r".*\S.*")],
    geocoding: GeocodingService = Depends(get_geocoding_service),
) -> list[GeocodingResult]:
    try:
        return geocoding.search(q, limit=5)
    except GeocodingNotConfiguredError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc)
        ) from exc
    except GeocodingTimeoutError as exc:
        raise HTTPException(status_code=status.HTTP_504_GATEWAY_TIMEOUT, detail=str(exc)) from exc
    except GeocodingError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Location search is temporarily unavailable.",
        ) from exc
