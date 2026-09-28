"""Database helpers exposed lazily to keep metadata imports side-effect free."""

from typing import Any

__all__ = ["SessionLocal", "check_database_connection", "get_db"]


def __getattr__(name: str) -> Any:
    if name not in __all__:
        raise AttributeError(f"module {__name__!r} has no attribute {name!r}")

    from app.repository.database.tables import session_manager

    return getattr(session_manager, name)
