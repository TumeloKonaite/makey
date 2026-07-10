# Creating Test Users in Keycloak

The marketplace uses Keycloak for local authentication and authorization.

These users are development-only test accounts. Do not use these credentials or
accounts in production.

## Access Keycloak

Open Keycloak in your browser:

```text
http://localhost:8080
```

Login using the local admin credentials from `backend/docker-compose.yml`:

```text
admin / admin
```

## Create the Realm

Create a realm named:

```text
marketplace
```

All local auth examples in this repo assume that realm name.

## Create the Frontend/API Client

Inside the `marketplace` realm, create an OpenID Connect client named:

```text
marketplace-api
```

Use these local settings:

```text
Client authentication: Off
Direct access grants: On
Valid redirect URIs: http://localhost:5173/*
Web origins: http://localhost:5173
```

Why these matter:

- The frontend owner sign-in page at `/login` uses the existing Keycloak token
  flow for the `marketplace-api` client.
- Direct access grants must be enabled for the local password-grant flow used
  by the frontend and curl examples.

## Create Roles

Navigate to:

```text
Realm Roles
```

Create these roles:

```text
owner
renter
admin
```

The backend still accepts legacy aliases during the transition:

```text
provider -> treated like owner
customer -> treated like renter
tenant   -> treated like renter
landlord -> treated like owner
```

Local setup and docs should still prefer `owner` and `renter`.

## Create an Owner User

Navigate to:

```text
Users -> Create User
```

Enter:

```text
Username: owner@test.com
Email: owner@test.com
First Name: Test
Last Name: Owner
Email Verified: ON
```

Click **Create**.

### Set Owner Password

Navigate to:

```text
Users -> owner@test.com -> Credentials
```

Set:

```text
Password: Password123!
Temporary: OFF
```

Click **Save**.

### Assign Owner Role

Navigate to:

```text
Users -> owner@test.com -> Role Mapping -> Assign Role
```

Switch the filter to **Realm Roles** and assign:

```text
owner
```

The assigned roles should include:

```text
default-roles-marketplace
owner
```

## Create a Renter User

Navigate to:

```text
Users -> Create User
```

Enter:

```text
Username: renter@test.com
Email: renter@test.com
First Name: Test
Last Name: Renter
Email Verified: ON
```

Click **Create**.

### Set Renter Password

Navigate to:

```text
Users -> renter@test.com -> Credentials
```

Set:

```text
Password: Password123!
Temporary: OFF
```

Click **Save**.

### Assign Renter Role

Navigate to:

```text
Users -> renter@test.com -> Role Mapping -> Assign Role
```

Switch the filter to **Realm Roles** and assign:

```text
renter
```

The assigned roles should include:

```text
default-roles-marketplace
renter
```

## Test the Frontend Login

Once the frontend is running locally, open:

```text
http://localhost:5173/login
```

Or, if you are using the bundled Node dev server:

```text
http://127.0.0.1:5173/login
```

Sign in with:

```text
owner@test.com / Password123!
```

After sign-in, the app should redirect into the owner dashboard and load these
authenticated routes:

```text
/dashboard
/dashboard/listings
/dashboard/listings/new
/dashboard/listings/{id}/edit
/dashboard/enquiries
```

## Verify Authentication by API Token

Obtain an owner access token:

```bash
curl -X POST "http://localhost:8080/realms/marketplace/protocol/openid-connect/token" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "client_id=marketplace-api" \
  -d "grant_type=password" \
  -d "username=owner@test.com" \
  -d "password=Password123!"
```

A successful response returns JSON like:

```json
{
  "access_token": "...",
  "token_type": "Bearer"
}
```

Use the raw `access_token` as a bearer token when calling owner-only endpoints.

## Authorization Rules

| Role | Permissions |
| --- | --- |
| owner | Sign into the owner dashboard, create/update/delete listings, publish/unpublish listings, upload listing images, and view enquiries for owned listings |
| renter | Browse public listings, submit enquiries, and view their own enquiries |
| admin | Administrative actions if added by future routes |

## Current Protected Endpoints

These routes require authentication in the current app:

```text
GET    /me/listings
GET    /me/listings/{id}
POST   /listings
PATCH  /listings/{id}
DELETE /listings/{id}
POST   /listings/{id}/images
GET    /me/enquiries
GET    /me/owner-enquiries
```

Notes:

- `/me/listings` and `/me/listings/{id}` are used by the owner dashboard to
  load the current owner's own listings, including drafts and unpublished
  listings.
- `/me/owner-enquiries` is used by the owner dashboard to show enquiries for
  the authenticated owner's listings.
- `/me/enquiries` is for the authenticated renter's own submitted enquiries.

## Current Public Endpoints

These routes are public in the current app:

```text
GET  /categories
GET  /listings
GET  /listings/{id}
POST /listings/{id}/enquiries
```

Note:

- `POST /listings/{id}/enquiries` is publicly accessible and also accepts an
  authenticated renter if a renter token is supplied.

## Quick Smoke Test

After creating the owner user and signing in:

1. Open `/dashboard`.
2. Create a draft room listing.
3. Edit that listing and upload at least one image.
4. Publish the listing.
5. Confirm the listing appears on the public `/listings` page.
6. Submit an enquiry from the public listing detail page.
7. Return to `/dashboard/enquiries` and confirm the owner can see it.

## Troubleshooting

If owner sign-in fails from the frontend:

- confirm the realm is named `marketplace`
- confirm the client is named `marketplace-api`
- confirm **Direct access grants** is enabled
- confirm the user has the `owner` realm role

If an owner-only API request returns `401`:

- generate a fresh token
- make sure the request sends `Authorization: Bearer <token>`
- if using Swagger, paste only the raw token value if the UI expects that

If an owner-only API request returns `403`:

- confirm the token has the `owner` role
- confirm the listing being changed belongs to the authenticated owner

If image upload returns `403`:

- the authenticated owner does not own that listing
- create the listing with the same owner account, then upload the image

If renter enquiries do not appear in the owner dashboard:

- make sure the listing was published before the enquiry was submitted
- make sure the enquiry was sent to a listing owned by the same authenticated
  owner account
