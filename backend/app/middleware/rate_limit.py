"""Rate Limiting Middleware — Redis backed with in-memory fallback (Phase 11)

- Protects auth endpoints more strictly
- Returns 429 RATE_LIMITED with envelope
- Uses X-Forwarded-For or client IP
- Uses user_id if authenticated, else IP
"""

from __future__ import annotations

import time
from typing import Callable

from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware

from app.core.cache import get_cache
from app.core.config import settings
from app.core.logging import logger
from app.core.responses import fail
import json


# Limits: (requests, window_seconds)
DEFAULT_LIMIT = (100, 60)  # 100 req/min per user/IP
AUTH_LIMIT = (20, 60)  # 20 req/min for auth endpoints
PUBLIC_LIMIT = (200, 60)  # 200 req/min for public


def _get_client_id(request: Request) -> str:
    # Try user_id from context if available
    try:
        from app.core.tenant import get_context_or_none

        ctx = get_context_or_none()
        if ctx and ctx.user_id:
            return f"user:{ctx.user_id}"
    except Exception:
        pass

    # Fallback to IP
    xff = request.headers.get("X-Forwarded-For")
    if xff:
        ip = xff.split(",")[0].strip()
    else:
        ip = request.client.host if request.client else "unknown"
    return f"ip:{ip}"


def _get_limit_for_path(path: str) -> tuple[int, int]:
    if path.startswith("/api/v1/auth/"):
        return AUTH_LIMIT
    if path.startswith("/api/v1/public/"):
        return PUBLIC_LIMIT
    return DEFAULT_LIMIT


class RateLimitMiddleware(BaseHTTPMiddleware):
    def __init__(self, app, enabled: bool = True):
        super().__init__(app)
        self.enabled = enabled

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        if not self.enabled:
            return await call_next(request)

        # Skip health and docs
        if request.url.path in ("/", "/health", "/api/v1/health", "/docs", "/redoc", "/openapi.json"):
            return await call_next(request)

        # Skip if ENV is test
        if settings.ENV == "test":
            return await call_next(request)

        try:
            cache = await get_cache()
            client_id = _get_client_id(request)
            limit, window = _get_limit_for_path(request.url.path)
            key = f"rl:{client_id}:{request.url.path}"

            # Use incr with TTL
            count = await cache.incr(key, ttl=window)

            if count > limit:
                # Calculate retry after
                retry_after = window  # simplified
                logger.warning(f"rate limited {client_id} {request.url.path} count={count} limit={limit}")
                body = fail(
                    code="RATE_LIMITED",
                    message="درخواست‌ها بیش از حد مجاز است، لطفاً کمی صبر کنید",
                    details=[{"limit": limit, "window": window, "retry_after": retry_after}],
                )
                return Response(
                    content=json.dumps(body, ensure_ascii=False),
                    status_code=429,
                    media_type="application/json",
                    headers={"Retry-After": str(retry_after), "X-RateLimit-Limit": str(limit), "X-RateLimit-Remaining": "0"},
                )

            response = await call_next(request)
            # Add rate limit headers
            remaining = max(0, limit - count)
            response.headers["X-RateLimit-Limit"] = str(limit)
            response.headers["X-RateLimit-Remaining"] = str(remaining)
            return response

        except Exception as e:
            logger.warning(f"rate limit middleware error: {e}")
            # Fail open — don't block if cache fails
            return await call_next(request)
