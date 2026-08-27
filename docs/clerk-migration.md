# Clerk migration and role cutover

This runbook migrates identity without changing local user UUIDs, so listing and
historical enquiry foreign keys remain intact.

## Roles and security model

The only canonical roles are `admin` and `renter`. A missing, malformed, or
unknown role is always treated as `renter`. Legacy owner-like roles are not
administrators and are migrated to `renter` pending manual review.

Clerk stores the role in user `publicMetadata`. Configure the session claim as:

```json
{ "role": "{{user.public_metadata.role}}" }
```

Do not place a role in `unsafeMetadata`; users can edit that data. Promote an
approved administrator in the Clerk Dashboard or through a backend operation
authenticated with `CLERK_SECRET_KEY`.

## Export and import

1. Take a database backup and export Keycloak users, including subject, email,
   username/name, enabled status, and credential data.
2. Create separate Clerk development and production instances. Clerk does not
   migrate development users into production.
3. Use Clerk's migration tool or Create User Backend API. Store the former
   subject as Clerk `external_id`; this makes the identity map auditable.
4. Set imported `publicMetadata.role` to `renter` unless an operator has
   explicitly approved that individual as an admin.

Clerk accepts several documented password hashers, but Keycloak deployments can
use algorithms or encodings that are not import-compatible. Confirm the exact
exported credential format against Clerk's current Create User API before
including `password_digest` and `password_hasher`. If it is not supported,
import the account without a password and send Clerk password-reset invitations.
All previous sessions end at cutover in either case.

## Database reconciliation

Stop user/listing writes during the final export window.

```bash
cd backend
alembic upgrade 20260827_0008
```

Create a reviewed CSV from the Clerk import result:

```csv
keycloak_user_id,clerk_user_id
old-subject-1,user_2abc
old-subject-2,user_3def
```

Then run:

```bash
python -m scripts.reconcile_clerk_users clerk-user-map.csv
alembic upgrade head
```

The reconciliation is transactional, rejects duplicate Clerk IDs and fails if
any local user is missing. The final migration independently refuses to drop
the old provider column while any `clerk_user_id` is null.

Validate before finalization:

```sql
SELECT count(*) FROM users WHERE clerk_user_id IS NULL;
SELECT role, count(*) FROM users GROUP BY role;
SELECT count(*) FROM listings l LEFT JOIN users u ON u.id = l.provider_id
WHERE u.id IS NULL;
```

Expected results are zero, only `admin`/`renter`, and zero respectively.

## Webhooks and environments

Configure `/webhooks/clerk` for `user.created` and `user.updated` in every Clerk
instance. The endpoint verifies Svix signatures with
`CLERK_WEBHOOK_SIGNING_SECRET`, synchronizes the Clerk ID/email/name/role, and
sets missing or unknown roles to renter in Clerk.

Set these backend variables in local, test, preview, and production:

```text
CLERK_SECRET_KEY
CLERK_WEBHOOK_SIGNING_SECRET
CLERK_AUTHORIZED_PARTIES
```

Set these on the TanStack Start server deployment:

```text
VITE_CLERK_PUBLISHABLE_KEY
CLERK_SECRET_KEY
```

Smoke-test guests and renters against public listing routes, then verify every
dashboard and mutation route with a renter (403) and an admin (success) before
ending maintenance mode.
