import json
import uuid
from collections.abc import Generator
from datetime import datetime, timezone

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool
from svix.webhooks import Webhook

from app.api.routes import webhooks
from app.core.config import Settings
from app.main import create_app
from app.models import User
from app.repository.database.tables.base_model import Base
from app.repository.database.tables.session_manager import get_db

WEBHOOK_SECRET = "whsec_dGVzdHNlY3JldA=="


@pytest.fixture()
def client(monkeypatch: pytest.MonkeyPatch) -> Generator[TestClient, None, None]:
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    session_local = sessionmaker(bind=engine)
    Base.metadata.create_all(engine)

    def override_get_db() -> Generator[Session, None, None]:
        with session_local() as db:
            yield db

    class FakeUsers:
        metadata_updates: list[tuple[str, dict[str, str]]] = []

        def update_metadata(self, user_id: str, public_metadata: dict[str, str]) -> None:
            self.metadata_updates.append((user_id, public_metadata))

    class FakeClerk:
        users = FakeUsers()

        def __init__(self, bearer_auth: str) -> None:
            assert bearer_auth == "sk_test_example"

    monkeypatch.setattr(webhooks, "Clerk", FakeClerk)
    app = create_app(
        Settings(
            APP_ENV="test",
            CLERK_SECRET_KEY="sk_test_example",
            CLERK_WEBHOOK_SIGNING_SECRET=WEBHOOK_SECRET,
        )
    )
    app.dependency_overrides[get_db] = override_get_db
    app.state.session_local = session_local
    yield TestClient(app)


def signed_headers(body: str) -> dict[str, str]:
    message_id = "msg_test_123"
    timestamp = datetime.now(timezone.utc)
    signature = Webhook(WEBHOOK_SECRET).sign(message_id, timestamp, body)
    return {
        "svix-id": message_id,
        "svix-timestamp": str(int(timestamp.timestamp())),
        "svix-signature": signature,
        "content-type": "application/json",
    }


def test_webhook_signature_is_required(client: TestClient) -> None:
    response = client.post("/webhooks/clerk", content="{}")
    assert response.status_code == 400


def test_new_user_defaults_to_renter(client: TestClient) -> None:
    event = {
        "type": "user.created",
        "data": {
            "id": "user_new",
            "first_name": "Jane",
            "last_name": "Renter",
            "primary_email_address_id": "email_1",
            "email_addresses": [
                {"id": "email_1", "email_address": "Jane@example.com"}
            ],
            "public_metadata": {},
        },
    }
    body = json.dumps(event, separators=(",", ":"))
    response = client.post("/webhooks/clerk", content=body, headers=signed_headers(body))

    assert response.status_code == 204
    session_local = client.app.state.session_local
    with session_local() as db:
        user = db.query(User).one()
        assert user.clerk_user_id == "user_new"
        assert user.email == "jane@example.com"
        assert user.role == "renter"
    assert webhooks.Clerk.users.metadata_updates == [
        ("user_new", {"role": "renter"})
    ]


def test_unknown_webhook_role_cannot_promote_user(client: TestClient) -> None:
    event = {
        "type": "user.updated",
        "data": {
            "id": "user_unknown",
            "primary_email_address_id": "email_1",
            "email_addresses": [
                {"id": "email_1", "email_address": "unknown@example.com"}
            ],
            "public_metadata": {"role": "owner"},
        },
    }
    body = json.dumps(event, separators=(",", ":"))
    response = client.post("/webhooks/clerk", content=body, headers=signed_headers(body))

    assert response.status_code == 204
    session_local = client.app.state.session_local
    with session_local() as db:
        assert db.query(User).one().role == "renter"
