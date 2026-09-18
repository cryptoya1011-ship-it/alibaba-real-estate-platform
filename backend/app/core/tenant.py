"""Request-scoped, immutable tenant/actor context.

Nothing in the service or repository layer reads organization_id from user input;
it always comes from here, so a developer cannot "forget" the tenant filter.
"""
from __future__ import annotations

from contextvars import ContextVar, Token
from dataclasses import dataclass, field

from app.core.errors import TenantContextError, UnauthorizedError


@dataclass(frozen=True, slots=True)
class TenantContext:
    user_id: int
    organization_id: int | None = None
    branch_id: int | None = None
    roles: tuple[str, ...] = ()
    permissions: frozenset[str] = field(default_factory=frozenset)
    is_super_admin: bool = False
    request_id: str | None = None

    def require_organization(self) -> int:
        if self.organization_id is None:
            raise TenantContextError()
        return self.organization_id

    def has_permission(self, permission: str) -> bool:
        return self.is_super_admin or permission in self.permissions


_ctx: ContextVar[TenantContext | None] = ContextVar("arep_tenant_ctx", default=None)


def set_context(ctx: TenantContext) -> Token:
    return _ctx.set(ctx)


def reset_context(token: Token) -> None:
    _ctx.reset(token)


def get_context_or_none() -> TenantContext | None:
    return _ctx.get()


def current_context() -> TenantContext:
    ctx = _ctx.get()
    if ctx is None:
        raise UnauthorizedError()
    return ctx
