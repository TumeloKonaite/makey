# Marketplace Rooms

Marketplace Rooms has a FastAPI backend in `backend/` and a TanStack Start
frontend in `RoomWise Marketplace/`. Authentication and user management use
Clerk. Guests and renters can browse published rooms; only admins can access
the dashboard or mutate listings and images. Enquiries are disabled.

## Clerk setup

Create separate Clerk applications for development and production. In each
Clerk Dashboard:

1. Add this session-token custom claim:

   ```json
   { "role": "{{user.public_metadata.role}}" }
   ```

2. Create a webhook endpoint at `<API origin>/webhooks/clerk` subscribed to
   `user.created` and `user.updated`.
3. Copy the publishable key, secret key, and webhook signing secret into the
   relevant environment.

The verified webhook sets missing or unknown roles to `renter`. Admin promotion
must be performed by a trusted operator in the Clerk Dashboard or Backend API;
the browser cannot write `publicMetadata`.

Frontend server environment:

```text
VITE_API_BASE_URL=http://localhost:8000
VITE_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...
CLERK_SIGN_IN_URL=/login
CLERK_SIGN_UP_URL=/sign-up
```

Backend environment:

```text
CLERK_SECRET_KEY=sk_test_...
CLERK_WEBHOOK_SIGNING_SECRET=whsec_...
CLERK_AUTHORIZED_PARTIES=http://localhost:5173,http://localhost:3000
```

Only `VITE_CLERK_PUBLISHABLE_KEY` is browser-visible. Never prefix the secret
key or webhook signing secret with `VITE_`.

## Local backend

```bash
cd backend
cp .env.example .env
python -m venv .venv
source .venv/bin/activate
pip install -r requirements-dev.txt
docker compose up -d postgres minio
alembic upgrade head
uvicorn app.main:app --reload --port 8000
```

Run tests from `backend/`:

```bash
pytest
```

## Local frontend

```bash
cd "RoomWise Marketplace"
cp .env.local.example .env
npm install
npm run dev
```

Quality checks:

```bash
npm run typecheck
npm run lint
npm run build
```

## Existing-user cutover

The database cutover is intentionally gated:

1. `alembic upgrade 20260827_0008` adds nullable `clerk_user_id`, converts all
   non-admin legacy roles to `renter`, and keeps local UUIDs and foreign keys.
2. Export/import users and reconcile the reviewed identity map.
3. Run `python -m scripts.reconcile_clerk_users mapping.csv` from `backend/`.
4. `alembic upgrade head` refuses to finalize if any user is unreconciled; on
   success it makes `clerk_user_id` non-null and removes the legacy provider ID.

See [docs/clerk-migration.md](docs/clerk-migration.md) for the full runbook and
[docs/deployment/modal.md](docs/deployment/modal.md) for backend deployment.

## Deployment

Deploy the frontend from `RoomWise Marketplace/`. For Vercel, leave the output
directory empty and use `npm run build`; TanStack Start/Nitro generates the
server output. Configure the Clerk development/preview or production keys in
the matching Vercel environment.

Deploy the Modal backend from the repository root:

```bash
modal run modal_app.py::run_migrations
modal deploy modal_app.py
```

## CI/CD

GitHub Actions runs backend tests plus frontend type-checking, linting, and a
production build for pull requests and pushes to `main`. After CI succeeds on
`main`, the CD workflow runs the production database migrations, deploys the
backend to Modal, and can also be started manually from the Actions tab. The
frontend is deployed separately by Vercel's Git integration when `main` is
updated.

Configure these secrets in the repository's `production` GitHub environment:

- `MODAL_TOKEN_ID`
- `MODAL_TOKEN_SECRET`

The Modal secret named `rooms-marketplace-api-secrets` and the frontend's Vercel
project environment variables must already be configured on their respective
platforms.
