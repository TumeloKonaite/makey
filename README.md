# Marketplace Rooms

## Marketplace Backend Local Setup

The backend lives in [`backend`](backend). Run backend setup, migrations, the
API, and tests from that directory.

Production deployment to Modal is documented in
[`docs/deployment/modal.md`](docs/deployment/modal.md). The Modal deployment
path is additive; the local Docker Compose and `uvicorn` workflow below stays
the same.

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

If you want to run `uvicorn` locally while pointing at remote services such as
Supabase instead of local Docker containers, use the dedicated server-test
template and copy it over `backend/.env` for that session:

```powershell
Copy-Item .env.server-test.example .env
```

That server-test template uses `APP_ENV=test` so the API keeps local-friendly
origin handling but does not try to auto-create the local MinIO bucket on
startup.

### 4. Start local dependency services

Start PostgreSQL, MinIO, and Keycloak from the backend directory, or run the
same command from the repository root now that a root-level compose file is
available:

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

## RoomWise Marketplace Frontend

The only active frontend lives in [`RoomWise Marketplace`](<RoomWise Marketplace>).
The root-level [`frontend`](frontend) directory is legacy and must not be used
for Vercel deployments.

This frontend is a TanStack Start SSR application. It keeps its server entry in
`src/server.ts` and builds through Nitro. Do not convert it to a static SPA, do
not add a blanket rewrite to `index.html`, and do not configure a `dist`
output directory for Vercel.

### 1. Install frontend dependencies

From the repository root:

```powershell
Set-Location "RoomWise Marketplace"
npm install
```

Use npm for deployment work. The active app includes `package-lock.json` and
declares `packageManager: npm@11.8.0`.

### 2. Create the frontend env file

```powershell
Copy-Item .env.example .env
```

The default values point at the local FastAPI API and local Keycloak realm:

```text
VITE_API_BASE_URL=http://localhost:8000
VITE_KEYCLOAK_ISSUER=http://localhost:8080/realms/marketplace
VITE_KEYCLOAK_TOKEN_URL=http://localhost:8080/realms/marketplace/protocol/openid-connect/token
VITE_KEYCLOAK_CLIENT_ID=marketplace-api
```

If you want to test the frontend against the deployed Modal backend instead of
your local API, use the dedicated server-test template:

```powershell
Copy-Item .env.server-test.example .env
```

That template currently points at:

```text
https://tumelokonaitedev--rooms-marketplace-api-fastapi-app.modal.run
```

Public listing/category routes should work immediately. Update the
`VITE_KEYCLOAK_*` values in that file before testing login or owner-only flows
against production auth.

### 3. Start the backend dependencies and API

In one terminal:

```powershell
Set-Location backend
.venv\Scripts\Activate.ps1
docker compose up -d postgres minio keycloak
alembic upgrade head
uvicorn app.main:app --reload --port 8000
```

The local API now accepts common frontend dev origins including
`http://localhost:3000` and `http://localhost:5173`.

### 4. Start the RoomWise frontend

In a second terminal:

```powershell
Set-Location "RoomWise Marketplace"
npm run dev
```

Open the dev URL printed by Vite/TanStack Start in your browser.

### 5. Local test and smoke-test commands

Backend:

```powershell
Set-Location backend
.venv\Scripts\Activate.ps1
pytest
```

Frontend quality checks:

```powershell
Set-Location "RoomWise Marketplace"
npm run lint
npm run typecheck
npm run build
```

Quick API smoke tests:

```powershell
Invoke-WebRequest http://localhost:8000/docs
Invoke-WebRequest http://localhost:8000/categories
Invoke-WebRequest http://localhost:8000/listings
```

## Vercel Deployment

Deploy the active frontend from:

```text
RoomWise Marketplace
```

Vercel project settings:

```text
Root Directory: RoomWise Marketplace
Install Command: npm install
Build Command: npm run build
Node.js: ^20.19.0 || >=22.12.0
Framework Preset: Auto / Other (Nitro generates the Vercel output)
Output Directory: leave empty
```

The active frontend root that Vercel should read is:

