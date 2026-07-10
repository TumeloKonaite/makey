from fastapi import APIRouter, Depends, status
from fastapi.responses import JSONResponse

from app.core.config import Settings, get_settings
from app.repository.database.tables.session_manager import check_database_connection
from app.repository.storage.minio_storage import check_listing_images_bucket

router = APIRouter(tags=["health"])


@router.get("/health")
def health(settings: Settings = Depends(get_settings)) -> dict[str, str]:
    _ = settings
    return {
        "status": "ok",
    }


@router.get("/ready", response_model=None)
def ready(settings: Settings = Depends(get_settings)) -> dict[str, object]:
    _ = settings
    checks: dict[str, str] = {}
    errors: dict[str, str] = {}

    try:
        check_database_connection()
        checks["database"] = "ok"
    except Exception as exc:
        checks["database"] = "error"
        errors["database"] = str(exc)

    try:
        check_listing_images_bucket(settings)
        checks["object_storage"] = "ok"
    except Exception as exc:
        checks["object_storage"] = "error"
        errors["object_storage"] = str(exc)

    body: dict[str, object] = {
        "status": "ok" if not errors else "error",
        "checks": checks,
    }
    if errors:
        body["errors"] = errors
        return JSONResponse(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, content=body)

    return body

