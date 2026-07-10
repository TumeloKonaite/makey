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
from app.repository.storage.minio_storage import (
    MinioImageStorage,
    StoredImage,
    _parse_minio_endpoint,
    _with_path_prefix,
)

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
        keycloak_user_id="owner-1",
        email="owner@example.com",
        display_name="Owner One",
        role="provider",
    )
    other_provider = User(
        id=other_provider_id,
        keycloak_user_id="owner-2",
        email="other-owner@example.com",
        display_name="Owner Two",
        role="provider",
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


def test_successful_owner_upload(client: TestClient, monkeypatch: pytest.MonkeyPatch) -> None:
    override_user("owner-1", ["owner"])
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


def test_non_owner_upload_returns_403(client: TestClient) -> None:
    override_user("renter-1", ["renter"])

    response = upload_png(client)

    assert response.status_code == 403


def test_owner_cannot_upload_to_another_owners_listing(client: TestClient) -> None:
    override_user("owner-2", ["owner"])

    response = upload_png(client)

    assert response.status_code == 403


def test_invalid_file_type_rejected(client: TestClient) -> None:
    override_user("owner-1", ["owner"])

    response = client.post(
        f"/listings/{listing_id}/images",
        files={"file": ("image.gif", b"gifdata", "image/gif")},
    )

    assert response.status_code == 400
    assert response.json() == {
        "detail": "Only JPEG, PNG, and WebP images are allowed.",
    }


def test_oversized_file_rejected(client: TestClient, monkeypatch: pytest.MonkeyPatch) -> None:
    override_user("owner-1", ["owner"])

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


def test_supabase_s3_endpoint_path_is_preserved() -> None:
    endpoint, secure, path_prefix = _parse_minio_endpoint(
        "https://project-ref.storage.supabase.co/storage/v1/s3"
    )

    assert endpoint == "project-ref.storage.supabase.co"
    assert secure is True
    assert path_prefix == "/storage/v1/s3"


def test_public_url_supports_supabase_public_bucket_base_url() -> None:
    storage = MinioImageStorage(
        Settings(
            MINIO_ENDPOINT="https://project-ref.storage.supabase.co/storage/v1/s3",
            MINIO_PUBLIC_URL="https://project-ref.supabase.co/storage/v1/object/public",
            MINIO_ACCESS_KEY="access-key",
            MINIO_SECRET_KEY="secret-key",
            MINIO_BUCKET_LISTING_IMAGES="rooms_marketplace",
            MAX_IMAGE_UPLOAD_MB=5,
        )
    )

    assert storage.build_public_url("listings/abc/image.png") == (
        "https://project-ref.supabase.co/storage/v1/object/public/"
        "rooms_marketplace/listings/abc/image.png"
    )


def test_storage_path_prefix_joining_handles_root_path() -> None:
    assert _with_path_prefix("/", "/storage/v1/s3") == "/storage/v1/s3"
    assert _with_path_prefix("/rooms_marketplace", "/storage/v1/s3") == (
        "/storage/v1/s3/rooms_marketplace"
    )
