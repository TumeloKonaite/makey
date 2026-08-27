from fastapi.testclient import TestClient

from app.main import app


def test_enquiry_creation_is_disabled() -> None:
    client = TestClient(app)
    response = client.post(
        "/listings/cccccccc-3333-4333-8333-333333333333/enquiries",
        json={"name": "Jane", "email": "jane@example.com", "message": "Hello"},
    )

    assert response.status_code == 404


def test_enquiry_management_is_disabled() -> None:
    client = TestClient(app)
    renter_response = client.get("/me/enquiries")
    admin_response = client.get("/me/owner-enquiries")

    assert renter_response.status_code == 404
    assert admin_response.status_code == 404
