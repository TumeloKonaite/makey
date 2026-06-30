from pathlib import Path

import pytest


def pytest_sessionstart(session: pytest.Session) -> None:
    _ = session
    backend_root = Path(__file__).resolve().parents[1]

    try:
        import app
    except ImportError as exc:
        raise pytest.UsageError(
            "The marketplace backend package could not be imported. "
            "Activate backend/.venv and run pytest from the backend directory."
        ) from exc

    app_path = Path(app.__file__).resolve()
    if backend_root not in app_path.parents:
        raise pytest.UsageError(
            "The imported 'app' package is not coming from this repository. "
            "Activate backend/.venv and run pytest from the backend directory."
        )
