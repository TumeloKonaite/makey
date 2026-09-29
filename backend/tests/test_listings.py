import uuid
from collections.abc import Generator
from datetime import date
from decimal import Decimal

import pytest
from app.core.auth import get_current_user
from app.core.security import CurrentUser
from app.main import app
from app.models import Category, Listing, User
from app.repository.database.tables.base_model import Base
from app.repository.database.tables.session_manager import get_db
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

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
        clerk_user_id="admin-1",
        email="owner@example.com",
        display_name="Owner One",
        role="admin",
    )
    other_provider = User(
        id=other_provider_id,
        clerk_user_id="admin-2",
        email="other-owner@example.com",
        display_name="Owner Two",
        role="admin",
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


def override_user(user_id: str, role: str) -> None:
    app.dependency_overrides[get_current_user] = lambda: CurrentUser(
        sub=user_id,
        email=f"{user_id}@example.com",
        username=user_id,
        role=role,
    )


def test_public_listing_list_excludes_drafts(client: TestClient) -> None:
    response = client.get("/listings")

    assert response.status_code == 200
    body = response.json()
    assert [listing["id"] for listing in body] == [str(published_listing_id)]
    assert body[0]["owner_id"] == str(provider_id)
    assert body[0]["owner_name"] == "Owner One"
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
    assert body["owner_id"] == str(provider_id)
    assert body["owner_name"] == "Owner One"
    assert body["rent_amount"] == "6500.00"
    assert body["deposit_amount"] == "6500.00"
    assert body["agent_fee"] == "1200.00"
    assert body["available_date"] == "2026-07-15"
    assert body["is_furnished"] is True
    assert body["utilities_included"] is True
    assert body["parking_available"] is False
    assert body["max_occupants"] == 1
    assert body["area"] == "Observatory"


def test_public_locations_are_stable_approximations_but_owner_keeps_exact(
    client: TestClient,
) -> None:
    override_user("admin-1", "admin")
    created = client.post(
        "/listings",
        json={
            "category_id": str(category_id),
            "title": "Private point",
            "price": "1000",
            "rent_amount": "1000",
            "address_line": "12 Exact Street",
            "city": "Cape Town",
            "latitude": "-33.940000",
            "longitude": "18.470000",
            "geocoding_provider": "test-provider",
            "geocoding_place_id": "exact-place-id",
            "status": "published",
        },
    ).json()
    listing_id = created["id"]
    first = client.get(f"/listings/{listing_id}").json()
    second = client.get(f"/listings/{listing_id}").json()
    assert first["latitude"] == second["latitude"] and first["longitude"] == second["longitude"]
    assert (first["latitude"], first["longitude"]) != ("-33.940000", "18.470000")
    assert first["address_line"] is None and first["geocoding_place_id"] is None
    assert first["geocoding_provider"] == "approximate"
    owner = client.get(f"/me/listings/{listing_id}").json()
    assert owner["latitude"] == "-33.940000" and owner["longitude"] == "18.470000"
    assert (
        owner["address_line"] == "12 Exact Street"
        and owner["geocoding_place_id"] == "exact-place-id"
    )


def test_public_listing_detail_returns_404_for_draft_listing(client: TestClient) -> None:
    response = client.get(f"/listings/{draft_listing_id}")

    assert response.status_code == 404
    assert response.json() == {"detail": "Listing was not found."}


def test_owner_can_list_their_own_listings_including_drafts(client: TestClient) -> None:
    override_user("admin-1", "admin")

    response = client.get("/me/listings")

    assert response.status_code == 200
    body = response.json()
    assert {listing["id"] for listing in body} == {
        str(draft_listing_id),
        str(published_listing_id),
    }
    assert {listing["status"] for listing in body} == {"draft", "published"}


def test_owner_can_view_their_own_draft_listing(client: TestClient) -> None:
    override_user("admin-1", "admin")

    response = client.get(f"/me/listings/{draft_listing_id}")

    assert response.status_code == 200
    body = response.json()
    assert body["id"] == str(draft_listing_id)
    assert body["status"] == "draft"
    assert body["owner_id"] == str(provider_id)


def test_owner_cannot_view_another_owners_listing_in_owner_endpoint(
    client: TestClient,
) -> None:
    override_user("admin-2", "admin")

    response = client.get(f"/me/listings/{published_listing_id}")

    assert response.status_code == 403


def test_owner_listing_routes_require_authentication(client: TestClient) -> None:
    list_response = client.get("/me/listings")
    detail_response = client.get(f"/me/listings/{published_listing_id}")

    assert list_response.status_code == 401
    assert detail_response.status_code == 401


@pytest.mark.parametrize(
    ("method", "path", "payload"),
    [
        ("get", "/me/listings", None),
        ("get", f"/me/listings/{published_listing_id}", None),
        ("post", "/listings", {}),
        ("patch", f"/listings/{published_listing_id}", {"title": "Nope"}),
        ("delete", f"/listings/{published_listing_id}", None),
    ],
)
def test_renter_is_forbidden_from_every_listing_management_route(
    client: TestClient,
    method: str,
    path: str,
    payload: dict[str, str] | None,
) -> None:
    override_user("renter-1", "renter")
    response = client.request(method, path, json=payload)
    assert response.status_code == 403


def test_owner_can_update_their_listing(client: TestClient) -> None:
    override_user("admin-1", "admin")

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


def test_owner_can_create_listing_with_rental_fields(client: TestClient) -> None:
    override_user("admin-1", "admin")

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
            "address_line": "12 Main Road",
            "city": "Cape Town",
            "province": "Western Cape",
            "postal_code": "7700",
            "country_code": "ZA",
            "latitude": "-33.957000",
            "longitude": "18.470000",
            "geocoding_provider": "test-provider",
            "geocoding_place_id": "place-123",
            "currency": "zar",
            "location": "Cape Town",
            "status": "published",
        },
    )

    assert response.status_code == 201
    body = response.json()
    assert body["owner_id"] == str(provider_id)
    assert body["owner_name"] == "Owner One"
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
    assert body["address_line"] == "12 Main Road"
    assert body["city"] == "Cape Town"
    assert body["province"] == "Western Cape"
    assert body["postal_code"] == "7700"
    assert body["country_code"] == "ZA"
    assert body["latitude"] == "-33.957000"
    assert body["longitude"] == "18.470000"
    assert body["geocoding_provider"] == "test-provider"
    assert body["geocoding_place_id"] == "place-123"
    assert body["currency"] == "ZAR"

    persisted_response = client.get(f"/listings/{body['id']}")
    assert persisted_response.status_code == 200
    assert persisted_response.json()["latitude"] != "-33.957000"
    assert persisted_response.json()["address_line"] is None
    assert persisted_response.json()["geocoding_provider"] == "approximate"


