"""Visits API — بند 38"""
from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_tenant_context, pagination, require_permission
from app.core import permissions as perm
from app.core.responses import ok, page_meta
from app.core.tenant import TenantContext
from app.db.session import get_db
from app.modules.visits.schemas import VisitCreate, VisitUpdate
from app.modules.visits.service import VisitService

router = APIRouter(prefix="/visits", tags=["visits"])


@router.post("", dependencies=[Depends(require_permission(perm.VISIT_CREATE))])
async def create_visit(
    payload: VisitCreate,
    ctx: TenantContext = Depends(get_tenant_context),
    session: AsyncSession = Depends(get_db),
) -> dict:
    service = VisitService(session)
    visit = await service.create(payload)
    return ok(
        {
            "id": visit.id,
            "property_id": visit.property_id,
            "customer_id": visit.customer_id,
            "agent_id": visit.agent_id,
            "visit_date": visit.visit_date,
            "visit_time": visit.visit_time,
            "status": visit.status,
            "version": visit.version,
        }
    )


@router.get("", dependencies=[Depends(require_permission(perm.VISIT_READ))])
async def list_visits(
    ctx: TenantContext = Depends(get_tenant_context),
    session: AsyncSession = Depends(get_db),
    pag: Any = Depends(pagination),
    property_id: int | None = Query(default=None),
    customer_id: int | None = Query(default=None),
    agent_id: int | None = Query(default=None),
    status: str | None = Query(default=None),
    date_from: str | None = Query(default=None, description="YYYY-MM-DD"),
    date_to: str | None = Query(default=None, description="YYYY-MM-DD"),
) -> dict:
    service = VisitService(session)
    items, total = await service.list(
        limit=pag.limit,
        offset=pag.offset,
        property_id=property_id,
        customer_id=customer_id,
        agent_id=agent_id,
        status=status,
        date_from=date_from,
        date_to=date_to,
    )
    data = [
        {
            "id": v.id,
            "property_id": v.property_id,
            "customer_id": v.customer_id,
            "agent_id": v.agent_id,
            "visit_date": v.visit_date,
            "visit_time": v.visit_time,
            "status": v.status,
            "notes": v.notes,
            "created_at": v.created_at,
        }
        for v in items
    ]
    return ok(data, page_meta(total=total, limit=pag.limit, offset=pag.offset))


@router.get("/{visit_id}", dependencies=[Depends(require_permission(perm.VISIT_READ))])
async def get_visit(
    visit_id: int,
    ctx: TenantContext = Depends(get_tenant_context),
    session: AsyncSession = Depends(get_db),
) -> dict:
    service = VisitService(session)
    v = await service.get_by_id(visit_id)
    return ok(
        {
            "id": v.id,
            "property_id": v.property_id,
            "customer_id": v.customer_id,
            "agent_id": v.agent_id,
            "visit_date": v.visit_date,
            "visit_time": v.visit_time,
            "status": v.status,
            "notes": v.notes,
            "follow_up_notes": v.follow_up_notes,
            "result": v.result,
            "version": v.version,
            "created_at": v.created_at,
        }
    )


@router.patch("/{visit_id}", dependencies=[Depends(require_permission(perm.VISIT_UPDATE))])
async def update_visit(
    visit_id: int,
    payload: VisitUpdate,
    ctx: TenantContext = Depends(get_tenant_context),
    session: AsyncSession = Depends(get_db),
) -> dict:
    service = VisitService(session)
    v = await service.update(visit_id, payload)
    return ok({"id": v.id, "status": v.status, "version": v.version})


@router.delete("/{visit_id}", dependencies=[Depends(require_permission(perm.VISIT_DELETE))])
async def delete_visit(
    visit_id: int,
    ctx: TenantContext = Depends(get_tenant_context),
    session: AsyncSession = Depends(get_db),
    version: int | None = Query(default=None),
) -> dict:
    service = VisitService(session)
    await service.soft_delete(visit_id, version=version)
    return ok({"id": visit_id, "deleted": True})
