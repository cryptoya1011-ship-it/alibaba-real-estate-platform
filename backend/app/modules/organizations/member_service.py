"""Organization members: list, change roles/branches, suspend, remove.

Tables: user_organizations (membership), user_role_map (roles), user_branches.
Every change bumps the member's ``permissions_version`` so their existing tokens
stop working and the new permissions apply on the next request/login.
"""
from __future__ import annotations

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core import permissions as perm
from app.core.errors import ForbiddenError, NotFoundError, ValidationError
from app.core.tenant import current_context
from app.modules.organizations.models import Branch, UserBranch, UserOrganization
from app.modules.rbac.models import Role, UserRole
from app.modules.rbac.service import RbacService
from app.modules.users.models import User


class MemberService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    # -- helpers ----------------------------------------------------------
    def _org(self) -> int:
        return current_context().require_organization()

    async def _membership(self, user_id: int) -> tuple[UserOrganization, User]:
        stmt = (
            select(UserOrganization, User)
            .join(User, User.id == UserOrganization.user_id)
            .where(
                UserOrganization.organization_id == self._org(),
                UserOrganization.user_id == user_id,
                UserOrganization.is_deleted.is_(False),
            )
        )
        row = (await self.session.execute(stmt)).first()
        if row is None:
            raise NotFoundError("عضو یافت نشد")
        return row[0], row[1]

    def _guard_target(self, membership: UserOrganization) -> None:
        ctx = current_context()
        if membership.user_id == ctx.user_id:
            raise ForbiddenError("نمی‌توانید دسترسی یا عضویت خودتان را تغییر دهید")
        if membership.is_owner and not ctx.is_super_admin:
            raise ForbiddenError("مالک سازمان قابل تغییر نیست")

    async def _invalidate(self, user: User) -> None:
        user.permissions_version = (user.permissions_version or 1) + 1
        await self.session.flush()
        try:
            from app.core.cache import get_cache, perms_invalidate_key

            cache = await get_cache()
            await cache.delete_pattern(perms_invalidate_key(user.id, self._org()))
        except Exception:
            pass

    async def _roles_by_user(self, user_ids: list[int]) -> dict[int, list[Role]]:
        if not user_ids:
            return {}
        stmt = (
            select(UserRole.user_id, Role)
            .join(Role, Role.id == UserRole.role_id)
            .where(
                UserRole.organization_id == self._org(),
                UserRole.user_id.in_(user_ids),
                UserRole.is_deleted.is_(False),
                Role.is_deleted.is_(False),
            )
        )
        out: dict[int, list[Role]] = {}
        for uid, role in (await self.session.execute(stmt)).all():
            if all(r.id != role.id for r in out.setdefault(uid, [])):
                out[uid].append(role)
        return out

    async def _branches_by_user(self, user_ids: list[int]) -> dict[int, list[tuple[Branch, bool]]]:
        if not user_ids:
            return {}
        stmt = (
            select(UserBranch.user_id, Branch, UserBranch.is_default)
            .join(Branch, Branch.id == UserBranch.branch_id)
            .where(
                UserBranch.organization_id == self._org(),
                UserBranch.user_id.in_(user_ids),
                UserBranch.is_deleted.is_(False),
                Branch.is_deleted.is_(False),
            )
        )
        out: dict[int, list[tuple[Branch, bool]]] = {}
        for uid, branch, is_default in (await self.session.execute(stmt)).all():
            out.setdefault(uid, []).append((branch, bool(is_default)))
        return out

    async def _serialize(self, rows: list[tuple[UserOrganization, User]]) -> list[dict]:
        ids = [u.id for _, u in rows]
        roles = await self._roles_by_user(ids)
        branches = await self._branches_by_user(ids)
        return [
            {
                "user_id": u.id,
                "telegram_id": u.telegram_id,
                "telegram_username": u.telegram_username,
                "display_name": u.display_name,
                "phone": u.phone,
                "is_owner": m.is_owner,
                "is_active": m.is_active,
                "joined_at": m.created_at,
                "roles": [
                    {"id": r.id, "code": r.code, "title": r.title, "is_system": r.is_system}
                    for r in roles.get(u.id, [])
                ],
                "branches": [
                    {"id": b.id, "name": b.name, "code": b.code, "is_default": d}
                    for b, d in branches.get(u.id, [])
                ],
            }
            for m, u in rows
        ]

    # -- API --------------------------------------------------------------
    async def list(self) -> list[dict]:
        if not current_context().has_permission(perm.ORG_MEMBER_READ):
            raise ForbiddenError()
        stmt = (
            select(UserOrganization, User)
            .join(User, User.id == UserOrganization.user_id)
            .where(
                UserOrganization.organization_id == self._org(),
                UserOrganization.is_deleted.is_(False),
                User.is_deleted.is_(False),
            )
            .order_by(UserOrganization.is_owner.desc(), UserOrganization.id.asc())
        )
        rows = [(m, u) for m, u in (await self.session.execute(stmt)).all()]
        return await self._serialize(rows)

    async def get(self, user_id: int) -> dict:
        membership, user = await self._membership(user_id)
        return (await self._serialize([(membership, user)]))[0]

    async def set_roles(self, user_id: int, role_codes: list[str]) -> dict:
        if not current_context().has_permission(perm.ROLE_MANAGE):
            raise ForbiddenError()
        membership, user = await self._membership(user_id)
        self._guard_target(membership)
        codes = list(dict.fromkeys(c.strip() for c in role_codes if c.strip()))
        if not codes:
            raise ValidationError("حداقل یک نقش انتخاب کنید")

        org_id = self._org()
        rbac = RbacService(self.session)
        system = await rbac.ensure_system_roles()
        wanted: list[Role] = []
        for code in codes:
            role = system.get(code) or await rbac.roles.get_by_code(code, org_id)
            if role is None or (role.organization_id not in (None, org_id)):
                raise ValidationError(f"نقش «{code}» وجود ندارد")
            wanted.append(role)

        # Replace organization-level assignments. Hard delete: the unique
        # constraint on (user, org, role, branch) would reject re-adding a
        # soft-deleted row later.
        await self.session.execute(
            delete(UserRole).where(
                UserRole.user_id == user_id,
                UserRole.organization_id == org_id,
            )
        )
        for role in wanted:
            self.session.add(UserRole(user_id=user_id, organization_id=org_id, role_id=role.id, branch_id=None))
        await self.session.flush()
        await self._invalidate(user)
        return await self.get(user_id)

    async def set_branches(self, user_id: int, branch_ids: list[int], default_branch_id: int | None) -> dict:
        if not current_context().has_permission(perm.BRANCH_MANAGE):
            raise ForbiddenError()
        membership, user = await self._membership(user_id)
        if membership.user_id != current_context().user_id:
            self._guard_target(membership)
        org_id = self._org()
        ids = list(dict.fromkeys(branch_ids))
        if ids:
            found = (
                await self.session.execute(
                    select(Branch.id).where(
                        Branch.organization_id == org_id,
                        Branch.id.in_(ids),
                        Branch.is_deleted.is_(False),
                    )
                )
            ).scalars().all()
            if len(found) != len(ids):
                raise ValidationError("شعبه نامعتبر است")
        if default_branch_id is not None and default_branch_id not in ids:
            raise ValidationError("شعبه پیش‌فرض باید در فهرست شعب باشد")
        default_id = default_branch_id if default_branch_id is not None else (ids[0] if ids else None)

        await self.session.execute(
            delete(UserBranch).where(UserBranch.user_id == user_id, UserBranch.organization_id == org_id)
        )
        for bid in ids:
            self.session.add(
                UserBranch(user_id=user_id, organization_id=org_id, branch_id=bid, is_default=bid == default_id)
            )
        await self.session.flush()
        await self._invalidate(user)
        return await self.get(user_id)

    async def set_active(self, user_id: int, is_active: bool) -> dict:
        if not current_context().has_permission(perm.ORG_UPDATE):
            raise ForbiddenError()
        membership, user = await self._membership(user_id)
        self._guard_target(membership)
        membership.is_active = is_active
        await self.session.flush()
        await self._invalidate(user)
        return await self.get(user_id)

    async def remove(self, user_id: int) -> None:
        if not current_context().has_permission(perm.ORG_UPDATE):
            raise ForbiddenError()
        membership, user = await self._membership(user_id)
        self._guard_target(membership)
        org_id = self._org()
        await self.session.execute(
            delete(UserRole).where(UserRole.user_id == user_id, UserRole.organization_id == org_id)
        )
        await self.session.execute(
            delete(UserBranch).where(UserBranch.user_id == user_id, UserBranch.organization_id == org_id)
        )
        # Hard delete so a future invitation can re-create the membership
        # (unique constraint on user_id + organization_id).
        await self.session.delete(membership)
        await self.session.flush()
        await self._invalidate(user)