def test_renter_cannot_create_listing(client: TestClient) -> None:
    override_user("renter-1", "renter")

    response = client.post(
        "/listings",
        json={
            "category_id": str(category_id),
            "title": "Legacy role listing",
            "price": "0.00",
            "currency": "ZAR",
            "status": "draft",
        },
    )

    assert response.status_code == 403


def test_non_owner_cannot_update_another_listing(client: TestClient) -> None:
    override_user("admin-2", "admin")

    response = client.patch(
        f"/listings/{published_listing_id}",
        json={"title": "Hijacked"},
    )

    assert response.status_code == 403

    detail_response = client.get(f"/listings/{published_listing_id}")
    assert detail_response.status_code == 200
    assert detail_response.json()["title"] == "Sunny single room in Observatory"


def test_owner_can_delete_their_listing(client: TestClient) -> None:
    override_user("admin-1", "admin")

    response = client.delete(f"/listings/{published_listing_id}")

    assert response.status_code == 204

    detail_response = client.get(f"/listings/{published_listing_id}")
    assert detail_response.status_code == 404


def test_non_owner_cannot_delete_another_listing(client: TestClient) -> None:
    override_user("admin-2", "admin")

    response = client.delete(f"/listings/{published_listing_id}")

    assert response.status_code == 403

    detail_response = client.get(f"/listings/{published_listing_id}")
    assert detail_response.status_code == 200


