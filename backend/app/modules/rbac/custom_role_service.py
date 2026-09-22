"""Custom Role Service — Phase 13 Multi-Tenant

- Allows org_admin to create custom roles per organization
- Roles have organization_id set, is_system=False
- Permissions from ALL_PERMISSIONS
"""

from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core import permissions as perm
from app.core.errors import ConflictError, ForbiddenError, NotFoundError, ValidationError
from app.core.tenant import current_context
from app.modules.rbac.models import Role, RolePermission
from app.modules.rbac.repository import PermissionRepository, RoleRepository


class CustomRoleService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session
        self.roles = RoleRepository(session)
        self.permissions = PermissionRepository(session)

    async def _ensure_admin(self, organization_id: int):
        ctx = current_context()
        if not ctx.has_permission(perm.ROLE_MANAGE) and not ctx.is_super_admin:
            raise ForbiddenError("شما مجوز مدیریت نقش‌ها را ندارید")
        # Also ensure org visible (membership)
        if not ctx.is_super_admin:
            from app.modules.organizations.repository import MembershipRepository

            mem_repo = MembershipRepository(self.session)
            mem = await mem_repo.get_membership(ctx.user_id, organization_id)
            if mem is None:
                raise NotFoundError("سازمان یافت نشد")
        return ctx

    async def list_roles(self, organization_id: int):
        """List system roles + custom roles for org"""
        await self._ensure_admin(organization_id)
        # System roles (org_id None)
        stmt_sys = select(Role).where(Role.organization_id == None, Role.is_deleted == False)  # noqa: E711
        sys_roles = (await self.session.execute(stmt_sys)).scalars().all()

        # Custom roles for org
        stmt_custom = select(Role).where(Role.organization_id == organization_id, Role.is_deleted == False)  # noqa: E711
        custom_roles = (await self.session.execute(stmt_custom)).scalars().all()

        return list(sys_roles) + list(custom_roles)

    async def get_role(self, organization_id: int, role_id: int) -> Role:
        await self._ensure_admin(organization_id)
        role = await self.roles.get(role_id)
        if role is None:
            raise NotFoundError("نقش یافت نشد")
        # Check org match: system role has org_id None, custom must match
        if role.organization_id is not None and role.organization_id != organization_id:
            raise NotFoundError("نقش یافت نشد")
        return role

    async def create_role(self, organization_id: int, *, code: str, title: str, permission_codes: list[str]) -> Role:
        await self._ensure_admin(organization_id)

        code = code.strip().lower()
        if not code or len(code) < 2:
            raise ValidationError("کد نقش نامعتبر است")
        if code in perm.SYSTEM_ROLE_PERMISSIONS:
            raise ConflictError("کد نقش سیستمی است و قابل استفاده نیست")

        # Check duplicate in org
        existing = await self.roles.get_by_code(code, organization_id=organization_id)
        if existing:
            raise ConflictError("این کد نقش قبلاً استفاده شده", code="ROLE_CODE_TAKEN")

        # Validate permissions
        for pc in permission_codes:
            if pc not in perm.ALL_PERMISSIONS:
                raise ValidationError(f"مجوز نامعتبر: {pc}")

        # Ensure permission catalogue exists
        from app.modules.rbac.service import RbacService

        rbac = RbacService(self.session)
        catalogue = await rbac.ensure_permission_catalogue()

        role = Role(
            organization_id=organization_id,
            code=code,
            title=title,
            is_system=False,
        )
        self.session.add(role)
        await self.session.flush()

        for pc in permission_codes:
            rp = RolePermission(role_id=role.id, permission_id=catalogue[pc].id)
            self.session.add(rp)

        await self.session.flush()
        await self.session.refresh(role)
        return role

    async def update_role(
        self, organization_id: int, role_id: int, *, title: str | None = None, permission_codes: list[str] | None = None
    ) -> Role:
        await self._ensure_admin(organization_id)
        role = await self.roles.get(role_id)
        if role is None:
            raise NotFoundError("نقش یافت نشد")
        if role.is_system:
            raise ForbiddenError("نقش‌های سیستمی قابل ویرایش نیستند")
        if role.organization_id != organization_id:
            raise NotFoundError("نقش یافت نشد")

        if title is not None:
            role.title = title

        if permission_codes is not None:
            for pc in permission_codes:
                if pc not in perm.ALL_PERMISSIONS:
                    raise ValidationError(f"مجوز نامعتبر: {pc}")

            # Delete existing permissions
            from sqlalchemy import delete

            await self.session.execute(delete(RolePermission).where(RolePermission.role_id == role.id))

            from app.modules.rbac.service import RbacService

            rbac = RbacService(self.session)
            catalogue = await rbac.ensure_permission_catalogue()

            for pc in permission_codes:
                rp = RolePermission(role_id=role.id, permission_id=catalogue[pc].id)
                self.session.add(rp)

        await self.session.flush()
        await self.session.refresh(role)
        return role

    async def delete_role(self, organization_id: int, role_id: int) -> Role:
        await self._ensure_admin(organization_id)
        role = await self.roles.get(role_id)
        if role is None:
            raise NotFoundError("نقش یافت نشد")
        if role.is_system:
            raise ForbiddenError("نقش‌های سیستمی قابل حذف نیستند")
        if role.organization_id != organization_id:
            raise NotFoundError("نقش یافت نشد")

        # Check if role is assigned to users — forbid delete if assigned?
        # For simplicity, allow soft delete, existing assignments will remain but role is deleted
        await self.roles.soft_delete(role)
        await self.session.flush()
        return role

    async def get_role_permissions(self, role_id: int) -> set[str]:
        from app.modules.rbac.repository import UserRoleRepository

        repo = UserRoleRepository(self.session)
        return await repo.permissions_for_role(role_id)
