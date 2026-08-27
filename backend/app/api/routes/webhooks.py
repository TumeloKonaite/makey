from __future__ import annotations

from typing import Any

from clerk_backend_api import Clerk
from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.orm import Session
from svix.webhooks import Webhook, WebhookVerificationError

from app.core.config import Settings, get_settings
from app.models import User
from app.repository.database.tables.session_manager import get_db

router = APIRouter()


def _primary_email(data: dict[str, Any]) -> str | None:
    primary_id = data.get("primary_email_address_id")
    addresses = data.get("email_addresses") or []
    primary = next((item for item in addresses if item.get("id") == primary_id), None)
    selected = primary or (addresses[0] if addresses else None)
    email = selected.get("email_address") if selected else None
    return email.lower() if isinstance(email, str) else None


def _display_name(data: dict[str, Any], email: str) -> str:
    full_name = " ".join(
        value.strip()
        for value in (data.get("first_name"), data.get("last_name"))
        if isinstance(value, str) and value.strip()
    )
    username = data.get("username")
    return full_name or (username if isinstance(username, str) and username else email)


def _sync_user(db: Session, data: dict[str, Any], settings: Settings) -> None:
    clerk_user_id = data.get("id")
    email = _primary_email(data)
    if not isinstance(clerk_user_id, str) or not clerk_user_id or not email:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Clerk user event is missing an ID or email address.",
        )

    metadata = data.get("public_metadata") or {}
    supplied_role = metadata.get("role")
    role = "admin" if supplied_role == "admin" else "renter"

    user = db.scalar(select(User).where(User.clerk_user_id == clerk_user_id).limit(1))
    if user is None:
        # Email matching links imported Clerk users to existing local UUIDs and listings.
        user = db.scalar(select(User).where(User.email == email).limit(1))
    if user is None:
        user = User(
            clerk_user_id=clerk_user_id,
            email=email,
            display_name=_display_name(data, email),
            role=role,
        )
        db.add(user)
    else:
        user.clerk_user_id = clerk_user_id
        user.email = email
        user.display_name = _display_name(data, email)
        user.role = role

    db.commit()

    if supplied_role not in {"admin", "renter"}:
        Clerk(bearer_auth=settings.clerk_secret_key).users.update_metadata(
            user_id=clerk_user_id,
            public_metadata={"role": "renter"},
        )


@router.post("/webhooks/clerk", status_code=status.HTTP_204_NO_CONTENT, tags=["webhooks"])
async def clerk_webhook(
    request: Request,
    db: Session = Depends(get_db),
    settings: Settings = Depends(get_settings),
) -> None:
    secret = settings.clerk_webhook_signing_secret.strip()
    if not secret:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="CLERK_WEBHOOK_SIGNING_SECRET is not configured.",
        )

    body = await request.body()
    try:
        event = Webhook(secret).verify(body, dict(request.headers))
    except WebhookVerificationError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid Clerk webhook signature.",
        ) from exc

    if event.get("type") in {"user.created", "user.updated"}:
        _sync_user(db, event["data"], settings)
