"""Shared FastAPI dependencies: auth context, permission guards, pagination, idempotency."""

from __future__ import annotations

import hashlib
import json
from collections.abc import AsyncGenerator
from dataclasses import dataclass

from fastapi import Depends, Header, Query, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.cache import get_cache, perm_cache_key
from app.core.config import settings
from app.core.errors import ForbiddenError, UnauthorizedError
from app.core.security import decode_access_token
from app.core.tenant import TenantContext, reset_context, set_context
from app.db.session import get_db
from app.modules.organizations.repository import MembershipRepository
from app.modules.rbac.service import RbacService
from app.modules.users.repository import UserRepository


async def get_bearer_token(authorization: str | None = Header(default=None)) -> str:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise UnauthorizedError()
    token = authorization.split(" ", 1)[1].strip()
    if not token:
        raise UnauthorizedError()
    return token


async def get_context(
    request: Request,
    token: str = Depends(get_bearer_token),
    session: AsyncSession = Depends(get_db),
) -> AsyncGenerator[TenantContext, None]:
    """Builds the request-scoped tenant context.

    Permissions are re-read from the database rather than trusted from the token;
    the token only carries the tenant selection and permissions_version.
    Phase 11: Redis cache for permissions (perms:{user}:{org}:{version}) with TTL 5min.
    """
    payload = decode_access_token(token)
    user_id = int(payload.get("user_id") or 0)
    user = await UserRepository(session).get(user_id)
    if user is None or not user.is_active:
        raise UnauthorizedError()
    if int(payload.get("permissions_version") or 0) != user.permissions_version:
        raise UnauthorizedError("دسترسی‌های شما تغییر کرده است. دوباره وارد شوید")

    organization_id = payload.get("organization_id")
    roles: list[str] = []
    permission_codes: set[str] = set()
    if organization_id is not None:
        organization_id = int(organization_id)
        if not user.is_super_admin:
            membership = await MembershipRepository(session).get_membership(user_id, organization_id)
            if membership is None:
                raise UnauthorizedError("عضویت شما در این سازمان فعال نیست")

        # Phase 11: try cache
        cache_hit = False
        try:
            cache = await get_cache()
            ckey = perm_cache_key(user_id, organization_id, user.permissions_version)
            cached = await cache.get(ckey)
            if cached and isinstance(cached, dict) and "roles" in cached and "permissions" in cached:
                roles = cached["roles"]
                permission_codes = set(cached["permissions"])
                cache_hit = True
        except Exception:
            cache_hit = False

        if not cache_hit:
            roles, permission_codes = await RbacService(session).resolve(user_id, organization_id)
            # Store in cache with 5min TTL
            try:
                cache = await get_cache()
                ckey = perm_cache_key(user_id, organization_id, user.permissions_version)
                await cache.set(ckey, {"roles": roles, "permissions": list(permission_codes)}, ttl=300)
            except Exception:
                pass

    ctx = TenantContext(
        user_id=user_id,
        organization_id=organization_id,
        branch_id=payload.get("branch_id"),
        roles=tuple(roles),
        permissions=frozenset(permission_codes),
        is_super_admin=user.is_super_admin,
        request_id=getattr(request.state, "request_id", None),
    )
    ctx_token = set_context(ctx)
    try:
        yield ctx
    finally:
        reset_context(ctx_token)


async def get_tenant_context(ctx: TenantContext = Depends(get_context)) -> TenantContext:
    """Same as get_context but an active organization is mandatory."""
    ctx.require_organization()
    return ctx


def require_permission(permission: str):
    async def _guard(ctx: TenantContext = Depends(get_tenant_context)) -> TenantContext:
        if not ctx.has_permission(permission):
            raise ForbiddenError()
        return ctx

    return _guard


@dataclass(frozen=True, slots=True)
class Pagination:
    limit: int
    offset: int
    cursor: str | None = None


async def pagination(
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    cursor: str | None = Query(default=None, description="Reserved for cursor pagination"),
) -> Pagination:
    return Pagination(limit=limit, offset=offset, cursor=cursor)


def fingerprint(payload: object) -> str:
    raw = json.dumps(payload, sort_keys=True, ensure_ascii=False, default=str)
    return hashlib.sha256(raw.encode()).hexdigest()


async def idempotency_key(
    idempotency_key: str | None = Header(default=None, alias="Idempotency-Key"),
) -> str | None:
    return idempotency_key.strip() if idempotency_key else None
