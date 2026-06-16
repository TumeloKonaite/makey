import uuid

from fastapi import APIRouter, Depends, Response, status
from sqlalchemy.orm import Session

from app.api.routes.listings.schemas import (
    CategoryRead,
    ListingCreate,
    ListingImageCreate,
    ListingImageRead,
    ListingRead,
    ListingUpdate,
)
from app.core.auth import require_role
from app.core.security import CurrentUser
from app.models import Category, Listing, ListingImage
from app.repository.database.tables.session_manager import get_db
from app.services.listings import service

router = APIRouter()


@router.get("/categories", response_model=list[CategoryRead], tags=["categories"])
def list_categories(db: Session = Depends(get_db)) -> list[Category]:
    return service.list_categories(db)


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
    current_user: CurrentUser = Depends(require_role("provider")),
) -> Listing:
    return service.create_listing(db, payload, current_user)


@router.patch("/listings/{listing_id}", response_model=ListingRead, tags=["listings"])
def update_listing(
    listing_id: uuid.UUID,
    payload: ListingUpdate,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(require_role("provider")),
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
    current_user: CurrentUser = Depends(require_role("provider")),
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
    payload: ListingImageCreate,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(require_role("provider")),
) -> ListingImage:
    return service.add_listing_image(db, listing_id, payload, current_user)
