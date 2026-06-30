# Creating Test Users in Keycloak

The marketplace uses Keycloak for authentication and authorization.

These users are development-only test accounts. Do not use these credentials or
accounts in production.

## Access Keycloak

Open Keycloak in your browser:

```text
http://localhost:8080
```

Login using the admin credentials configured in `backend/docker-compose.yml`.
The local defaults are:

```text
admin / admin
```

## Create Roles

Navigate to:

```text
Realm Roles
```

Create the following roles:

```text
owner
renter
admin
```

These roles are used by the API to control access to protected endpoints. The
legacy `provider` and `customer` roles are still accepted temporarily during
the transition.

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

### Set Password

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

### Set Password

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

## Verify Authentication

Obtain an owner access token:

```bash
curl -X POST "http://localhost:8080/realms/marketplace/protocol/openid-connect/token" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "client_id=marketplace-api" \
  -d "grant_type=password" \
  -d "username=owner@test.com" \
  -d "password=Password123!"
```

A successful response returns:

```json
{
  "access_token": "...",
  "token_type": "Bearer"
}
```

## Authorization Rules

| Role | Permissions |
| --- | --- |
| owner | Create, update, delete listings and upload listing images |
| renter | Browse listings and submit enquiries |
| admin | Administrative actions |

Protected endpoints:

```text
POST   /listings
PATCH  /listings/{id}
DELETE /listings/{id}
POST   /listings/{id}/images
```

Public endpoints:

```text
GET /categories
GET /listings
GET /listings/{id}
```
