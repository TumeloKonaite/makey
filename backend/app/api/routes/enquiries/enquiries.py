import uuid

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.api.routes.enquiries.schemas import EnquiryCreate, EnquiryRead
from app.core.auth import get_current_user, get_optional_current_user
from app.core.security import CurrentUser
from app.models import Enquiry
from app.repository.database.tables.session_manager import get_db
from app.services.enquiries import service

router = APIRouter()


@router.post(
    "/listings/{listing_id}/enquiries",
    response_model=EnquiryRead,
    status_code=status.HTTP_201_CREATED,
    tags=["enquiries"],
    summary="Submit a room enquiry or viewing request",
)
def create_enquiry(
    listing_id: uuid.UUID,
    payload: EnquiryCreate,
    db: Session = Depends(get_db),
    current_user: CurrentUser | None = Depends(get_optional_current_user),
) -> EnquiryRead:
    enquiry = service.create_enquiry(db, listing_id, payload, current_user)
    return _enquiry_response(enquiry)


@router.get(
    "/me/enquiries",
    response_model=list[EnquiryRead],
    tags=["enquiries"],
    summary="List my room enquiries",
)
def list_my_enquiries(
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
) -> list[EnquiryRead]:
    return [
        _enquiry_response(enquiry)
        for enquiry in service.list_my_enquiries(db, current_user)
    ]


@router.get(
    "/me/listing-enquiries",
    response_model=list[EnquiryRead],
    tags=["enquiries"],
    include_in_schema=False,
)
@router.get(
    "/me/owner-enquiries",
    response_model=list[EnquiryRead],
    tags=["enquiries"],
    summary="List room enquiries for my listings",
)
def list_my_owner_enquiries(
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
) -> list[EnquiryRead]:
    return [
        _enquiry_response(enquiry)
        for enquiry in service.list_my_listing_enquiries(db, current_user)
    ]


def _enquiry_response(enquiry: Enquiry) -> EnquiryRead:
    listing = enquiry.listing
    return EnquiryRead(
        id=enquiry.id,
        listing_id=enquiry.listing_id,
        name=enquiry.customer_name,
        email=enquiry.customer_email,
        phone=enquiry.customer_phone,
        message=enquiry.message,
        desired_move_in_date=enquiry.desired_move_in_date,
        occupant_count=enquiry.occupant_count,
        is_viewing_requested=enquiry.is_viewing_requested,
        preferred_viewing_date=enquiry.preferred_viewing_date,
        preferred_viewing_time=enquiry.preferred_viewing_time,
        viewing_notes=enquiry.viewing_notes,
        listing=(
            {
                "id": listing.id,
                "title": listing.title,
                "status": listing.status,
                "category_id": listing.category_id,
                "category_name": listing.category.name if listing.category else None,
            }
            if listing is not None
            else None
        ),
        created_at=enquiry.created_at,
    )
