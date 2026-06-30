import uuid
from typing import Any

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.core.security import CurrentUser
from app.models import Enquiry, Listing, User
from app.services.listings import service as listing_service


def create_enquiry(
    db: Session,
    listing_id: uuid.UUID,
    payload: Any,
    current_user: CurrentUser | None,
) -> Enquiry:
    listing = listing_service.get_listing(db, listing_id)
    customer = _get_or_create_customer(db, current_user) if current_user else None
    enquiry = Enquiry(
        listing=listing,
        customer_id=customer.id if customer else None,
        listing_owner_id=listing.provider_id,
        customer_name=payload.name,
        customer_email=payload.email,
        customer_phone=payload.phone,
        message=payload.message,
        desired_move_in_date=payload.desired_move_in_date,
        occupant_count=payload.occupant_count,
        is_viewing_requested=payload.is_viewing_requested,
        preferred_viewing_date=payload.preferred_viewing_date,
        preferred_viewing_time=payload.preferred_viewing_time,
        viewing_notes=payload.viewing_notes,
    )
    db.add(enquiry)
    db.commit()
    db.refresh(enquiry)
    return enquiry


def list_my_enquiries(db: Session, current_user: CurrentUser) -> list[Enquiry]:
    customer = _get_user_by_keycloak_id(db, current_user)
    if customer is None:
        return []

    return list(
        db.scalars(
            select(Enquiry)
            .options(selectinload(Enquiry.listing).selectinload(Listing.category))
            .where(Enquiry.customer_id == customer.id)
            .order_by(Enquiry.created_at.desc())
        ).all()
    )


def list_my_listing_enquiries(db: Session, current_user: CurrentUser) -> list[Enquiry]:
    provider = _get_user_by_keycloak_id(db, current_user)
    if provider is None:
        return []

    return list(
        db.scalars(
            select(Enquiry)
            .options(selectinload(Enquiry.listing).selectinload(Listing.category))
            .where(Enquiry.listing_owner_id == provider.id)
            .order_by(Enquiry.created_at.desc())
        ).all()
    )


def _get_or_create_customer(db: Session, current_user: CurrentUser) -> User:
    customer = _get_user_by_keycloak_id(db, current_user)
    if customer is not None:
        return customer

    if not current_user.email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Authenticated renter token must include an email claim.",
        )

    customer = User(
        keycloak_user_id=current_user.id,
        email=current_user.email,
        display_name=current_user.username or current_user.email,
        role="customer",
    )
    db.add(customer)
    db.flush()
    return customer


def _get_user_by_keycloak_id(db: Session, current_user: CurrentUser) -> User | None:
    return db.scalar(
        select(User).where(User.keycloak_user_id == current_user.id).limit(1)
    )
