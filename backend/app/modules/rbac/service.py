"""RBAC provisioning + permission resolution."""
from __future__ import annotations

from sqlalchemy.ext.asyncio import AsyncSession

from app.core import permissions as perm
from app.modules.rbac.models import Permission, Role, RolePermission, UserRole
from app.modules.rbac.repository import (
    PermissionRepository,
    RoleRepository,
    UserRoleRepository,
)


class RbacService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session
        self.permissions = PermissionRepository(session)
        self.roles = RoleRepository(session)
        self.user_roles = UserRoleRepository(session)

    async def ensure_permission_catalogue(self) -> dict[str, Permission]:
        existing = {p.code: p for p in (await self.permissions.list(limit=1000))[0]}
        for code in perm.ALL_PERMISSIONS:
            if code not in existing:
                existing[code] = await self.permissions.create(code=code, title=code)
        await self.session.flush()
        return existing

    async def ensure_system_roles(self) -> dict[str, Role]:
        catalogue = await self.ensure_permission_catalogue()
        roles: dict[str, Role] = {}
        for role_code, permission_codes in perm.SYSTEM_ROLE_PERMISSIONS.items():
            role = await self.roles.get_by_code(role_code, organization_id=None)
            if role is None:
                role = await self.roles.create(
                    organization_id=None, code=role_code, title=role_code, is_system=True
                )
            roles[role_code] = role
            current = await self.user_roles.permissions_for_role(role.id)
            for code in permission_codes:
                if code not in current:
                    self.session.add(
                        RolePermission(role_id=role.id, permission_id=catalogue[code].id)
                    )
        await self.session.flush()
        return roles

    async def assign_role(
        self, *, user_id: int, organization_id: int, role_code: str, branch_id: int | None = None
    ) -> UserRole:
        roles = await self.ensure_system_roles()
        role = roles.get(role_code) or await self.roles.get_by_code(role_code, organization_id)
        if role is None:
            role = await self.roles.get_by_code(role_code, organization_id=None)
        if role is None:
            raise ValueError(f"unknown role code: {role_code}")
        existing = await self.user_roles.find_one_by(
            user_id=user_id, organization_id=organization_id, role_id=role.id, branch_id=branch_id
        )
        if existing:
            return existing
        assignment = UserRole(
            user_id=user_id, organization_id=organization_id, role_id=role.id, branch_id=branch_id
        )
        self.session.add(assignment)
        await self.session.flush()
        return assignment

    async def resolve(self, user_id: int, organization_id: int) -> tuple[list[str], set[str]]:
        roles = await self.user_roles.roles_for(user_id, organization_id)
        codes = await self.user_roles.permissions_for(user_id, organization_id)
        return [r.code for r in roles], codes
