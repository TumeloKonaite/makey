import uuid
from collections.abc import Generator

from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.main import app
from app.models import Category
from app.repository.database.tables.base_model import Base
from app.repository.database.tables.session_manager import get_db


hair_id = uuid.UUID("3c67a6cc-29c5-4d46-b6f9-262056d9cb70")
nails_id = uuid.UUID("ff0cd8f5-e0aa-4874-8ad6-4566ed6e851e")
inactive_id = uuid.UUID("b4d3a492-5b4f-4082-98fd-65d02af692e8")


def seed_categories(db: Session) -> None:
    db.add_all(
        [
            Category(
                id=hair_id,
                name="Hair",
                slug="hair",
                description="Hair styling, braids, cuts, wigs, and treatments",
            ),
            Category(
                id=nails_id,
                name="Nails",
                slug="nails",
                description="Manicures, pedicures, nail art, and extensions",
            ),
            Category(
                id=inactive_id,
                name="Makeup",
                slug="makeup",
                description="Makeup artists and cosmetic beauty services",
                is_active=False,
            ),
        ],
    )
    db.commit()


def build_client() -> TestClient:
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
        seed_categories(db)

    def override_get_db() -> Generator[Session, None, None]:
        db = testing_session_local()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = override_get_db
    return TestClient(app)


def test_list_categories_returns_active_categories() -> None:
    client = build_client()
    try:
        response = client.get("/categories")
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 200
    assert response.json() == [
        {
            "id": str(hair_id),
            "name": "Hair",
            "slug": "hair",
            "description": "Hair styling, braids, cuts, wigs, and treatments",
        },
        {
            "id": str(nails_id),
            "name": "Nails",
            "slug": "nails",
            "description": "Manicures, pedicures, nail art, and extensions",
        },
    ]


def test_get_category_returns_category_by_id() -> None:
    client = build_client()
    try:
        response = client.get(f"/categories/{hair_id}")
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 200
    assert response.json() == {
        "id": str(hair_id),
        "name": "Hair",
        "slug": "hair",
        "description": "Hair styling, braids, cuts, wigs, and treatments",
    }


def test_get_category_returns_404_for_invalid_id() -> None:
    client = build_client()
    missing_id = uuid.UUID("11111111-1111-4111-8111-111111111111")

    try:
        response = client.get(f"/categories/{missing_id}")
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 404
    assert response.json() == {"detail": "Category not found"}
