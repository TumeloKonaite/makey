# Production container deployment

The backend is a standard FastAPI/Uvicorn container. The image has no Modal
runtime dependency; `modal_app.py` remains only as the legacy Modal deployment
adapter until the Azure cutover is validated.

## Modal audit and replacement map

The current Modal entrypoint is `modal_app.py::fastapi_app`. It creates the
Modal App `rooms-marketplace-api` and wraps `app.main:app` with
`@modal.asgi_app()`. The image is Debian slim with Python 3.12, installs
`backend/requirements.txt`, sets `/app/backend` as its workdir and `PYTHONPATH`,
and mounts the backend application plus Alembic files into the image.

Both Modal functions use the single Modal Secret
`rooms-marketplace-api-secrets`. The complete secret inventory is:

- `APP_ENV`, `FRONTEND_ORIGIN`, and optional `FRONTEND_PREVIEW_ORIGIN_REGEX`
- `DATABASE_URL` and optional `MIGRATION_DATABASE_URL`
- `CLERK_SECRET_KEY`, `CLERK_WEBHOOK_SIGNING_SECRET`, and
  `CLERK_AUTHORIZED_PARTIES`
- `MINIO_ENDPOINT`, optional `MINIO_REGION`, `MINIO_PUBLIC_URL`,
  `MINIO_ACCESS_KEY`, `MINIO_SECRET_KEY`, `MINIO_BUCKET_LISTING_IMAGES`, and
  optional `MAX_IMAGE_UPLOAD_MB`

Modal injects those values at function runtime. No values are baked into its
image. `fastapi_app` has a 120-second function timeout. The separately invoked
`modal_app.py::run_migrations` function has a 600-second timeout and runs
`alembic upgrade head`.

| Current Modal dependency | Container-compatible replacement |
| --- | --- |
| `@modal.asgi_app()` web endpoint | `backend/start.sh` starts standard Uvicorn on `0.0.0.0:${PORT:-8000}` |
| `modal.Image.debian_slim()` and source mounts | `backend/Dockerfile` copies the application into `python:3.12-slim-bookworm` |
| `rooms-marketplace-api-secrets` | Runtime environment variables backed by Azure Container Apps secrets/references |
| `run_migrations` Modal function | One explicit pre-deployment command or dedicated one-replica migration job |
| Modal function timeout | Platform ingress/request timeout; long work must move to a worker |

There are no Modal Volumes, Dicts, Queues, scheduled functions, persistent
filesystem paths, mounts other than build-time source inclusion, proxy/static
networking settings, or permanent background loops. Modal is not imported by
anything under `backend/app` and is absent from the production requirements.

## Runtime contract

All settings are runtime-only; none are required while building the image.
Aliases from the Modal deployment remain accepted during migration.

| Variable | Required | Secret | Purpose and format |
| --- | --- | --- | --- |
| `ENVIRONMENT` | yes | no | `local`, `test`, `staging`, or `production`; legacy alias `APP_ENV` |
| `PORT` | no | no | Integer listener port, default `8000`; legacy settings alias `API_PORT` |
| `DATABASE_URL` | yes | yes | `postgresql+psycopg://user:URL_ENCODED_PASSWORD@host:5432/database?sslmode=verify-full` |
| `MIGRATION_DATABASE_URL` | no | yes | Direct/session-pooler URL used only by Alembic; falls back to `DATABASE_URL` |
| `CORS_ALLOWED_ORIGINS` | yes | no | Comma-separated exact frontend origins; legacy alias `FRONTEND_ORIGIN` |
| `FRONTEND_PREVIEW_ORIGIN_REGEX` | no | no | Anchored regex for intentionally allowed preview origins |
| `CLERK_SECRET_KEY` | yes | yes | Clerk backend secret key used by the Clerk SDK for token/JWKS validation |
| `CLERK_PUBLISHABLE_KEY` | no | no | Clerk instance identifier/reference; token validation does not require it |
| `CLERK_JWT_ISSUER` | no | no | Exact expected `iss` claim, such as `https://example.clerk.accounts.dev` |
| `CLERK_JWKS_URL` | no | no | Documented Clerk JWKS URL; the SDK discovers keys through `CLERK_SECRET_KEY` |
| `CLERK_JWT_AUDIENCE` | no | no | Comma-separated expected JWT audience values |
| `CLERK_AUTHORIZED_PARTIES` | yes | no | Comma-separated allowed `azp` origins; defaults to the CORS origin list |
| `CLERK_WEBHOOK_SECRET` | yes | yes | Svix `whsec_...` signature secret; legacy alias `CLERK_WEBHOOK_SIGNING_SECRET` |
| `OBJECT_STORAGE_ENDPOINT` | yes | no | HTTP(S) S3-compatible API URL; legacy alias `MINIO_ENDPOINT` |
| `OBJECT_STORAGE_BUCKET` | yes | no | Existing durable listing-image bucket name |
| `OBJECT_STORAGE_ACCESS_KEY` | yes | yes | S3 access-key ID |
| `OBJECT_STORAGE_SECRET_KEY` | yes | yes | S3 secret access key |
| `OBJECT_STORAGE_REGION` | provider-specific | no | S3 region name |
| `OBJECT_STORAGE_PUBLIC_URL` | yes | no | Public base URL before `/bucket/object`; legacy alias `MINIO_PUBLIC_URL` |

Pool tuning is available through `DATABASE_POOL_SIZE` (5),
`DATABASE_MAX_OVERFLOW` (5), `DATABASE_POOL_TIMEOUT` (10 seconds),
`DATABASE_POOL_RECYCLE` (1800 seconds), and `DATABASE_CONNECT_TIMEOUT` (5
seconds). Size these values so the maximum across all replicas stays below the
managed PostgreSQL connection limit.

