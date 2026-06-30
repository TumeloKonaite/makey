import uuid
from collections.abc import Generator
from decimal import Decimal

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.core.auth import get_current_user, get_optional_current_user
from app.core.security import CurrentUser
from app.main import app
from app.models import Category, Enquiry, Listing, User
from app.repository.database.tables.base_model import Base
from app.repository.database.tables.session_manager import get_db

category_id = uuid.UUID("3c67a6cc-29c5-4d46-b6f9-262056d9cb70")
provider_id = uuid.UUID("aaaaaaaa-1111-4111-8111-111111111111")
other_provider_id = uuid.UUID("bbbbbbbb-2222-4222-8222-222222222222")
customer_id = uuid.UUID("dddddddd-4444-4444-8444-444444444444")
listing_id = uuid.UUID("cccccccc-3333-4333-8333-333333333333")
other_listing_id = uuid.UUID("eeeeeeee-5555-4555-8555-555555555555")
draft_listing_id = uuid.UUID("ffffffff-6666-4666-8666-666666666666")


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
    customer = User(
        id=customer_id,
        keycloak_user_id="customer-1",
        email="customer@example.com",
        display_name="Customer One",
        role="customer",
    )
    category = Category(
        id=category_id,
        name="Single room",
        slug="single-room",
        description="Private single-occupancy room",
    )
    listing = Listing(
        id=listing_id,
        provider_id=provider_id,
        category_id=category_id,
        title="Sunny single room in Observatory",
        slug="sunny-single-room-in-observatory",
        description="Furnished room with Wi-Fi and utilities included",
        price=Decimal("250.00"),
        currency="ZAR",
        location="Cape Town",
        status="published",
    )
    other_listing = Listing(
        id=other_listing_id,
        provider_id=other_provider_id,
        category_id=category_id,
        title="Shared room near campus",
        slug="shared-room-near-campus",
        description="Affordable shared room close to transport links",
        price=Decimal("180.00"),
        currency="ZAR",
        location="Johannesburg",
        status="published",
    )
    draft_listing = Listing(
        id=draft_listing_id,
        provider_id=provider_id,
        category_id=category_id,
        title="Draft single room in Observatory",
        slug="draft-single-room-in-observatory",
        description="Not public yet",
        price=Decimal("260.00"),
        currency="ZAR",
        location="Cape Town",
        status="draft",
    )
    db.add_all(
        [
            provider,
            other_provider,
            customer,
            category,
            listing,
            other_listing,
            draft_listing,
        ]
    )
    db.commit()


def override_user(user_id: str, roles: list[str]) -> None:
    user = CurrentUser(
        sub=user_id,
        email=f"{user_id}@example.com",
        username=user_id,
        roles=roles,
    )
    app.dependency_overrides[get_current_user] = lambda: user
    app.dependency_overrides[get_optional_current_user] = lambda: user


def enquiry_payload() -> dict[str, str]:
    return {
        "name": "Jane Doe",
        "email": "jane@example.com",
        "phone": "+27710000000",
        "message": "Hi, is this room still available this weekend?",
    }


def test_customer_can_submit_enquiry_for_listing(client: TestClient) -> None:
    override_user("customer-1", ["customer"])

    response = client.post(f"/listings/{listing_id}/enquiries", json=enquiry_payload())

    assert response.status_code == 201
    body = response.json()
    assert body["listing_id"] == str(listing_id)
    assert body["name"] == "Jane Doe"
    assert body["email"] == "jane@example.com"
    assert body["phone"] == "+27710000000"
    assert body["message"] == "Hi, is this room still available this weekend?"
    assert "id" in body


def test_anonymous_user_can_submit_enquiry(client: TestClient) -> None:
    response = client.post(f"/listings/{listing_id}/enquiries", json=enquiry_payload())

    assert response.status_code == 201
    assert response.json()["email"] == "jane@example.com"


def test_submit_enquiry_returns_404_for_invalid_listing(client: TestClient) -> None:
    missing_id = uuid.UUID("99999999-9999-4999-8999-999999999999")

    response = client.post(f"/listings/{missing_id}/enquiries", json=enquiry_payload())

    assert response.status_code == 404


def test_submit_enquiry_returns_404_for_draft_listing(client: TestClient) -> None:
    response = client.post(
        f"/listings/{draft_listing_id}/enquiries",
        json=enquiry_payload(),
    )

    assert response.status_code == 404


def test_customer_can_view_own_enquiries(client: TestClient) -> None:
    override_user("customer-1", ["customer"])
    client.post(f"/listings/{listing_id}/enquiries", json=enquiry_payload())

    response = client.get("/me/enquiries")

    assert response.status_code == 200
    assert [enquiry["email"] for enquiry in response.json()] == ["jane@example.com"]


def test_listing_owner_can_view_enquiries_for_own_listings(client: TestClient) -> None:
    override_user("customer-1", ["customer"])
    client.post(f"/listings/{listing_id}/enquiries", json=enquiry_payload())
    client.post(f"/listings/{other_listing_id}/enquiries", json=enquiry_payload())

    override_user("provider-1", ["provider"])
    response = client.get("/me/listing-enquiries")

    assert response.status_code == 200
    enquiries = response.json()
    assert len(enquiries) == 1
    assert enquiries[0]["listing_id"] == str(listing_id)


def test_non_owner_does_not_see_other_listing_enquiries(client: TestClient) -> None:
    override_user("customer-1", ["customer"])
    client.post(f"/listings/{listing_id}/enquiries", json=enquiry_payload())

    override_user("provider-2", ["provider"])
    response = client.get("/me/listing-enquiries")

    assert response.status_code == 200
    assert response.json() == []


def test_me_enquiries_requires_authentication(client: TestClient) -> None:
    response = client.get("/me/enquiries")

    assert response.status_code == 401


def test_me_listing_enquiries_requires_authentication(client: TestClient) -> None:
    response = client.get("/me/listing-enquiries")

    assert response.status_code == 401


def test_enquiry_is_stored_with_customer_and_owner_ids(client: TestClient) -> None:
    override_user("customer-1", ["customer"])
    response = client.post(f"/listings/{listing_id}/enquiries", json=enquiry_payload())

    assert response.status_code == 201

    override = app.dependency_overrides[get_db]
    db_generator = override()
    db = next(db_generator)
    try:
        enquiry = db.query(Enquiry).one()
        assert enquiry.customer_id == customer_id
        assert enquiry.listing_owner_id == provider_id
    finally:
        db.close()
        db_generator.close()
