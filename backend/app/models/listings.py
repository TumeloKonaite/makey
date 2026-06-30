import uuid
from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import CheckConstraint, Date, DateTime, ForeignKey, Numeric, String, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.repository.database.tables.base_model import Base


class Listing(Base):
    __tablename__ = "listings"
    __table_args__ = (
        CheckConstraint(
            "status IN ('draft', 'published', 'archived')",
            name="ck_listings_status",
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    provider_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    category_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("categories.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    title: Mapped[str] = mapped_column(String(180), nullable=False)
    slug: Mapped[str] = mapped_column(String(220), nullable=False, unique=True, index=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    price: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)
    rent_amount: Mapped[Decimal | None] = mapped_column(Numeric(10, 2), nullable=True)
    deposit_amount: Mapped[Decimal | None] = mapped_column(Numeric(10, 2), nullable=True)
    agent_fee: Mapped[Decimal | None] = mapped_column(Numeric(10, 2), nullable=True)
    available_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    is_furnished: Mapped[bool | None] = mapped_column(nullable=True)
    utilities_included: Mapped[bool | None] = mapped_column(nullable=True)
    parking_available: Mapped[bool | None] = mapped_column(nullable=True)
    max_occupants: Mapped[int | None] = mapped_column(nullable=True)
    area: Mapped[str | None] = mapped_column(String(160), nullable=True)
    currency: Mapped[str] = mapped_column(
        String(3),
        nullable=False,
        default="ZAR",
        server_default="ZAR",
    )
    location: Mapped[str | None] = mapped_column(String(255), nullable=True)
    status: Mapped[str] = mapped_column(
        String(30),
        nullable=False,
        default="draft",
        server_default="draft",
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    provider = relationship("User", back_populates="listings")
    category = relationship("Category", back_populates="listings")
    images = relationship(
        "ListingImage",
        back_populates="listing",
        cascade="all, delete-orphan",
        order_by="ListingImage.display_order",
    )
    enquiries = relationship(
        "Enquiry",
        back_populates="listing",
        cascade="all, delete-orphan",
    )
