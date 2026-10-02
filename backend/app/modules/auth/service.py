"""Authentication: Telegram proves identity; AREP decides tenant/roles/permissions."""
from __future__ import annotations

import asyncio
import hmac
import logging
import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.errors import ForbiddenError, NotFoundError, UnauthorizedError
from app.core.security import create_access_token, validate_init_data
from app.modules.auth.schemas import (
    OrganizationBrief,
    TokenResponse,
    UserBrief,
)
from app.modules.organizations.models import UserBranch
from app.modules.organizations.repository import (
    MembershipRepository,
    OrganizationRepository,
)
from app.modules.rbac.service import RbacService
from app.modules.users.models import User
from app.modules.users.repository import UserRepository

logger = logging.getLogger(__name__)

class AuthService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session
        self.users = UserRepository(session)
        self.organizations = OrganizationRepository(session)
        self.memberships = MembershipRepository(session)
        self.rbac = RbacService(session)

    # -- identity -------------------------------------------------------
    async def upsert_telegram_user(self, tg_user: dict) -> User:
        telegram_id = int(tg_user["id"])
        user = await self.users.get_by_telegram_id(telegram_id)
        payload = {
            "telegram_username": tg_user.get("username"),
            "first_name": tg_user.get("first_name"),
            "last_name": tg_user.get("last_name"),
            "language_code": tg_user.get("language_code") or "fa",
        }
        if user is None:
            return await self.users.create(telegram_id=telegram_id, **payload)
        changed = {k: v for k, v in payload.items() if v and getattr(user, k) != v}
        if changed:
            await self.users.update(user, **changed)
        if not user.is_active:
            raise ForbiddenError("حساب کاربری شما غیرفعال است")
        return user

    async def login_with_telegram(
        self, init_data: str, organization_id: int | None = None
    ) -> TokenResponse:
        tg_user = validate_init_data(init_data)
        user = await self.upsert_telegram_user(tg_user)
        return await self.issue_token(user, organization_id)

    async def dev_login(self, telegram_id: int, first_name: str | None, organization_id: int | None):
        if not settings.ALLOW_DEV_LOGIN or settings.is_production:
            raise UnauthorizedError("ورود آزمایشی غیرفعال است")
        user = await self.upsert_telegram_user({"id": telegram_id, "first_name": first_name or "Dev"})
        return await self.issue_token(user, organization_id)

    async def password_login(self, username: str, password: str, organization_id: int | None):
        """Temporary username/password login (ADR-0023). Constant-time comparison."""
        if not settings.PASSWORD_LOGIN_ENABLED:
            raise UnauthorizedError("ورود با رمز عبور غیرفعال است")
        user_ok = hmac.compare_digest(username.strip().encode(), (settings.LOGIN_USERNAME or "").encode())
        pass_ok = hmac.compare_digest(password.encode(), (settings.LOGIN_PASSWORD or "").encode())
        if not (user_ok and pass_ok):
            await asyncio.sleep(0.5)  # slow down guessing (auth routes are also rate-limited)
            logger.warning("password login failed")
            raise UnauthorizedError("نام کاربری یا رمز عبور اشتباه است")
        user = await self.users.get_by_telegram_id(int(settings.LOGIN_TELEGRAM_ID))
        if user is None:
            user = await self.users.create(telegram_id=int(settings.LOGIN_TELEGRAM_ID), first_name=username.strip(), language_code="fa")
        if not user.is_active:
            raise ForbiddenError("حساب کاربری شما غیرفعال است")
        return await self.issue_token(user, organization_id)

    # -- token ----------------------------------------------------------
    async def issue_token(
        self, user: User, organization_id: int | None = None, branch_id: int | None = None
    ) -> TokenResponse:
        rows = await self.organizations.list_for_user(user.id)
        orgs = [
            OrganizationBrief(id=o.id, name=o.name, slug=o.slug, is_owner=m.is_owner)
            for o, m in rows
        ]
        available_ids = {o.id for o in orgs}

        active_org: int | None = None
        if organization_id is not None:
            if organization_id not in available_ids and not user.is_super_admin:
                # Do not disclose whether the organization exists.
                raise NotFoundError()
            if organization_id not in available_ids and await self.organizations.get(organization_id) is None:
                # Super admins may enter any organization — but only one that exists
                # (a stale id from an old browser session must not create a ghost tenant).
                raise NotFoundError()
            active_org = organization_id
        elif len(orgs) == 1:
            active_org = orgs[0].id

        roles: list[str] = []
        permission_codes: set[str] = set()
        active_branch = branch_id
        if active_org is not None:
            roles, permission_codes = await self.rbac.resolve(user.id, active_org)
            if active_branch is None:
                # Auth runs before a tenant context exists, so filter explicitly here
                # instead of going through the tenant-scoped repository.
                stmt = (
                    select(UserBranch.branch_id)
                    .where(
                        UserBranch.user_id == user.id,
                        UserBranch.organization_id == active_org,
                        UserBranch.is_default.is_(True),
                        UserBranch.is_deleted.is_(False),
                    )
                    .limit(1)
                )
                active_branch = (await self.session.execute(stmt)).scalars().first()

        token, expires_at = create_access_token(
            user_id=user.id,
            session_id=str(uuid.uuid4()),
            permissions_version=user.permissions_version,
            organization_id=active_org,
            branch_id=active_branch,
            roles=roles,
            telegram_id=user.telegram_id,
        )
        return TokenResponse(
            access_token=token,
            expires_at=expires_at,
            user=UserBrief(
                id=user.id,
                telegram_id=user.telegram_id,
                display_name=user.display_name,
                is_super_admin=user.is_super_admin,
            ),
            organization_id=active_org,
            branch_id=active_branch,
            roles=roles,
            permissions=sorted(permission_codes),
            organizations=orgs,
        )
