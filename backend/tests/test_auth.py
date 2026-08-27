from types import SimpleNamespace

import pytest
from fastapi.testclient import TestClient

from app.core import auth
from app.core.config import Settings
from app.main import create_app


@pytest.fixture()
def client(monkeypatch: pytest.MonkeyPatch) -> TestClient:
    app = create_app(
        Settings(
            APP_ENV="test",
            CLERK_SECRET_KEY="sk_test_example",
            CLERK_WEBHOOK_SIGNING_SECRET="whsec_example",
        )
    )
    monkeypatch.setattr(
        auth.Clerk,
        "authenticate_request",
        lambda self, request, options: SimpleNamespace(
            is_signed_in=True,
            payload={"sub": "user_123", "role": "renter"},
        ),
    )
    return TestClient(app)


def test_missing_token_is_rejected(client: TestClient) -> None:
    assert client.get("/me/listings").status_code == 401


def test_renter_token_cannot_access_admin_endpoint(client: TestClient) -> None:
    response = client.get("/me/listings", headers={"Authorization": "Bearer valid"})
    assert response.status_code == 403


@pytest.mark.parametrize("role", [None, "owner", "provider", "ADMIN", "unknown", 1])
def test_missing_or_unknown_role_is_read_only(
    client: TestClient,
    monkeypatch: pytest.MonkeyPatch,
    role: object,
) -> None:
    monkeypatch.setattr(
        auth.Clerk,
        "authenticate_request",
        lambda self, request, options: SimpleNamespace(
            is_signed_in=True,
            payload={"sub": "user_123", "role": role},
        ),
    )

    response = client.post(
        "/listings",
        headers={"Authorization": "Bearer valid", "X-Role": "admin"},
        json={},
    )
    assert response.status_code == 403


def test_invalid_or_expired_token_is_rejected(
    client: TestClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(
        auth.Clerk,
        "authenticate_request",
        lambda self, request, options: SimpleNamespace(
            is_signed_in=False,
            payload=None,
        ),
    )
    response = client.get("/me/listings", headers={"Authorization": "Bearer malformed"})
    assert response.status_code == 401
