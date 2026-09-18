from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import (
    Pagination,
    fingerprint,
    get_context,
    get_tenant_context,
    idempotency_key,
    pagination,
    require_permission,
)
from app.core import permissions as perm
from app.core.idempotency import run_idempotent
from app.core.responses import ok, page_meta
from app.core.tenant import TenantContext
from app.db.session import get_db
from app.modules.organizations.schemas import (
    BranchCreate,
    BranchOut,
    OrganizationCreate,
    OrganizationOut,
    OrganizationUpdate,
)
from app.modules.organizations.service import OrganizationService

router = APIRouter(prefix="/organizations", tags=["organizations"])


@router.get("")
async def list_my_organizations(
    ctx: TenantContext = Depends(get_context), session: AsyncSession = Depends(get_db)
) -> dict:
    organizations = await OrganizationService(session).list_mine()
    data = [OrganizationOut.model_validate(o).model_dump() for o in organizations]
    return ok(data, page_meta(total=len(data), limit=len(data) or 1, offset=0))


@router.post("", status_code=201)
async def create_organization(
    payload: OrganizationCreate,
    ctx: TenantContext = Depends(get_context),
    session: AsyncSession = Depends(get_db),
    key: str | None = Depends(idempotency_key),
) -> dict:
    """Creator becomes owner + organization_admin, and a MAIN branch is provisioned."""
    service = OrganizationService(session)

    async def _handler():
        organization = await service.create(payload)
        return OrganizationOut.model_validate(organization).model_dump()

    data = await run_idempotent(
        session,
        key=key,
        endpoint="POST /organizations",
        request_fingerprint=fingerprint(payload.model_dump()),
        handler=_handler,
    )
    return ok(data)


@router.get("/{organization_id}")
async def get_organization(
    organization_id: int,
    ctx: TenantContext = Depends(get_context),
    session: AsyncSession = Depends(get_db),
) -> dict:
    organization = await OrganizationService(session).get_visible(organization_id)
    return ok(OrganizationOut.model_validate(organization).model_dump())


@router.patch("/{organization_id}")
async def update_organization(
    organization_id: int,
    payload: OrganizationUpdate,
    ctx: TenantContext = Depends(require_permission(perm.ORG_UPDATE)),
    session: AsyncSession = Depends(get_db),
) -> dict:
    organization = await OrganizationService(session).update(organization_id, payload)
    return ok(OrganizationOut.model_validate(organization).model_dump())


@router.get("/current/branches")
async def list_branches(
    page: Pagination = Depends(pagination),
    ctx: TenantContext = Depends(require_permission(perm.BRANCH_READ)),
    session: AsyncSession = Depends(get_db),
) -> dict:
    rows, total = await OrganizationService(session).list_branches(limit=page.limit, offset=page.offset)
    return ok(
        [BranchOut.model_validate(b).model_dump() for b in rows],
        page_meta(total=total, limit=page.limit, offset=page.offset),
    )


@router.post("/current/branches", status_code=201)
async def create_branch(
    payload: BranchCreate,
    ctx: TenantContext = Depends(require_permission(perm.BRANCH_MANAGE)),
    session: AsyncSession = Depends(get_db),
    key: str | None = Depends(idempotency_key),
) -> dict:
    service = OrganizationService(session)

    async def _handler():
        branch = await service.create_branch(payload)
        return BranchOut.model_validate(branch).model_dump()

    data = await run_idempotent(
        session,
        key=key,
        endpoint="POST /organizations/current/branches",
        request_fingerprint=fingerprint(payload.model_dump()),
        handler=_handler,
    )
    return ok(data)
