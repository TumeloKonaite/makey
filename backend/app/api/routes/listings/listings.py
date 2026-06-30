import uuid

from fastapi import (
    APIRouter,
    Depends,
    File,
    Form,
    HTTPException,
    Response,
    UploadFile,
    status,
)
from sqlalchemy.orm import Session

from app.api.routes.listings.schemas import (
    ListingCreate,
    ListingImageRead,
    ListingRead,
    ListingUpdate,
)
from app.core.auth import require_role
from app.core.security import CurrentUser
from app.models import Listing, ListingImage
from app.repository.database.tables.session_manager import get_db
from app.repository.storage import InvalidImageFile, MinioImageStorage
from app.services.listings import service

router = APIRouter()


@router.get("/listings", response_model=list[ListingRead], tags=["listings"])
def list_listings(db: Session = Depends(get_db)) -> list[Listing]:
    return service.list_listings(db)


@router.get("/listings/{listing_id}", response_model=ListingRead, tags=["listings"])
def get_listing(listing_id: uuid.UUID, db: Session = Depends(get_db)) -> Listing:
    return service.get_listing(db, listing_id)


@router.post(
    "/listings",
    response_model=ListingRead,
    status_code=status.HTTP_201_CREATED,
    tags=["listings"],
)
def create_listing(
    payload: ListingCreate,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(require_role("owner")),
) -> Listing:
    return service.create_listing(db, payload, current_user)


@router.patch("/listings/{listing_id}", response_model=ListingRead, tags=["listings"])
def update_listing(
    listing_id: uuid.UUID,
    payload: ListingUpdate,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(require_role("owner")),
) -> Listing:
    return service.update_listing(db, listing_id, payload, current_user)


@router.delete(
    "/listings/{listing_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    tags=["listings"],
)
def delete_listing(
    listing_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(require_role("owner")),
) -> Response:
    service.delete_listing(db, listing_id, current_user)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post(
    "/listings/{listing_id}/images",
    response_model=ListingImageRead,
    status_code=status.HTTP_201_CREATED,
    tags=["listings"],
)
def add_listing_image(
    listing_id: uuid.UUID,
    file: UploadFile = File(...),
    display_order: int = Form(0),
    is_cover: bool = Form(False),
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(require_role("owner")),
) -> ListingImage:
    service.ensure_listing_image_upload_allowed(db, listing_id, current_user)

    storage = MinioImageStorage()
    try:
        stored_image = storage.upload_listing_image(listing_id, file)
    except InvalidImageFile as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        ) from exc

    return service.add_listing_image(
        db,
        listing_id,
        object_name=stored_image.object_name,
        image_url=stored_image.public_url,
        content_type=stored_image.content_type,
        size_bytes=stored_image.size_bytes,
        display_order=display_order,
        is_cover=is_cover,
        current_user=current_user,
    )
