import uuid

import pytest
from sqlalchemy import create_engine
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models import User
from app.repository.database.tables.base_model import Base


def test_user_schema_uses_clerk_id_and_canonical_roles() -> None:
    engine = create_engine("sqlite://")
    Base.metadata.create_all(engine)

    with Session(engine) as db:
        db.add(
            User(
                id=uuid.uuid4(),
                clerk_user_id="user_admin",
                email="admin@example.com",
                display_name="Admin",
                role="admin",
            )
        )
        db.commit()

        db.add(
            User(
                id=uuid.uuid4(),
                clerk_user_id="user_legacy",
                email="legacy@example.com",
                display_name="Legacy",
                role="owner",
            )
        )
        with pytest.raises(IntegrityError):
            db.commit()

    assert "clerk_user_id" in User.__table__.columns
    assert "keycloak_user_id" not in User.__table__.columns
    assert User.__table__.columns.clerk_user_id.nullable is False
