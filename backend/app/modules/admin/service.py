"""Admin Service — Phase 13 Multi-Tenant Super Admin Dashboard

- Super admin only (is_super_admin)
- Uses BaseRepository (no tenant filter) + bypass RLS via get_db_public
"""

from __future__ import annotations

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import ForbiddenError, NotFoundError
from app.core.tenant import current_context
from app.modules.organizations.models import Branch, Organization, UserOrganization
from app.modules.organizations.repository import OrganizationRepository
from app.modules.users.models import User
from app.modules.users.repository import UserRepository


class AdminService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session
        self.orgs = OrganizationRepository(session)
        self.users = UserRepository(session)

    def _ensure_super_admin(self):
        ctx = current_context()
        if not ctx.is_super_admin:
            raise ForbiddenError("فقط سوپر ادمین")
        return ctx

    async def list_organizations(self, *, limit: int = 20, offset: int = 0, q: str | None = None):
        self._ensure_super_admin()
        stmt = select(Organization).where(Organization.is_deleted == False)  # noqa: E712
        if q:
            like = f"%{q}%"
            stmt = stmt.where((Organization.name.ilike(like)) | (Organization.slug.ilike(like)))
        total = (await self.session.execute(select(func.count()).select_from(stmt.subquery()))).scalar_one()
        stmt = stmt.order_by(Organization.id.desc()).limit(limit).offset(offset)
        rows = (await self.session.execute(stmt)).scalars().all()
        return list(rows), int(total)

    async def get_organization(self, org_id: int) -> Organization:
        self._ensure_super_admin()
        org = await self.orgs.get(org_id)
        if org is None:
            raise NotFoundError("سازمان یافت نشد")
        return org

    async def get_organization_stats(self, org_id: int) -> dict:
        self._ensure_super_admin()
        org = await self.orgs.get(org_id)
        if org is None:
            raise NotFoundError("سازمان یافت نشد")

        # Counts
        from app.modules.properties.models import Property
        from app.modules.crm.models import Person
        from app.modules.visits.models import Visit
        from app.modules.deals.models import Deal

        async def count_model(model):
            stmt = select(func.count()).select_from(model).where(
                model.organization_id == org_id, model.is_deleted == False  # noqa: E712
            )
            return (await self.session.execute(stmt)).scalar_one()

        members_stmt = select(func.count()).select_from(UserOrganization).where(
            UserOrganization.organization_id == org_id, UserOrganization.is_deleted == False  # noqa: E712
        )
        members_count = (await self.session.execute(members_stmt)).scalar_one()

        branches_stmt = select(func.count()).select_from(Branch).where(
            Branch.organization_id == org_id, Branch.is_deleted == False  # noqa: E712
        )
        branches_count = (await self.session.execute(branches_stmt)).scalar_one()

        props_count = await count_model(Property)
        persons_count = await count_model(Person)
        visits_count = await count_model(Visit)
        deals_count = await count_model(Deal)

        return {
            "organization_id": org_id,
            "name": org.name,
            "slug": org.slug,
            "members_count": int(members_count),
            "branches_count": int(branches_count),
            "properties_count": int(props_count),
            "persons_count": int(persons_count),
            "visits_count": int(visits_count),
            "deals_count": int(deals_count),
        }

    async def list_users(self, *, limit: int = 20, offset: int = 0, q: str | None = None):
        self._ensure_super_admin()
        stmt = select(User).where(User.is_deleted == False)  # noqa: E712
        if q:
            like = f"%{q}%"
            stmt = stmt.where((User.first_name.ilike(like)) | (User.phone.ilike(like)))
        total = (await self.session.execute(select(func.count()).select_from(stmt.subquery()))).scalar_one()
        stmt = stmt.order_by(User.id.desc()).limit(limit).offset(offset)
        rows = (await self.session.execute(stmt)).scalars().all()
        return list(rows), int(total)

    async def toggle_super_admin(self, user_id: int, *, is_super_admin: bool) -> User:
        self._ensure_super_admin()
        user = await self.users.get(user_id)
        if user is None:
            raise NotFoundError("کاربر یافت نشد")
        user.is_super_admin = is_super_admin
        user.permissions_version = (user.permissions_version or 1) + 1
        await self.session.flush()
        await self.session.refresh(user)
        return user

    async def global_stats(self) -> dict:
        self._ensure_super_admin()

        async def count_all(model):
            stmt = select(func.count()).select_from(model).where(model.is_deleted == False)  # noqa: E712
            return (await self.session.execute(stmt)).scalar_one()

        from app.modules.properties.models import Property
        from app.modules.crm.models import Person
        from app.modules.visits.models import Visit
        from app.modules.deals.models import Deal

        orgs = await count_all(Organization)
        users = await count_all(User)
        branches = await count_all(Branch)
        props = await count_all(Property)
        persons = await count_all(Person)
        visits = await count_all(Visit)
        deals = await count_all(Deal)

        return {
            "organizations": int(orgs),
            "users": int(users),
            "branches": int(branches),
            "properties": int(props),
            "persons": int(persons),
            "visits": int(visits),
            "deals": int(deals),
        }
