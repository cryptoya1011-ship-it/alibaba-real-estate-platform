"""Telegram Web App initData validation (HMAC-SHA256) and JWT issuing.

Telegram spec:
    secret_key    = HMAC_SHA256(key="WebAppData", msg=bot_token)
    expected_hash = HMAC_SHA256(key=secret_key, msg=data_check_string)
    data_check_string = "\\n".join(sorted("key=value" for all fields except hash))
"""
from __future__ import annotations

import hashlib
import hmac
import json
import time
from datetime import datetime, timedelta, timezone
from typing import Any
from urllib.parse import parse_qsl

import jwt

from app.core.config import settings
from app.core.errors import UnauthorizedError


def _data_check_string(pairs: list[tuple[str, str]]) -> str:
    return "\n".join(f"{k}={v}" for k, v in sorted(pairs, key=lambda kv: kv[0]))


def build_init_data(fields: dict[str, str], bot_token: str) -> str:
    """Test/helper utility: build a correctly signed initData string."""
    from urllib.parse import urlencode

    pairs = [(k, v) for k, v in fields.items() if k != "hash"]
    secret = hmac.new(b"WebAppData", bot_token.encode(), hashlib.sha256).digest()
    signature = hmac.new(
        secret, _data_check_string(pairs).encode(), hashlib.sha256
    ).hexdigest()
    return urlencode(pairs + [("hash", signature)])


def validate_init_data(
    init_data: str,
    bot_token: str | None = None,
    max_age_seconds: int | None = None,
) -> dict[str, Any]:
    """Return the parsed Telegram user dict, or raise UnauthorizedError."""
    bot_token = bot_token or settings.TELEGRAM_BOT_TOKEN
    if not bot_token:
        raise UnauthorizedError("سرور برای احراز هویت تلگرام تنظیم نشده است")
    if not init_data:
        raise UnauthorizedError("initData ارسال نشده است")

    pairs = parse_qsl(init_data, keep_blank_values=True)
    received_hash = next((v for k, v in pairs if k == "hash"), None)
    if not received_hash:
        raise UnauthorizedError("initData نامعتبر است")

    rest = [(k, v) for k, v in pairs if k != "hash"]
    secret = hmac.new(b"WebAppData", bot_token.encode(), hashlib.sha256).digest()
    expected = hmac.new(
        secret, _data_check_string(rest).encode(), hashlib.sha256
    ).hexdigest()
    if not hmac.compare_digest(expected, received_hash):
        raise UnauthorizedError("امضای initData نامعتبر است")

    data = dict(rest)
    max_age = (
        max_age_seconds
        if max_age_seconds is not None
        else settings.TELEGRAM_INITDATA_MAX_AGE
    )
    auth_date = data.get("auth_date")
    if max_age > 0:
        if not auth_date or not auth_date.isdigit():
            raise UnauthorizedError("initData نامعتبر است")
        if time.time() - int(auth_date) > max_age:
            raise UnauthorizedError("نشست تلگرام منقضی شده است. برنامه را دوباره باز کنید")

    raw_user = data.get("user")
    if not raw_user:
        raise UnauthorizedError("اطلاعات کاربر در initData موجود نیست")
    try:
        user = json.loads(raw_user)
    except json.JSONDecodeError as exc:
        raise UnauthorizedError("اطلاعات کاربر در initData نامعتبر است") from exc
    if not isinstance(user, dict) or not user.get("id"):
        raise UnauthorizedError("اطلاعات کاربر در initData نامعتبر است")
    return user


def create_access_token(
    *,
    user_id: int,
    session_id: str,
    permissions_version: int,
    organization_id: int | None = None,
    branch_id: int | None = None,
    roles: list[str] | None = None,
) -> tuple[str, datetime]:
    expires_at = datetime.now(timezone.utc) + timedelta(minutes=settings.JWT_TTL_MINUTES)
    payload = {
        "sub": str(user_id),
        "user_id": user_id,
        "organization_id": organization_id,
        "branch_id": branch_id,
        "roles": roles or [],
        "permissions_version": permissions_version,
        "session_id": session_id,
        "iat": int(datetime.now(timezone.utc).timestamp()),
        "exp": int(expires_at.timestamp()),
        "iss": settings.APP_CODE,
    }
    token = jwt.encode(payload, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)
    return token, expires_at


def decode_access_token(token: str) -> dict[str, Any]:
    try:
        return jwt.decode(
            token,
            settings.JWT_SECRET,
            algorithms=[settings.JWT_ALGORITHM],
            issuer=settings.APP_CODE,
        )
    except jwt.ExpiredSignatureError as exc:
        raise UnauthorizedError("توکن منقضی شده است") from exc
    except jwt.PyJWTError as exc:
        raise UnauthorizedError("توکن نامعتبر است") from exc
