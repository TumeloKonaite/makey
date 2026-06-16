from __future__ import annotations

from collections.abc import Callable
from functools import lru_cache
from typing import Any

import httpx
from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwk, jwt
from jose.exceptions import ExpiredSignatureError, JWKError, JWTClaimsError

from app.core.config import Settings, get_settings
from app.core.security import CurrentUser

http_bearer = HTTPBearer(auto_error=False)


def _auth_error(message: str) -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail=message,
        headers={"WWW-Authenticate": "Bearer"},
    )


def _get_required_setting(name: str, value: str | None) -> str:
    configured_value = (value or "").strip()
    if not configured_value:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"{name} is not configured.",
        )
    return configured_value


@lru_cache(maxsize=4)
def _fetch_jwks(jwks_url: str) -> dict[str, Any]:
    try:
        response = httpx.get(jwks_url, timeout=5.0)
        response.raise_for_status()
        return response.json()
    except (httpx.HTTPError, ValueError) as exc:
        raise _auth_error("Token signing keys could not be resolved.") from exc


def _get_signing_key(token: str, settings: Settings) -> dict[str, Any]:
    jwks_url = _get_required_setting("KEYCLOAK_JWKS_URL", settings.keycloak_jwks_url)

    try:
        unverified_header = jwt.get_unverified_header(token)
    except JWTError as exc:
        raise _auth_error("Token header is invalid.") from exc

    key_id = unverified_header.get("kid")
    if not key_id:
        raise _auth_error("Token header is missing a signing key identifier.")

    jwks = _fetch_jwks(jwks_url)
    for key in jwks.get("keys", []):
        if key.get("kid") == key_id:
            try:
                jwk.construct(key)
            except JWKError as exc:
                raise _auth_error("Token signing key is invalid.") from exc
            return key

    _fetch_jwks.cache_clear()
    jwks = _fetch_jwks(jwks_url)
    for key in jwks.get("keys", []):
        if key.get("kid") == key_id:
            try:
                jwk.construct(key)
            except JWKError as exc:
                raise _auth_error("Token signing key is invalid.") from exc
            return key

    raise _auth_error("Token signing key could not be resolved.")


def _extract_roles(payload: dict[str, Any], client_id: str) -> list[str]:
    roles: set[str] = set(payload.get("realm_access", {}).get("roles") or [])
    resource_access = payload.get("resource_access") or {}
    client_access = resource_access.get(client_id) or {}
    roles.update(client_access.get("roles") or [])
    return sorted(roles)


def _validate_authorized_party(payload: dict[str, Any], authorized_party: str) -> None:
    if payload.get("azp") == authorized_party:
        return

    raise _auth_error("Token authorized party is invalid.")


def _decode_and_validate_token(token: str, settings: Settings) -> dict[str, Any]:
    issuer = _get_required_setting("KEYCLOAK_ISSUER", settings.keycloak_issuer)
    authorized_party = _get_required_setting(
        "KEYCLOAK_AUTHORIZED_PARTY",
        settings.keycloak_authorized_party,
    )

    try:
        payload = jwt.decode(
            token,
            _get_signing_key(token, settings),
            algorithms=["RS256", "RS384", "RS512"],
            issuer=issuer,
            options={
                "verify_aud": False,
                "require_exp": True,
                "require_sub": True,
            },
        )
        _validate_authorized_party(payload, authorized_party)
        return payload
    except ExpiredSignatureError as exc:
        raise _auth_error("Token has expired.") from exc
    except JWTClaimsError as exc:
        raise _auth_error("Token claims are invalid.") from exc
    except HTTPException:
        raise
    except JWTError as exc:
        raise _auth_error("Token validation failed.") from exc


def get_current_user(
    request: Request,
    credentials: HTTPAuthorizationCredentials | None = Depends(http_bearer),
    settings: Settings = Depends(get_settings),
) -> CurrentUser:
    if credentials is None or not credentials.credentials:
        raise _auth_error("Authorization header is required.")

    payload = _decode_and_validate_token(credentials.credentials, settings)
    user = CurrentUser(
        sub=payload["sub"],
        email=payload.get("email"),
        username=payload.get("preferred_username"),
        roles=_extract_roles(payload, settings.keycloak_authorized_party),
    )
    request.state.user = user
    return user


def require_role(role: str) -> Callable[..., CurrentUser]:
    def dependency(
        request: Request,
        current_user: CurrentUser = Depends(get_current_user),
    ) -> CurrentUser:
        if role not in set(current_user.roles):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You do not have the required role for this action.",
            )
        request.state.user = current_user
        return current_user

    return dependency