@pytest.mark.parametrize(
    ("field", "value"),
    [
        ("latitude", "-90.000001"),
        ("latitude", "90.000001"),
        ("longitude", "-180.000001"),
        ("longitude", "180.000001"),
    ],
)
def test_listing_rejects_coordinates_outside_valid_ranges(
    client: TestClient, field: str, value: str
) -> None:
    override_user("admin-1", "admin")
    payload = {
        "category_id": str(category_id),
        "title": f"Invalid {field} listing",
        "price": "100.00",
        field: value,
    }

    response = client.post("/listings", json=payload)

    assert response.status_code == 422


def test_legacy_listing_without_coordinates_remains_available(
    client: TestClient,
) -> None:
    response = client.get(f"/listings/{published_listing_id}")

    assert response.status_code == 200
    assert response.json()["location"] == "Cape Town"
    assert response.json()["area"] == "Observatory"
    assert response.json()["latitude"] is None
    assert response.json()["longitude"] is None


def test_owner_location_update_is_preserved_by_unrelated_edits(client: TestClient) -> None:
    override_user("admin-1", "admin")
    location = {
        "address_line": "12 Jorissen Street",
        "area": "Braamfontein",
        "city": "Johannesburg",
        "province": "Gauteng",
        "postal_code": "2001",
        "country_code": "ZA",
        "latitude": "-26.192900",
        "longitude": "28.030500",
        "geocoding_provider": "fake",
        "geocoding_place_id": "braam-123",
    }
    response = client.patch(f"/listings/{draft_listing_id}", json=location)
    assert response.status_code == 200
    assert response.json()["latitude"] == "-26.192900"

    response = client.patch(f"/listings/{draft_listing_id}", json={"title": "Edited title"})
    assert response.status_code == 200
    body = response.json()
    assert body["address_line"] == "12 Jorissen Street"
    assert body["latitude"] == "-26.192900"
    assert body["longitude"] == "28.030500"
    assert body["geocoding_place_id"] == "braam-123"


@pytest.mark.parametrize(
    ("query", "expected"),
    [
        ("min_rent=6500&max_rent=6500", 1),
        (f"category_id={category_id}", 1),
        ("city=Cape%20Town&area=observatory", 1),
        ("furnished=true", 1),
        ("furnished=false", 0),
        ("q=utilities", 1),
        ("available_by=2026-07-15", 1),
        ("agent_fee=none", 0),
        ("agent_fee=has", 1),
    ],
)
def test_public_listing_filters(client: TestClient, query: str, expected: int) -> None:
    response = client.get(f"/listings?{query}")
    assert response.status_code == 200
    assert len(response.json()) == expected


@pytest.mark.parametrize(
    "query",
    [
        "south=-26&west=28&north=-25",
        "south=-91&west=27&north=-25&east=29",
        "south=-25&west=27&north=-26&east=29",
        "south=-26&west=29&north=-25&east=27",
        "min_rent=-1",
        "min_rent=7000&max_rent=6000",
        "agent_fee=maybe",
    ],
)
def test_public_listing_rejects_invalid_search_ranges(client: TestClient, query: str) -> None:
    response = client.get(f"/listings?{query}")
    assert response.status_code == 422
    assert "detail" in response.json()


def test_bounds_exclude_outside_and_coordinate_less_listings(client: TestClient) -> None:
    override_user("admin-1", "admin")
    inside = client.patch(
        f"/listings/{published_listing_id}",
        json={"latitude": "-26.192900", "longitude": "28.030500"},
    )
    assert inside.status_code == 200
    outside = client.post(
        "/listings",
        json={
            "category_id": str(category_id),
            "title": "Cape Town room",
            "price": "1",
            "rent_amount": "4000",
            "status": "published",
            "latitude": "-33.924900",
            "longitude": "18.424100",
        },
    )
    assert outside.status_code == 201
    without_coordinates = client.post(
        "/listings",
        json={
            "category_id": str(category_id),
            "title": "Unknown location room",
            "price": "1",
            "rent_amount": "4000",
            "status": "published",
        },
    )
    assert without_coordinates.status_code == 201

    response = client.get(
        "/listings?south=-26.25&west=27.95&north=-26.10&east=28.15&min_rent=6000&furnished=true"
    )
    assert response.status_code == 200
    assert [item["id"] for item in response.json()] == [str(published_listing_id)]
