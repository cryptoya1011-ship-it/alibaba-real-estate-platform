from __future__ import annotations

from sqlalchemy import select

from app.modules.rbac.models import Permission, Role, RolePermission, UserRole
from app.repositories.base import BaseRepository


class RoleRepository(BaseRepository[Role]):
    model = Role

    async def get_by_code(self, code: str, organization_id: int | None = None) -> Role | None:
        stmt = (
            select(Role)
            .where(Role.code == code, Role.is_deleted.is_(False))
            .where(Role.organization_id == organization_id)
        )
        return (await self.session.execute(stmt)).scalars().first()


class PermissionRepository(BaseRepository[Permission]):
    model = Permission

    async def get_by_code(self, code: str) -> Permission | None:
        return await self.find_one_by(code=code)


class UserRoleRepository(BaseRepository[UserRole]):
    model = UserRole

    async def roles_for(self, user_id: int, organization_id: int) -> list[Role]:
        stmt = (
            select(Role)
            .join(UserRole, UserRole.role_id == Role.id)
            .where(
                UserRole.user_id == user_id,
                UserRole.organization_id == organization_id,
                UserRole.is_deleted.is_(False),
                Role.is_deleted.is_(False),
            )
        )
        return list((await self.session.execute(stmt)).scalars().all())

    async def permissions_for(self, user_id: int, organization_id: int) -> set[str]:
        stmt = (
            select(Permission.code)
            .join(RolePermission, RolePermission.permission_id == Permission.id)
            .join(Role, Role.id == RolePermission.role_id)
            .join(UserRole, UserRole.role_id == Role.id)
            .where(
                UserRole.user_id == user_id,
                UserRole.organization_id == organization_id,
                UserRole.is_deleted.is_(False),
                Role.is_deleted.is_(False),
                RolePermission.is_deleted.is_(False),
                Permission.is_deleted.is_(False),
            )
        )
        return set((await self.session.execute(stmt)).scalars().all())

    async def permissions_for_role(self, role_id: int) -> set[str]:
        stmt = (
            select(Permission.code)
            .join(RolePermission, RolePermission.permission_id == Permission.id)
            .where(
                RolePermission.role_id == role_id,
                RolePermission.is_deleted.is_(False),
                Permission.is_deleted.is_(False),
            )
        )
        return set((await self.session.execute(stmt)).scalars().all())
