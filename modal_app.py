from __future__ import annotations

import subprocess
import sys
from pathlib import Path

import modal

APP_NAME = "rooms-marketplace-api"
SECRET_NAME = "rooms-marketplace-api-secrets"
REPO_ROOT = Path(__file__).resolve().parent
BACKEND_ROOT = REPO_ROOT / "backend"
REMOTE_BACKEND_ROOT = "/app/backend"

app = modal.App(APP_NAME)

image = (
    modal.Image.debian_slim(python_version="3.12")
    .pip_install_from_requirements("backend/requirements.txt")
    .workdir(REMOTE_BACKEND_ROOT)
    .env({"PYTHONPATH": REMOTE_BACKEND_ROOT})
    .add_local_dir("backend/app", remote_path=f"{REMOTE_BACKEND_ROOT}/app")
    .add_local_dir("backend/alembic", remote_path=f"{REMOTE_BACKEND_ROOT}/alembic")
    .add_local_file("backend/alembic.ini", remote_path=f"{REMOTE_BACKEND_ROOT}/alembic.ini")
)


def _backend_import_path() -> str:
    remote_backend_root = Path(REMOTE_BACKEND_ROOT)
    if remote_backend_root.exists():
        return str(remote_backend_root)
    return str(BACKEND_ROOT)


def load_fastapi_app():
    backend_import_path = _backend_import_path()
    if backend_import_path not in sys.path:
        sys.path.insert(0, backend_import_path)

    from app.main import app as api_app

    return api_app


@app.function(
    image=image,
    secrets=[modal.Secret.from_name(SECRET_NAME)],
    timeout=120,
)
@modal.asgi_app()
def fastapi_app():
    return load_fastapi_app()


@app.function(
    image=image,
    secrets=[modal.Secret.from_name(SECRET_NAME)],
    timeout=600,
)
def run_migrations() -> None:
    subprocess.run(
        ["alembic", "-c", "alembic.ini", "upgrade", "head"],
        check=True,
    )
