"""Organization/branch business logic, including membership-based access."""
from __future__ import annotations

from sqlalchemy.ext.asyncio import AsyncSession

from app.core import permissions as perm
from app.core.errors import ConflictError, ForbiddenError, NotFoundError
from app.core.tenant import current_context
from app.modules.organizations.models import Branch, Organization, UserBranch
from app.modules.organizations.repository import (
    BranchRepository,
    MembershipRepository,
    OrganizationRepository,
    UserBranchRepository,
)
from app.modules.organizations.schemas import (
    BranchCreate,
    OrganizationCreate,
    OrganizationUpdate,
)
from app.modules.rbac.service import RbacService


class OrganizationService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session
        self.organizations = OrganizationRepository(session)
        self.memberships = MembershipRepository(session)
        self.branches = BranchRepository(session)
        self.user_branches = UserBranchRepository(session)
        self.rbac = RbacService(session)

    async def create(self, payload: OrganizationCreate) -> Organization:
        ctx = current_context()
        if await self.organizations.slug_exists(payload.slug):
            raise ConflictError("این شناسه سازمان قبلاً استفاده شده است", code="SLUG_TAKEN")
        organization = await self.organizations.create(
            name=payload.name,
            slug=payload.slug,
            city_code=payload.city_code,
            phone=payload.phone,
        )
        await self.memberships.create(
            user_id=ctx.user_id, organization_id=organization.id, is_owner=True, is_active=True
        )
        await self.rbac.assign_role(
            user_id=ctx.user_id, organization_id=organization.id, role_code=perm.ORG_ADMIN
        )
        main_branch = Branch(
            organization_id=organization.id, name="دفتر مرکزی", code="MAIN", is_main=True,
            created_by=ctx.user_id, updated_by=ctx.user_id,
        )
        self.session.add(main_branch)
        await self.session.flush()
        self.session.add(
            UserBranch(
                user_id=ctx.user_id,
                organization_id=organization.id,
                branch_id=main_branch.id,
                is_default=True,
                created_by=ctx.user_id,
                updated_by=ctx.user_id,
            )
        )
        await self.session.flush()
        return organization

    async def list_mine(self) -> list[Organization]:
        ctx = current_context()
        return [o for o, _ in await self.organizations.list_for_user(ctx.user_id)]

    async def get_visible(self, organization_id: int) -> Organization:
        """Cross-tenant access returns 404, never 403 (no resource disclosure)."""
        ctx = current_context()
        organization = await self.organizations.get(organization_id)
        if organization is None:
            raise NotFoundError()
        if not ctx.is_super_admin:
            membership = await self.memberships.get_membership(ctx.user_id, organization_id)
            if membership is None:
                raise NotFoundError()
        return organization

    async def update(self, organization_id: int, payload: OrganizationUpdate) -> Organization:
        ctx = current_context()
        organization = await self.get_visible(organization_id)
        if not ctx.has_permission(perm.ORG_UPDATE):
            raise ForbiddenError()
        values = payload.model_dump(exclude_unset=True, exclude={"version"})
        values = {k: v for k, v in values.items() if v is not None}
        return await self.organizations.update(
            organization, expected_version=payload.version, **values
        )

    async def create_branch(self, payload: BranchCreate) -> Branch:
        ctx = current_context()
        if not ctx.has_permission(perm.BRANCH_MANAGE):
            raise ForbiddenError()
        duplicate = await self.branches.find_one_by(code=payload.code)
        if duplicate is not None:
            raise ConflictError("کد شعبه تکراری است", code="BRANCH_CODE_TAKEN")
        return await self.branches.create(
            name=payload.name, code=payload.code, address=payload.address, is_main=payload.is_main
        )

    async def list_branches(self, *, limit: int, offset: int):
        ctx = current_context()
        if not ctx.has_permission(perm.BRANCH_READ):
            raise ForbiddenError()
        return await self.branches.list(limit=limit, offset=offset, order_by="id")
