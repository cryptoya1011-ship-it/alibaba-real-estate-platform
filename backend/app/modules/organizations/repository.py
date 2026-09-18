from __future__ import annotations

from sqlalchemy import func, select

from app.modules.organizations.models import (
    Branch,
    Organization,
    UserBranch,
    UserOrganization,
)
from app.repositories.base import BaseRepository, TenantRepository


class OrganizationRepository(BaseRepository[Organization]):
    """Organizations are the tenant root, so this repository is not tenant-filtered.
    Access control is enforced through membership checks in the service layer."""

    model = Organization

    async def list_for_user(self, user_id: int) -> list[tuple[Organization, UserOrganization]]:
        stmt = (
            select(Organization, UserOrganization)
            .join(UserOrganization, UserOrganization.organization_id == Organization.id)
            .where(
                UserOrganization.user_id == user_id,
                UserOrganization.is_active.is_(True),
                UserOrganization.is_deleted.is_(False),
                Organization.is_deleted.is_(False),
            )
            .order_by(Organization.id.asc())
        )
        return list((await self.session.execute(stmt)).all())

    async def slug_exists(self, slug: str) -> bool:
        stmt = select(func.count()).select_from(Organization).where(
            Organization.slug == slug, Organization.is_deleted.is_(False)
        )
        return bool((await self.session.execute(stmt)).scalar_one())


class MembershipRepository(BaseRepository[UserOrganization]):
    model = UserOrganization

    async def get_membership(self, user_id: int, organization_id: int) -> UserOrganization | None:
        return await self.find_one_by(
            user_id=user_id, organization_id=organization_id, is_active=True
        )


class BranchRepository(TenantRepository[Branch]):
    model = Branch


class UserBranchRepository(TenantRepository[UserBranch]):
    model = UserBranch
