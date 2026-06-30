import uuid
from collections.abc import Generator
from datetime import date
from decimal import Decimal

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.core.auth import get_current_user
from app.core.security import CurrentUser
from app.main import app
from app.models import Category, Listing, User
from app.repository.database.tables.base_model import Base
from app.repository.database.tables.session_manager import get_db

category_id = uuid.UUID("3c67a6cc-29c5-4d46-b6f9-262056d9cb70")
provider_id = uuid.UUID("aaaaaaaa-1111-4111-8111-111111111111")
other_provider_id = uuid.UUID("bbbbbbbb-2222-4222-8222-222222222222")
published_listing_id = uuid.UUID("cccccccc-3333-4333-8333-333333333333")
draft_listing_id = uuid.UUID("dddddddd-4444-4444-8444-444444444444")


@pytest.fixture()
def client() -> Generator[TestClient, None, None]:
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    testing_session_local = sessionmaker(
        autocommit=False,
        autoflush=False,
        bind=engine,
    )
    Base.metadata.create_all(engine)

    with testing_session_local() as db:
        seed_data(db)

    def override_get_db() -> Generator[Session, None, None]:
        db = testing_session_local()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = override_get_db
    try:
        yield TestClient(app)
    finally:
        app.dependency_overrides.clear()


def seed_data(db: Session) -> None:
    provider = User(
        id=provider_id,
        keycloak_user_id="provider-1",
        email="provider@example.com",
        display_name="Provider One",
        role="provider",
    )
    other_provider = User(
        id=other_provider_id,
        keycloak_user_id="provider-2",
        email="other-provider@example.com",
        display_name="Provider Two",
        role="provider",
    )
    category = Category(
        id=category_id,
        name="Single room",
        slug="single-room",
        description="Private single-occupancy room",
    )
    published_listing = Listing(
        id=published_listing_id,
        provider_id=provider_id,
        category_id=category_id,
        title="Sunny single room in Observatory",
        slug="sunny-single-room-in-observatory",
        description="Furnished room with Wi-Fi and utilities included",
        price=Decimal("250.00"),
        rent_amount=Decimal("6500.00"),
        deposit_amount=Decimal("6500.00"),
        agent_fee=Decimal("1200.00"),
        available_date=date(2026, 7, 15),
        is_furnished=True,
        utilities_included=True,
        parking_available=False,
        max_occupants=1,
        area="Observatory",
        currency="ZAR",
        location="Cape Town",
        status="published",
    )
    draft_listing = Listing(
        id=draft_listing_id,
        provider_id=provider_id,
        category_id=category_id,
        title="Draft single room in Observatory",
        slug="draft-single-room-in-observatory",
        description="Hidden draft room listing",
        price=Decimal("275.00"),
        currency="ZAR",
        location="Cape Town",
        status="draft",
    )
    db.add_all([provider, other_provider, category, published_listing, draft_listing])
    db.commit()


def override_user(user_id: str, roles: list[str]) -> None:
    app.dependency_overrides[get_current_user] = lambda: CurrentUser(
        sub=user_id,
        email=f"{user_id}@example.com",
        username=user_id,
        roles=roles,
    )


def test_public_listing_list_excludes_drafts(client: TestClient) -> None:
    response = client.get("/listings")

    assert response.status_code == 200
    body = response.json()
    assert [listing["id"] for listing in body] == [str(published_listing_id)]
    assert body[0]["rent_amount"] == "6500.00"
    assert body[0]["deposit_amount"] == "6500.00"
    assert body[0]["agent_fee"] == "1200.00"
    assert body[0]["available_date"] == "2026-07-15"
    assert body[0]["is_furnished"] is True
    assert body[0]["utilities_included"] is True
    assert body[0]["parking_available"] is False
    assert body[0]["max_occupants"] == 1
    assert body[0]["area"] == "Observatory"


def test_public_listing_detail_returns_published_listing(client: TestClient) -> None:
    response = client.get(f"/listings/{published_listing_id}")

    assert response.status_code == 200
    body = response.json()
    assert body["id"] == str(published_listing_id)
    assert body["rent_amount"] == "6500.00"
    assert body["deposit_amount"] == "6500.00"
    assert body["agent_fee"] == "1200.00"
    assert body["available_date"] == "2026-07-15"
    assert body["is_furnished"] is True
    assert body["utilities_included"] is True
    assert body["parking_available"] is False
    assert body["max_occupants"] == 1
    assert body["area"] == "Observatory"


