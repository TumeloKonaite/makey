import re
import uuid
from typing import Any

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.security import CurrentUser
from app.models import Category, Listing, ListingImage, User


def list_categories(db: Session) -> list[Category]:
    return list(db.scalars(select(Category).order_by(Category.name)).all())


def list_listings(db: Session) -> list[Listing]:
    return list(db.scalars(select(Listing).order_by(Listing.created_at.desc())).all())


def get_listing(db: Session, listing_id: uuid.UUID) -> Listing:
    listing = db.get(Listing, listing_id)
    if listing is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Listing was not found.",
        )
    return listing


def create_listing(
    db: Session,
    payload: Any,
    current_user: CurrentUser,
) -> Listing:
    _ensure_category_exists(db, payload.category_id)
    provider = _get_or_create_provider(db, current_user)
    listing = Listing(
        provider_id=provider.id,
        category_id=payload.category_id,
        title=payload.title,
        slug=payload.slug or _slugify(payload.title),
        description=payload.description,
        price=payload.price,
        currency=payload.currency.upper(),
        location=payload.location,
        status=payload.status,
    )
    db.add(listing)
    db.commit()
    db.refresh(listing)
    return listing


def update_listing(
    db: Session,
    listing_id: uuid.UUID,
    payload: Any,
    current_user: CurrentUser,
) -> Listing:
    _ = current_user
    listing = get_listing(db, listing_id)
    update_data = payload.model_dump(exclude_unset=True)

    if "category_id" in update_data:
        _ensure_category_exists(db, update_data["category_id"])

    for field, value in update_data.items():
        if field == "currency" and value is not None:
            value = value.upper()
        setattr(listing, field, value)

    db.commit()
    db.refresh(listing)
    return listing


def delete_listing(
    db: Session,
    listing_id: uuid.UUID,
    current_user: CurrentUser,
) -> None:
    _ = current_user
    listing = get_listing(db, listing_id)
    db.delete(listing)
    db.commit()


def add_listing_image(
    db: Session,
    listing_id: uuid.UUID,
    object_name: str,
    image_url: str,
    display_order: int,
    is_cover: bool,
    current_user: CurrentUser,
) -> ListingImage:
    ensure_listing_image_upload_allowed(db, listing_id, current_user)

    image = ListingImage(
        listing_id=listing_id,
        object_name=object_name,
        image_url=image_url,
        display_order=display_order,
        is_cover=is_cover,
    )
    db.add(image)
    db.commit()
    db.refresh(image)
    return image


def ensure_listing_image_upload_allowed(
    db: Session,
    listing_id: uuid.UUID,
    current_user: CurrentUser,
) -> None:
    listing = get_listing(db, listing_id)
    provider = _get_provider_or_forbid(db, current_user)
    if listing.provider_id != provider.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You cannot upload images to another provider's listing.",
        )


def _slugify(value: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", value.lower()).strip("-")
    return slug or f"listing-{uuid.uuid4().hex[:8]}"


def _ensure_category_exists(db: Session, category_id: uuid.UUID) -> None:
    if db.get(Category, category_id) is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Category was not found.",
        )


def _get_or_create_provider(db: Session, current_user: CurrentUser) -> User:
    provider = db.scalar(
        select(User).where(User.keycloak_user_id == current_user.id).limit(1)
    )
    if provider is not None:
        return provider

    if not current_user.email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Authenticated provider token must include an email claim.",
        )

    provider = User(
        keycloak_user_id=current_user.id,
        email=current_user.email,
        display_name=current_user.username or current_user.email,
        role="provider",
    )
    db.add(provider)
    db.flush()
    return provider


def _get_provider_or_forbid(db: Session, current_user: CurrentUser) -> User:
    provider = db.scalar(
        select(User).where(User.keycloak_user_id == current_user.id).limit(1)
    )
    if provider is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Provider profile was not found.",
        )
    return provider
