import re
import uuid
from typing import Any

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.core.security import CurrentUser
from app.models import Category, Listing, ListingImage, User

PUBLISHED_LISTING_STATUS = "published"


def list_categories(db: Session) -> list[Category]:
    return list(
        db.scalars(
            select(Category).where(Category.is_active.is_(True)).order_by(Category.name)
        ).all()
    )


def get_category(db: Session, category_id: uuid.UUID) -> Category:
    category = db.get(Category, category_id)
    if category is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Category not found",
        )
    return category


def list_listings(db: Session) -> list[Listing]:
    return list(
        db.scalars(
            select(Listing)
            .options(selectinload(Listing.images), selectinload(Listing.provider))
            .where(Listing.status == PUBLISHED_LISTING_STATUS)
            .order_by(Listing.created_at.desc())
        ).all()
    )


def list_my_listings(db: Session, current_user: CurrentUser) -> list[Listing]:
    admin_profile = _get_user_by_clerk_id(db, current_user)
    if admin_profile is None:
        return []

    return list(
        db.scalars(
            select(Listing)
            .options(selectinload(Listing.images), selectinload(Listing.provider))
            .where(Listing.provider_id == admin_profile.id)
            .order_by(Listing.created_at.desc())
        ).all()
    )


def get_listing(db: Session, listing_id: uuid.UUID) -> Listing:
    return _get_listing_or_404(db, listing_id, published_only=True)


def get_my_listing(
    db: Session,
    listing_id: uuid.UUID,
    current_user: CurrentUser,
) -> Listing:
    return ensure_listing_owner_access(
        db,
        listing_id,
        current_user,
        forbidden_detail="You cannot view another admin's listing.",
    )


def create_listing(
    db: Session,
    payload: Any,
    current_user: CurrentUser,
) -> Listing:
    _ensure_category_exists(db, payload.category_id)
    admin_profile = _get_or_create_admin_profile(db, current_user)
    listing = Listing(
        provider_id=admin_profile.id,
        category_id=payload.category_id,
        title=payload.title,
        slug=payload.slug or _slugify(payload.title),
        description=payload.description,
        price=payload.price,
        rent_amount=payload.rent_amount,
        deposit_amount=payload.deposit_amount,
        agent_fee=payload.agent_fee,
        available_date=payload.available_date,
        is_furnished=payload.is_furnished,
        utilities_included=payload.utilities_included,
        parking_available=payload.parking_available,
        max_occupants=payload.max_occupants,
        area=payload.area,
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
    listing = ensure_listing_owner_access(
        db,
        listing_id,
        current_user,
        forbidden_detail="You cannot update another admin's listing.",
    )
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
    listing = ensure_listing_owner_access(
        db,
        listing_id,
        current_user,
        forbidden_detail="You cannot delete another admin's listing.",
    )
    db.delete(listing)
    db.commit()


def add_listing_image(
    db: Session,
    listing_id: uuid.UUID,
    object_name: str,
    image_url: str,
    content_type: str,
    size_bytes: int,
    display_order: int,
    is_cover: bool,
    current_user: CurrentUser,
) -> ListingImage:
    ensure_listing_image_upload_allowed(db, listing_id, current_user)

    image = ListingImage(
        listing_id=listing_id,
        object_name=object_name,
        image_url=image_url,
        content_type=content_type,
        size_bytes=size_bytes,
        display_order=display_order,
        is_cover=is_cover,
    )
    db.add(image)
    db.commit()
    db.refresh(image)
    return image


def remove_listing_image(
    db: Session,
    listing_id: uuid.UUID,
    image_id: uuid.UUID,
    current_user: CurrentUser,
) -> ListingImage:
    ensure_listing_owner_access(
        db,
        listing_id,
        current_user,
        forbidden_detail="You cannot remove images from another admin's listing.",
    )
    image = db.scalar(
        select(ListingImage).where(
            ListingImage.id == image_id,
            ListingImage.listing_id == listing_id,
        )
    )
    if image is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Listing image was not found.",
        )
    return image


def delete_listing_image_record(db: Session, image: ListingImage) -> None:
    db.delete(image)
    db.commit()


def ensure_listing_image_upload_allowed(
    db: Session,
    listing_id: uuid.UUID,
    current_user: CurrentUser,
) -> None:
    ensure_listing_owner_access(
        db,
        listing_id,
        current_user,
        forbidden_detail="You cannot upload images to another admin's listing.",
    )


def ensure_listing_owner_access(
    db: Session,
    listing_id: uuid.UUID,
    current_user: CurrentUser,
    forbidden_detail: str,
) -> Listing:
    listing = _get_listing_or_404(db, listing_id)
    admin_profile = _get_admin_profile_or_forbid(db, current_user)
    if listing.provider_id != admin_profile.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=forbidden_detail,
        )
    return listing


def _slugify(value: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", value.lower()).strip("-")
    return slug or f"listing-{uuid.uuid4().hex[:8]}"


def _ensure_category_exists(db: Session, category_id: uuid.UUID) -> None:
    if db.get(Category, category_id) is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Category was not found.",
        )


def _get_listing_or_404(
    db: Session,
    listing_id: uuid.UUID,
    published_only: bool = False,
) -> Listing:
    query = (
        select(Listing)
        .options(selectinload(Listing.images), selectinload(Listing.provider))
        .where(Listing.id == listing_id)
    )
    if published_only:
        query = query.where(Listing.status == PUBLISHED_LISTING_STATUS)

    listing = db.scalar(query.limit(1))
    if listing is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Listing was not found.",
        )
    return listing


def _get_or_create_admin_profile(db: Session, current_user: CurrentUser) -> User:
    admin_profile = db.scalar(
        select(User).where(User.clerk_user_id == current_user.id).limit(1)
    )
    if admin_profile is not None:
        return admin_profile

    if not current_user.email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="The admin profile has not been synchronized from Clerk yet.",
        )

    admin_profile = User(
        clerk_user_id=current_user.id,
        email=current_user.email,
        display_name=current_user.username or current_user.email,
        role="admin",
    )
    db.add(admin_profile)
    db.flush()
    return admin_profile


def _get_user_by_clerk_id(db: Session, current_user: CurrentUser) -> User | None:
    return db.scalar(
        select(User).where(User.clerk_user_id == current_user.id).limit(1)
    )


def _get_admin_profile_or_forbid(db: Session, current_user: CurrentUser) -> User:
    admin_profile = _get_user_by_clerk_id(db, current_user)
    if admin_profile is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin profile was not found.",
        )
    return admin_profile