def test_public_listing_detail_returns_404_for_draft_listing(client: TestClient) -> None:
    response = client.get(f"/listings/{draft_listing_id}")

    assert response.status_code == 404
    assert response.json() == {"detail": "Listing was not found."}


def test_listing_owner_can_update_their_listing(client: TestClient) -> None:
    override_user("provider-1", ["provider"])

    response = client.patch(
        f"/listings/{draft_listing_id}",
        json={
            "title": "Updated Draft",
            "status": "published",
            "rent_amount": "7200.00",
            "deposit_amount": "7200.00",
            "agent_fee": "1500.00",
            "available_date": "2026-08-01",
            "is_furnished": True,
            "utilities_included": False,
            "parking_available": True,
            "max_occupants": 2,
            "area": "Salt River",
        },
    )

    assert response.status_code == 200
    body = response.json()
    assert body["id"] == str(draft_listing_id)
    assert body["title"] == "Updated Draft"
    assert body["status"] == "published"
    assert body["rent_amount"] == "7200.00"
    assert body["deposit_amount"] == "7200.00"
    assert body["agent_fee"] == "1500.00"
    assert body["available_date"] == "2026-08-01"
    assert body["is_furnished"] is True
    assert body["utilities_included"] is False
    assert body["parking_available"] is True
    assert body["max_occupants"] == 2
    assert body["area"] == "Salt River"

    detail_response = client.get(f"/listings/{draft_listing_id}")
    assert detail_response.status_code == 200
    assert detail_response.json()["rent_amount"] == "7200.00"


def test_provider_can_create_listing_with_rental_fields(client: TestClient) -> None:
    override_user("provider-1", ["provider"])

    response = client.post(
        "/listings",
        json={
            "category_id": str(category_id),
            "title": "Room near UCT",
            "description": "Large room in a secure house share.",
            "price": "0.00",
            "rent_amount": "5800.00",
            "deposit_amount": "5800.00",
            "agent_fee": "900.00",
            "available_date": "2026-07-20",
            "is_furnished": False,
            "utilities_included": True,
            "parking_available": True,
            "max_occupants": 1,
            "area": "Rondebosch",
            "currency": "zar",
            "location": "Cape Town",
            "status": "published",
        },
    )

    assert response.status_code == 201
    body = response.json()
    assert body["provider_id"] == str(provider_id)
    assert body["title"] == "Room near UCT"
    assert body["slug"] == "room-near-uct"
    assert body["rent_amount"] == "5800.00"
    assert body["deposit_amount"] == "5800.00"
    assert body["agent_fee"] == "900.00"
    assert body["available_date"] == "2026-07-20"
    assert body["is_furnished"] is False
    assert body["utilities_included"] is True
    assert body["parking_available"] is True
    assert body["max_occupants"] == 1
    assert body["area"] == "Rondebosch"
    assert body["currency"] == "ZAR"


def test_non_owner_cannot_update_another_listing(client: TestClient) -> None:
    override_user("provider-2", ["provider"])

    response = client.patch(
        f"/listings/{published_listing_id}",
        json={"title": "Hijacked"},
    )

    assert response.status_code == 403

    detail_response = client.get(f"/listings/{published_listing_id}")
    assert detail_response.status_code == 200
    assert detail_response.json()["title"] == "Sunny single room in Observatory"


def test_listing_owner_can_delete_their_listing(client: TestClient) -> None:
    override_user("provider-1", ["provider"])

    response = client.delete(f"/listings/{published_listing_id}")

    assert response.status_code == 204

    detail_response = client.get(f"/listings/{published_listing_id}")
    assert detail_response.status_code == 404


def test_non_owner_cannot_delete_another_listing(client: TestClient) -> None:
    override_user("provider-2", ["provider"])

    response = client.delete(f"/listings/{published_listing_id}")

    assert response.status_code == 403

    detail_response = client.get(f"/listings/{published_listing_id}")
    assert detail_response.status_code == 200
