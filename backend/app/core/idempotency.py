"""Idempotent write helper: replays the first response for a repeated key.

Protects against double-tap, retry and timeout on mobile networks.
"""
from __future__ import annotations

import json
from collections.abc import Awaitable, Callable
from datetime import timedelta
from typing import Any

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import ConflictError
from app.core.tenant import get_context_or_none
from app.db.mixins import utcnow
from app.db.system_models import IdempotencyKey

IDEMPOTENCY_TTL = timedelta(hours=24)


async def run_idempotent(
    session: AsyncSession,
    *,
    key: str | None,
    endpoint: str,
    request_fingerprint: str,
    handler: Callable[[], Awaitable[Any]],
) -> Any:
    if not key:
        return await handler()

    ctx = get_context_or_none()
    organization_id = ctx.organization_id if ctx else None
    user_id = ctx.user_id if ctx else None

    stmt = select(IdempotencyKey).where(
        IdempotencyKey.organization_id == organization_id,
        IdempotencyKey.endpoint == endpoint,
        IdempotencyKey.key == key,
    )
    existing = (await session.execute(stmt)).scalars().first()
    if existing is not None:
        if existing.request_fingerprint != request_fingerprint:
            raise ConflictError(
                "این Idempotency-Key قبلاً با داده‌های دیگری استفاده شده است",
                code="IDEMPOTENCY_KEY_REUSED",
            )
        return json.loads(existing.response_body)

    result = await handler()
    body = result if isinstance(result, (dict, list)) else json.loads(result.model_dump_json())
    record = IdempotencyKey(
        organization_id=organization_id,
        user_id=user_id,
        endpoint=endpoint,
        key=key,
        request_fingerprint=request_fingerprint,
        status_code=200,
        response_body=json.dumps(body, ensure_ascii=False, default=str),
        expires_at=utcnow() + IDEMPOTENCY_TTL,
        created_by=user_id,
        updated_by=user_id,
    )
    session.add(record)
    try:
        await session.flush()
    except IntegrityError:
        # Concurrent identical request won the race; replay the stored response.
        await session.rollback()
        existing = (await session.execute(stmt)).scalars().first()
        if existing is not None:
            return json.loads(existing.response_body)
        raise
    return body
