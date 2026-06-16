import uuid
from collections.abc import Generator
from decimal import Decimal

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.api.routes.listings import listings as listing_routes
from app.core.auth import get_current_user
from app.core.config import Settings
from app.core.security import CurrentUser
from app.main import app
from app.models import Category, Listing, ListingImage, User
from app.repository.database.tables.base_model import Base
from app.repository.database.tables.session_manager import get_db
from app.repository.storage import InvalidImageFile
from app.repository.storage.minio_storage import MinioImageStorage, StoredImage

category_id = uuid.UUID("3c67a6cc-29c5-4d46-b6f9-262056d9cb70")
provider_id = uuid.UUID("aaaaaaaa-1111-4111-8111-111111111111")
other_provider_id = uuid.UUID("bbbbbbbb-2222-4222-8222-222222222222")
listing_id = uuid.UUID("cccccccc-3333-4333-8333-333333333333")


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
        name="Hair",
        slug="hair",
        description="Hair styling",
    )
    listing = Listing(
        id=listing_id,
        provider_id=provider_id,
        category_id=category_id,
        title="Braids",
        slug="braids",
        description="Protective styling",
        price=Decimal("250.00"),
        currency="ZAR",
        location="Cape Town",
        status="published",
    )
    db.add_all([provider, other_provider, category, listing])
    db.commit()


def override_user(user_id: str, roles: list[str]) -> None:
    app.dependency_overrides[get_current_user] = lambda: CurrentUser(
        sub=user_id,
        email=f"{user_id}@example.com",
        username=user_id,
        roles=roles,
    )


class FakeStorage:
    def upload_listing_image(self, listing_id: uuid.UUID, file: object) -> StoredImage:
        _ = file
        return StoredImage(
            object_name=f"listings/{listing_id}/image.png",
            public_url=f"http://cdn.test/listing-images/listings/{listing_id}/image.png",
            content_type="image/png",
            size_bytes=7,
        )


def upload_png(client: TestClient):
    return client.post(
        f"/listings/{listing_id}/images",
        files={"file": ("image.png", b"pngdata", "image/png")},
        data={"display_order": "2", "is_cover": "true"},
    )


def test_successful_provider_upload(client: TestClient, monkeypatch: pytest.MonkeyPatch) -> None:
    override_user("provider-1", ["provider"])
    monkeypatch.setattr(listing_routes, "MinioImageStorage", FakeStorage)

    response = upload_png(client)

    assert response.status_code == 201
    body = response.json()
    assert body["listing_id"] == str(listing_id)
    assert body["object_name"] == f"listings/{listing_id}/image.png"
    assert body["url"] == f"http://cdn.test/listing-images/listings/{listing_id}/image.png"
    assert body["image_url"] == body["url"]
    assert body["content_type"] == "image/png"
    assert body["size_bytes"] == 7
    assert body["display_order"] == 2
    assert body["is_cover"] is True
    assert "id" in body


def test_unauthenticated_upload_returns_401(client: TestClient) -> None:
    response = upload_png(client)

    assert response.status_code == 401


def test_non_provider_upload_returns_403(client: TestClient) -> None:
    override_user("customer-1", ["customer"])

    response = upload_png(client)

    assert response.status_code == 403


def test_provider_cannot_upload_to_another_providers_listing(client: TestClient) -> None:
    override_user("provider-2", ["provider"])

    response = upload_png(client)

    assert response.status_code == 403


def test_invalid_file_type_rejected(client: TestClient) -> None:
    override_user("provider-1", ["provider"])

    response = client.post(
        f"/listings/{listing_id}/images",
        files={"file": ("image.gif", b"gifdata", "image/gif")},
    )

    assert response.status_code == 400
    assert response.json() == {
        "detail": "Only JPEG, PNG, and WebP images are allowed.",
    }


def test_oversized_file_rejected(client: TestClient, monkeypatch: pytest.MonkeyPatch) -> None:
    override_user("provider-1", ["provider"])

    class SmallLimitStorage(MinioImageStorage):
        def __init__(self) -> None:
            super().__init__(
                Settings(
                    MINIO_ENDPOINT="localhost:9000",
                    MINIO_PUBLIC_URL="http://localhost:9000",
                    MINIO_ROOT_USER="minioadmin",
                    MINIO_ROOT_PASSWORD="minioadmin",
                    MINIO_BUCKET_LISTING_IMAGES="listing-images",
                    MAX_IMAGE_UPLOAD_MB=1,
                )
            )

    monkeypatch.setattr(listing_routes, "MinioImageStorage", SmallLimitStorage)

    response = client.post(
        f"/listings/{listing_id}/images",
        files={"file": ("image.png", b"x" * (1024 * 1024 + 1), "image/png")},
    )

    assert response.status_code == 400
    assert response.json() == {"detail": "Uploaded image exceeds the 1 MB limit."}


def test_public_listing_response_includes_image_urls(client: TestClient) -> None:
    image_id = uuid.UUID("dddddddd-4444-4444-8444-444444444444")
    override = app.dependency_overrides[get_db]
    db_generator = override()
    db = next(db_generator)
    try:
        db.add(
            ListingImage(
                id=image_id,
                listing_id=listing_id,
                object_name=f"listings/{listing_id}/cover.webp",
                image_url=f"http://cdn.test/listing-images/listings/{listing_id}/cover.webp",
                content_type="image/webp",
                size_bytes=128,
                display_order=0,
                is_cover=True,
            )
        )
        db.commit()
    finally:
        db.close()
        db_generator.close()

    list_response = client.get("/listings")
    detail_response = client.get(f"/listings/{listing_id}")

    assert list_response.status_code == 200
    listing = list_response.json()[0]
    assert listing["images"] == [
        {
            "id": str(image_id),
            "url": f"http://cdn.test/listing-images/listings/{listing_id}/cover.webp",
            "content_type": "image/webp",
            "size_bytes": 128,
            "display_order": 0,
            "is_cover": True,
        }
    ]
    assert detail_response.status_code == 200
    assert detail_response.json()["images"] == listing["images"]


def test_storage_rejects_invalid_file_type() -> None:
    storage = MinioImageStorage(
        Settings(
            MINIO_ENDPOINT="localhost:9000",
            MINIO_PUBLIC_URL="http://localhost:9000",
            MINIO_ROOT_USER="minioadmin",
            MINIO_ROOT_PASSWORD="minioadmin",
            MINIO_BUCKET_LISTING_IMAGES="listing-images",
            MAX_IMAGE_UPLOAD_MB=5,
        )
    )

    with pytest.raises(InvalidImageFile, match="Only JPEG, PNG, and WebP"):
        storage._validate_image(type("File", (), {"content_type": "image/gif"})())
