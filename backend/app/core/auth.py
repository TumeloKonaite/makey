from __future__ import annotations

from collections.abc import Callable
from typing import Any

from clerk_backend_api import Clerk
from clerk_backend_api.security.types import AuthenticateRequestOptions
from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.core.config import Settings, get_settings
from app.core.security import CurrentUser

http_bearer = HTTPBearer(auto_error=False)


def _auth_error(message: str) -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail=message,
        headers={"WWW-Authenticate": "Bearer"},
    )


def _required_secret(settings: Settings) -> str:
    secret = settings.clerk_secret_key.strip()
    if not secret:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="CLERK_SECRET_KEY is not configured.",
        )
    return secret


def _authenticate_request(request: Request, settings: Settings) -> dict[str, Any]:
    try:
        state = Clerk(bearer_auth=_required_secret(settings)).authenticate_request(
            request,
            AuthenticateRequestOptions(
                authorized_parties=settings.clerk_authorized_party_list,
                accepts_token=["session_token"],
            ),
        )
    except HTTPException:
        raise
    except Exception as exc:
        raise _auth_error("Clerk session token validation failed.") from exc

    if not state.is_signed_in or not state.payload:
        raise _auth_error("Clerk session token is invalid or expired.")
    return dict(state.payload)


def _canonical_role(value: object) -> str:
    # Only the exact, verified Clerk session claim can grant administrator access.
    return "admin" if value == "admin" else "renter"


def _user_from_payload(payload: dict[str, Any]) -> CurrentUser:
    subject = payload.get("sub")
    if not isinstance(subject, str) or not subject:
        raise _auth_error("Clerk session token is missing its subject.")

    username = payload.get("username") or payload.get("preferred_username") or payload.get("name")
    return CurrentUser(
        sub=subject,
        email=payload.get("email") if isinstance(payload.get("email"), str) else None,
        username=username if isinstance(username, str) else None,
        role=_canonical_role(payload.get("role")),
    )


def get_current_user(
    request: Request,
    credentials: HTTPAuthorizationCredentials | None = Depends(http_bearer),
    settings: Settings = Depends(get_settings),
) -> CurrentUser:
    if credentials is None or not credentials.credentials:
        raise _auth_error("Authorization header is required.")

    user = _user_from_payload(_authenticate_request(request, settings))
    request.state.user = user
    return user


def get_optional_current_user(
    request: Request,
    credentials: HTTPAuthorizationCredentials | None = Depends(http_bearer),
    settings: Settings = Depends(get_settings),
) -> CurrentUser | None:
    if credentials is None or not credentials.credentials:
        return None

    user = _user_from_payload(_authenticate_request(request, settings))
    request.state.user = user
    return user


def require_role(role: str) -> Callable[..., CurrentUser]:
    def dependency(
        request: Request,
        current_user: CurrentUser = Depends(get_current_user),
    ) -> CurrentUser:
        if current_user.role != role:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"You need the {role} role for this action.",
            )
        request.state.user = current_user
        return current_user

    return dependency