Non-local configuration rejects the async/wrong SQLAlchemy driver, local-only
hosts, and TLS modes weaker than `verify-ca`. If `sslmode` is omitted,
`verify-full` is added to both application and Alembic URLs. Do not use
`sslmode=disable`, `allow`, `prefer`, or `require` in production. Install the
CA chain required by the managed database rather than bypassing verification.
Alembic reads the same settings through `backend/alembic/env.py`.

The image includes an explicit Azure PostgreSQL root bundle at
`/etc/ssl/certs/azure-postgresql-roots.pem`. It contains the two root CAs
currently required by Azure (DigiCert Global Root G2 and Microsoft RSA Root CA
2017), rather than pinning a rotating intermediate or server certificate. For
Azure, append
`&sslrootcert=/etc/ssl/certs/azure-postgresql-roots.pem` to both database URLs.

## Authentication, routes, and CORS

The Clerk Backend SDK verifies session tokens with `CLERK_SECRET_KEY`, the
configured authorized parties, optional audience, and optional exact issuer.
The role is read from the verified `role` claim; only the exact value `admin`
grants administrator access. The webhook is
`POST /webhooks/clerk`, verifies the raw body with `CLERK_WEBHOOK_SECRET`, and
handles `user.created` and `user.updated`.

Public routes are `GET /health`, `GET /ready`, OpenAPI/docs, `GET /categories`,
`GET /categories/{id}`, `GET /listings`, and `GET /listings/{id}`. `/me/*` and
all listing/image mutations require a valid admin session token. The Clerk
webhook is signature-protected rather than bearer-token protected.

CORS allows credentials only for explicitly configured origins (plus local
origins in local/test mode). It allows `Authorization` and `Content-Type` and
the API's `GET`, `POST`, `PATCH`, `DELETE`, and `OPTIONS` methods. Never use `*`
with credentialed requests.

## Health, migrations, jobs, and storage

`GET /health` is a constant-time process liveness response and performs no
network I/O. `GET /ready` checks PostgreSQL and the configured object-storage
bucket with short connection timeouts and returns HTTP 503 with sanitized
dependency names when either is unavailable.

Migrations never run in FastAPI startup. Run them explicitly once before a
deployment, preferably through a dedicated Azure Container Apps Job using the
same image:

```bash
docker run --rm --env-file backend/.env.local-container \
  rooms-marketplace-api:local alembic -c alembic.ini upgrade head
```

The only startup hook creates/configures the local MinIO bucket when
`ENVIRONMENT=local`; it does not run in production. There are no FastAPI
background tasks, queue consumers, schedules, or long-running worker loops.
The Clerk webhook and image operations remain bounded request operations. If
future CPU-heavy image processing, notifications, retries, or scheduled cleanup
is added, it belongs in a separate worker or Azure Container Apps Job.

Listing image bytes stream from FastAPI's short-lived upload spool directly to
S3-compatible object storage. Only object metadata and the public URL are
stored in PostgreSQL. No durable upload, cache, or generated file is written to
the container filesystem, so images survive API restart and are shared by all
replicas. The bucket must already exist in non-local environments; readiness
fails if its configuration or access is unavailable.

## Build and local production-image tests

From the repository root:

```bash
docker build -t rooms-marketplace-api:local ./backend
docker run --rm --name rooms-marketplace-api \
  --env-file ./backend/.env.local-container \
  -e PORT=8080 -p 8080:8080 rooms-marketplace-api:local
```

Use a local-only, uncommitted `.env.local-container`. With PostgreSQL and object
storage reachable from the container, verify:

```bash
curl -fsS http://localhost:8080/health
curl -fsS http://localhost:8080/ready
curl -fsS http://localhost:8080/docs >/dev/null
curl -fsS http://localhost:8080/listings
curl -i http://localhost:8080/me/listings
curl -i -X OPTIONS http://localhost:8080/me/listings \
  -H 'Origin: http://localhost:5173' \
  -H 'Access-Control-Request-Method: GET' \
  -H 'Access-Control-Request-Headers: authorization,content-type'
docker stop --timeout 10 rooms-marketplace-api
```

The protected request without a token must return 401. Repeat it with a valid
Clerk session token from the same Clerk instance and an admin role to confirm a
successful authenticated response. Restart the same image, retrieve an existing
listing image URL, and confirm that object storage—not the container—retained
the object. Inspect the effective PostgreSQL session with
`SHOW ssl`/`pg_stat_ssl` if independent server-side TLS evidence is required.

## Local verification evidence

Verified on 2026-09-17 with Docker Desktop 4.63.0 / Engine 29.2.1:

```text
docker build -t rooms-marketplace-api:local ./backend   PASS
image size                                               72,130,349 bytes
image user                                               app (UID/GID 10001)
image command                                            ["./start.sh"]
image stop signal                                        SIGTERM
Uvicorn listener                                         0.0.0.0:8765 (PORT respected)
GET /health                                              200 {"status":"ok"}
GET /openapi.json                                        200
GET /me/listings without token                           401
allowed-origin authenticated-route preflight             200
unconfigured-origin preflight                            400
GET /ready with unavailable test dependencies             503 in 3.31s
Modal import in production image                         absent
SIGTERM shutdown                                         graceful
same-image restart and GET /health                       200
```

The readiness response contained only the sanitized dependency labels
`Database dependency is unavailable.` and
`Object-storage dependency is unavailable.` No credentials or connection
details were returned. Live Clerk-token acceptance, PostgreSQL server-side TLS
inspection, and an end-to-end image upload require the corresponding external
test credentials and services; use the commands above in the target staging
environment rather than production credentials.
