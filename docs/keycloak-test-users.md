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
provider
customer
admin
```

These roles are used by the API to control access to protected endpoints.

## Create a Provider User

Navigate to:

```text
Users -> Create User
```

Enter:

```text
Username: provider@test.com
Email: provider@test.com
First Name: Test
Last Name: Provider
Email Verified: ON
```

Click **Create**.

### Set Password

Navigate to:

```text
Users -> provider@test.com -> Credentials
```

Set:

```text
Password: Password123!
Temporary: OFF
```

Click **Save**.

### Assign Provider Role

Navigate to:

```text
Users -> provider@test.com -> Role Mapping -> Assign Role
```

Switch the filter to **Realm Roles** and assign:

```text
provider
```

The assigned roles should include:

```text
default-roles-marketplace
provider
```

## Create a Customer User

Navigate to:

```text
Users -> Create User
```

Enter:

```text
Username: customer@test.com
Email: customer@test.com
First Name: Test
Last Name: Customer
Email Verified: ON
```

Click **Create**.

### Set Password

Navigate to:

```text
Users -> customer@test.com -> Credentials
```

Set:

```text
Password: Password123!
Temporary: OFF
```

Click **Save**.

### Assign Customer Role

Navigate to:

```text
Users -> customer@test.com -> Role Mapping -> Assign Role
```

Switch the filter to **Realm Roles** and assign:

```text
customer
```

The assigned roles should include:

```text
default-roles-marketplace
customer
```

## Verify Authentication

Obtain a provider access token:

```bash
curl -X POST "http://localhost:8080/realms/marketplace/protocol/openid-connect/token" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "client_id=marketplace-api" \
  -d "grant_type=password" \
  -d "username=provider@test.com" \
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
| provider | Create, update, delete listings and upload listing images |
| customer | Browse listings and submit enquiries |
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
