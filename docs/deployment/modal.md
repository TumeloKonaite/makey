# Modal Backend Deployment

This repository keeps local backend development under `backend/` and exposes the
production API from the repository root with:

```bash
modal deploy modal_app.py
```

The deployed Modal App is named `rooms-marketplace-api`. Re-running the same
deploy command updates that named App instead of creating a separate deployment.

A deploy-only template is available at [`/.env.modal.example`](/C:/Users/l/Documents/marketplace_rooms/.env.modal.example).
Keep real production values in an uncommitted `.env.modal` or directly in Modal
Secrets.

## Prerequisites

Install the Modal CLI and authenticate it once on the machine you use for
deploys:

```bash
pip install modal
modal setup
```

Before deploying, make sure the backend's production dependencies are reachable
from the public internet or from the network path available to Modal:

- PostgreSQL
- Keycloak issuer and JWKS URL
- S3-compatible object storage for listing images

Do not point production values at `localhost`, `postgres`, `keycloak`,
`minio`, or `host.docker.internal`. The backend now rejects those values when
`APP_ENV` is not local.

## Supabase-specific connection choice

If you are using Supabase Postgres from Modal, do not use the Prisma quickstart
from the Supabase "ORM" tab for this backend. This repository uses Python,
SQLAlchemy, and Alembic.

Use Supabase connection strings from the `Connect` button in your Supabase
dashboard:

- `DATABASE_URL`: prefer the Shared Pooler transaction endpoint on port `6543`
  for Modal runtime traffic.
- `MIGRATION_DATABASE_URL`: use the direct connection string when your network
  can reach it, or the Shared Pooler session endpoint on port `5432` when the
  direct endpoint is not reachable.

Typical Supabase values look like:

```text
DATABASE_URL=postgresql+psycopg://postgres.<project-ref>:<password>@aws-<region>.pooler.supabase.com:6543/postgres
MIGRATION_DATABASE_URL=postgresql+psycopg://postgres.<project-ref>:<password>@aws-<region>.pooler.supabase.com:5432/postgres
```

If Supabase shows `?pgbouncer=true` on the transaction pooler URL, that hint is
for some non-Python clients. This backend strips that query parameter before
building SQLAlchemy connections, so either of these is acceptable in the secret:

```text
DATABASE_URL=postgresql+psycopg://postgres.<project-ref>:<password>@aws-<region>.pooler.supabase.com:6543/postgres
DATABASE_URL=postgresql+psycopg://postgres.<project-ref>:<password>@aws-<region>.pooler.supabase.com:6543/postgres?pgbouncer=true
```

If your Supabase direct host `db.<project-ref>.supabase.co:5432` fails from
Modal with a hostname or connectivity error, switch the migration URL to the
Shared Pooler session endpoint instead.

## Supabase Storage via S3

Supabase Storage is S3-compatible and supports server-side access with
generated S3 access keys. Use the values from `Storage -> S3` in the Supabase
dashboard:

- `MINIO_ENDPOINT`: use the direct storage hostname and S3 path, for example
  `https://<project-ref>.storage.supabase.co/storage/v1/s3`
- `MINIO_REGION`: use the project region shown on the S3 configuration page
- `MINIO_ACCESS_KEY`: generated S3 Access Key ID
- `MINIO_SECRET_KEY`: generated S3 Secret Access Key
- `MINIO_BUCKET_LISTING_IMAGES`: your bucket name, for example
  `rooms_marketplace`
- `MINIO_PUBLIC_URL`: public object base URL, for example
  `https://<project-ref>.supabase.co/storage/v1/object/public`

This backend accepts either the legacy local-development names
`MINIO_ROOT_USER` / `MINIO_ROOT_PASSWORD` or the clearer
`MINIO_ACCESS_KEY` / `MINIO_SECRET_KEY` aliases for deploys.

If the frontend should render image URLs returned by the API directly, make the
Supabase bucket public or create equivalent access rules. This is an inference
from the backend behavior: it returns plain object URLs, not signed URLs.

## Required Secret

Create one Modal Secret named `rooms-marketplace-api-secrets` using the exact
environment variable names already used by the backend:

```bash
modal secret create rooms-marketplace-api-secrets \
  APP_ENV=production \
  FRONTEND_ORIGIN=https://rooms.example.com \
  DATABASE_URL='postgresql+psycopg://user:password@db.example.com:6543/marketplace' \
  MIGRATION_DATABASE_URL='postgresql+psycopg://user:password@db.example.com:5432/marketplace' \
  KEYCLOAK_ISSUER='https://auth.example.com/realms/marketplace' \
  KEYCLOAK_AUTHORIZED_PARTY='marketplace-api' \
  KEYCLOAK_JWKS_URL='https://auth.example.com/realms/marketplace/protocol/openid-connect/certs' \
  MINIO_ENDPOINT='https://<project-ref>.storage.supabase.co/storage/v1/s3' \
  MINIO_REGION='<project-region>' \
  MINIO_PUBLIC_URL='https://<project-ref>.supabase.co/storage/v1/object/public' \
  MINIO_ACCESS_KEY='access-key' \
  MINIO_SECRET_KEY='secret-key' \
  MINIO_BUCKET_LISTING_IMAGES='rooms_marketplace' \
  MAX_IMAGE_UPLOAD_MB='5'
```

If you rotate any of those values later, redeploy or roll over the App so new
containers start with the updated secret values.

## Database Migrations

Do not run Alembic migrations automatically from FastAPI startup. This
repository keeps migrations as an intentional step.

Local or direct migration from the backend directory:

```bash
cd backend
alembic upgrade head
```

Remote migration through Modal using the same production secret:

```bash
modal run modal_app.py::run_migrations
```

Run one of those before deploying a schema change that requires new tables or
columns.

## Deploy

From the repository root:

```bash
modal deploy modal_app.py
```

The deploy output includes the created `fastapi_app` HTTPS URL. You can also
inspect the deployment in the Modal dashboard or list Apps from the CLI:

```bash
modal app list
```

## Smoke Tests

Check liveness:

```bash
curl https://<modal-endpoint>/health
```

Expected response:

```json
{"status":"ok"}
```

Check readiness:

```bash
curl https://<modal-endpoint>/ready
```

Expected success shape:

```json
{"status":"ok","checks":{"database":"ok","object_storage":"ok"}}
```

Check a public endpoint:

```bash
curl https://<modal-endpoint>/listings
```

Check an authenticated owner route with a production Keycloak access token:

```bash
curl -X POST https://<modal-endpoint>/listings \
  -H "Authorization: Bearer <access-token>" \
  -H "Content-Type: application/json" \
  -d '{"category_id":"<uuid>","title":"Room near UCT","price":"0.00","currency":"ZAR","status":"draft"}'
```

## Logs, Updates, and Stop

Stream logs:

```bash
modal app logs rooms-marketplace-api -f
```

List deployments and recently stopped Apps:

```bash
modal app list
```

Update an existing deployment:

```bash
modal deploy modal_app.py
```

Stop the deployed App permanently:

```bash
modal app stop rooms-marketplace-api
```

Stopping is destructive. Deploy the same source again if you want the App back.

## Troubleshooting

If `modal deploy modal_app.py` fails during settings initialization, inspect the
secret values first. Non-local deploys now fail fast when `FRONTEND_ORIGIN`,
`DATABASE_URL`, `KEYCLOAK_ISSUER`, `KEYCLOAK_JWKS_URL`, `MINIO_ENDPOINT`, or
`MINIO_PUBLIC_URL` still point at local-only hosts.

If `/ready` returns a database error, verify the production PostgreSQL host,
credentials, firewall rules, and SSL requirements in `DATABASE_URL`.

If `/ready` returns an object-storage error, verify the bucket exists, the
access key can read it, and `MINIO_PUBLIC_URL` points at the URL the frontend
can actually load.

If browser requests fail with CORS in production, confirm `FRONTEND_ORIGIN`
matches the deployed frontend origin exactly, including scheme.

If authenticated routes return `401`, confirm the production token's issuer and
authorized party match `KEYCLOAK_ISSUER` and `KEYCLOAK_AUTHORIZED_PARTY`, and
that `KEYCLOAK_JWKS_URL` is publicly reachable from Modal.
