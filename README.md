# beautyverse_marketplace

## Local Backend Stack

Start the full backend stack from the repository root:

```bash
docker compose -f backend/docker-compose.yml up --build
```

Local services:

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

Uploaded listing images are stored by MinIO under the repository folder:

```text
storage/minio
```

The API creates the `listing-images` bucket on startup if it is missing and
applies a public read policy so returned image URLs can be opened in a browser.

## Local Keycloak

To run only Keycloak:

```bash
docker compose -f backend/docker-compose.yml up keycloak
```

Keycloak will be available at http://localhost:8080. Sign in to the admin
console with `admin` / `admin`.

Create a realm named `marketplace`, then create an OpenID Connect client named
`marketplace-api` with these MVP settings:

```text
Client authentication: Off
Direct access grants: On
Valid redirect URIs: http://localhost:5173/*
Web origins: http://localhost:5173
```

Create realm roles named `provider`, `customer`, and `admin`. For local testing,
create users such as `provider@test.com` and `customer@test.com`, set passwords
for them, and assign the matching realm role.

These local users are development-only test accounts. Do not use these
credentials or accounts in production.

Detailed setup steps are documented in
[Creating Test Users in Keycloak](docs/keycloak-test-users.md).

To get a local provider access token for API testing, make sure the
`marketplace-api` client allows direct access grants, then run:

```bash
curl -X POST "http://localhost:8080/realms/marketplace/protocol/openid-connect/token" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "client_id=marketplace-api" \
  -d "grant_type=password" \
  -d "username=provider@test.com" \
  -d "password=Password123!"
```

Copy the `access_token` value from the JSON response and send it as a bearer
token when calling provider-only endpoints.

For Swagger testing, save the token in your shell and print it:

```bash
TOKEN=$(curl -s -X POST "http://localhost:8080/realms/marketplace/protocol/openid-connect/token" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "client_id=marketplace-api" \
  -d "grant_type=password" \
  -d "username=provider@test.com" \
  -d "password=Password123!" \
  | python -c "import sys,json; print(json.load(sys.stdin).get('access_token', ''))")

echo "$TOKEN"
```

Open http://localhost:8000/docs, click **Authorize**, and paste only the token
value without the `Bearer` prefix.

To test listing image upload in Swagger, use a listing owned by that provider.
For example, if the listing id is:

```text
c0589995-4e21-494a-80a8-c354212852b8
```

Create a tiny test image in WSL if you do not have one handy:

```bash
printf 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=' | base64 -d > /tmp/test.png
```

In Swagger, open `POST /listings/{listing_id}/images` and set:

```text
listing_id = c0589995-4e21-494a-80a8-c354212852b8
file = /tmp/test.png
display_order = 0
is_cover = false
```

If you need to create a listing first, call `POST /listings` with the same
provider token. This example uses the seeded `Hair` category:

```bash
curl -i -X POST "http://localhost:8000/listings" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "category_id": "3c67a6cc-29c5-4d46-b6f9-262056d9cb70",
    "title": "Test listing",
    "slug": "test-listing",
    "description": "Test",
    "price": 100,
    "currency": "ZAR",
    "location": "Cape Town",
    "status": "draft"
  }'
```

Then upload an image with curl:

```bash
curl -i -X POST "http://localhost:8000/listings/<listing_id>/images" \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@/tmp/test.png" \
  -F "display_order=0" \
  -F "is_cover=false"
```

The response includes an `image_url` like:

```text
http://localhost:9000/listing-images/listings/<listing_id>/<image-uuid>.png
```

The backend validates Keycloak JWTs with:

```env
KEYCLOAK_ISSUER=http://localhost:8080/realms/marketplace
KEYCLOAK_AUTHORIZED_PARTY=marketplace-api
KEYCLOAK_JWKS_URL=http://localhost:8080/realms/marketplace/protocol/openid-connect/certs
```

When the API runs inside Docker Compose, use the Keycloak service name for
the JWKS URL, but keep the issuer matching the token's `iss` claim:

```env
KEYCLOAK_ISSUER=http://localhost:8080/realms/marketplace
KEYCLOAK_AUTHORIZED_PARTY=marketplace-api
KEYCLOAK_JWKS_URL=http://keycloak:8080/realms/marketplace/protocol/openid-connect/certs
```

Provider-only routes should depend on `require_role("provider")`:

```python
from fastapi import Depends

from app.core.auth import require_role
from app.core.security import CurrentUser


def create_listing(
    current_user: CurrentUser = Depends(require_role("provider")),
):
    ...
```

## Troubleshooting

If a provider-only request returns `401`, generate a fresh token and make sure
Swagger receives only the raw token value, not `Bearer <token>`.

If token generation returns an error, check that:

```text
Realm: marketplace
Client: marketplace-api
Direct access grants: On
User password is not temporary
User has the provider realm role
```

If image upload returns `403`, the authenticated provider does not own that
listing. Create the listing with the same provider token, then upload the image.

If `image_url` does not open in a browser, confirm the API logs show successful
startup and that the `listing-images` bucket exists in the MinIO console.