```text
RoomWise Marketplace/package.json
RoomWise Marketplace/vite.config.ts
RoomWise Marketplace/src/
```

### SSR output and local reproduction

The app stays server-rendered on Vercel. Its `vite.config.ts` keeps the
existing TanStack Start server entry and switches Nitro to the `vercel` preset
when `VERCEL` or `NITRO_PRESET=vercel` is present.

Verified local Vercel-targeted builds currently resolve to Nitro's `vercel`
preset with the `web` entry format and emit:

```text
.vercel/output/static
.vercel/output/functions/__server.func
```

Generic local builds still emit Nitro's standard SSR artifacts:

```text
.output/public
.output/server
```

To reproduce the Vercel-targeted build locally:

```powershell
Set-Location "RoomWise Marketplace"
$env:NITRO_PRESET="vercel"
cmd /c npm.cmd run build
Remove-Item Env:NITRO_PRESET
```

```bash
cd "RoomWise Marketplace"
NITRO_PRESET=vercel npm run build
```

When the Vercel preset is active, Nitro generates Vercel's build output itself.
Do not manually copy `.output` into another folder and do not configure a
static export.

### Vercel environment variables

Add these variables in Vercel for Production, Preview, and Development as
needed:

```text
VITE_API_BASE_URL=
VITE_KEYCLOAK_ISSUER=
VITE_KEYCLOAK_TOKEN_URL=
VITE_KEYCLOAK_CLIENT_ID=
```

Expected usage:

```text
VITE_API_BASE_URL         -> frontend API requests
VITE_KEYCLOAK_ISSUER      -> Keycloak issuer / authorization realm
VITE_KEYCLOAK_TOKEN_URL   -> Keycloak token endpoint
VITE_KEYCLOAK_CLIENT_ID   -> public frontend Keycloak client id
```

The frontend now fails fast for non-development builds if any of those values
are missing or if the API/Keycloak URLs still point at `localhost`.

### Production backend and CORS

Set the production backend to the canonical production frontend origin:

```text
FRONTEND_ORIGIN=https://<production-project-domain>
```

Optional preview support is now controlled separately:

```text
FRONTEND_PREVIEW_ORIGIN_REGEX=^https://roomwise-marketplace-git-[a-z0-9-]+-roomwise-team\.vercel\.app$
```

Guidance for the preview regex:

```text
- Match only this Vercel project/team namespace
- Keep the exact FRONTEND_ORIGIN allow-list for production
- Leave FRONTEND_PREVIEW_ORIGIN_REGEX unset to disable preview CORS entirely
```

With that regex unset, preview deployments are rejected by backend CORS. With
it set, matching RoomWise preview domains are allowed while unrelated
`vercel.app` projects remain blocked.

### Production URLs

Set these canonical URLs during rollout:

```text
Production frontend URL: https://<production-project-domain>
Production backend URL:  https://<production-api-domain>
```

The checked-in server-test example currently uses this shared remote backend
for smoke testing:

```text
https://tumelokonaitedev--rooms-marketplace-api-fastapi-app.modal.run
```

### Keycloak production configuration

Update the RoomWise frontend client in Keycloak with the production frontend
origin. Use the narrowest settings that fit the current auth flow:

```text
Valid redirect URIs:
  https://<production-project-domain>/*

Web origins:
  https://<production-project-domain>

Valid post-logout redirect URIs:
  https://<production-project-domain>/*
```

Current frontend routes that must keep working include:

```text
/
/listings
/listings/*
/dashboard
/dashboard/listings
/dashboard/enquiries
```

Do not add legacy `/owner` routes to the Keycloak client.

### Preview deployment policy

Recommended policy:

```text
- Enable backend preview CORS only with FRONTEND_PREVIEW_ORIGIN_REGEX
- Keep production auth on the exact canonical frontend origin
- Treat authenticated preview deployments as opt-in
```

Preview authentication is only supported after you add matching project-scoped
preview redirect and web-origin rules in Keycloak. If you do not add those
rules, use preview deployments for public marketplace testing only.

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
