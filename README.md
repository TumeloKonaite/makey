# Marketplace Rooms

## Marketplace Backend Local Setup

The backend lives in [`backend`](backend). Run backend setup, migrations, the
API, and tests from that directory.

Do not reuse a virtual environment from another repository. Create and activate
`backend/.venv` so imports and dependencies come from this project only.

### 1. Create a backend-specific virtual environment

```powershell
Set-Location backend
python -m venv .venv
```

Activate it:

```powershell
# Windows PowerShell
.venv\Scripts\Activate.ps1
```

```bash
# macOS/Linux/WSL
source .venv/bin/activate
```

If `python` does not resolve inside `backend/.venv`, stop and reactivate the
correct environment before installing packages or running tests.

### 2. Install backend dependencies

Use the backend requirements files, not dependencies from another repo:

```bash
pip install -r requirements-dev.txt
```

`requirements-dev.txt` includes the runtime requirements and pytest.

### 3. Configure local environment variables

Copy the backend example file and adjust values only if your local ports or
credentials differ:

```powershell
Copy-Item .env.example .env
```

```bash
cp .env.example .env
```

The checked-in example is set up for running `uvicorn` directly from
`backend/` against local Docker services on `localhost`.

### 4. Start local dependency services

Start PostgreSQL, MinIO, and Keycloak from the backend directory:

```bash
docker compose up -d postgres minio keycloak
```

Local service endpoints:

```text
API:             http://localhost:8000
Swagger docs:    http://localhost:8000/docs
Keycloak:        http://localhost:8080
MinIO API:       http://localhost:9000
MinIO Console:   http://localhost:9001
Postgres:        localhost:5432
```

MinIO console login:

```text
minioadmin / minioadmin
```

Uploaded listing images are stored under:

```text
storage/minio
```

If you want to run the API inside Docker Compose instead of locally, use:

```bash
docker compose up --build
```

### 5. Run database migrations

With the backend virtual environment activated and the local services running:

```bash
alembic upgrade head
```

### 6. Run the FastAPI backend locally

From the backend directory:

```bash
uvicorn app.main:app --reload --port 8000
```

The API creates the `listing-images` bucket on startup if it is missing and
applies a public read policy so returned image URLs can be opened in a browser.

### 7. Run tests from the backend project root

Run pytest from `backend/` with the backend virtual environment activated:

```bash
pytest
```

Targeted examples:

```bash
pytest tests/test_categories.py
pytest tests/test_listings.py
pytest tests/test_listing_images.py
```

The tests are expected to run from the backend project root so the local
`app` package and `.env` resolve from this repository, not from another repo's
virtual environment.

## Local Keycloak

Keycloak is available at `http://localhost:8080`. Sign in to the admin console
with `admin` / `admin`.

Create a realm named `marketplace`, then create an OpenID Connect client named
`marketplace-api` with these local settings:

```text
Client authentication: Off
Direct access grants: On
Valid redirect URIs: http://localhost:5173/*
Web origins: http://localhost:5173
```

Create realm roles named `owner`, `renter`, and `admin`. For local testing,
create users such as `owner@test.com` and `renter@test.com`, set passwords for
them, and assign the matching realm role.

The API still accepts the legacy `provider` and `customer` roles during this
transition, but new docs and examples use rental marketplace language.

Detailed setup steps are documented in
[Creating Test Users in Keycloak](docs/keycloak-test-users.md).

To get a local owner access token for API testing:

```bash
curl -X POST "http://localhost:8080/realms/marketplace/protocol/openid-connect/token" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "client_id=marketplace-api" \
  -d "grant_type=password" \
  -d "username=owner@test.com" \
  -d "password=Password123!"
```

Copy the `access_token` value from the JSON response and send it as a bearer
token when calling owner-only endpoints.

## Troubleshooting

If pytest fails before collecting tests, confirm you are in `backend/` and that
the active interpreter comes from `backend/.venv`.

If an owner-only request returns `401`, generate a fresh token and make sure
Swagger receives only the raw token value, not `Bearer <token>`.

If image upload returns `403`, the authenticated owner does not own that
listing. Create the listing with the same owner token, then upload the image.

If `image_url` does not open in a browser, confirm the API logs show successful
startup and that the `listing-images` bucket exists in the MinIO console.
