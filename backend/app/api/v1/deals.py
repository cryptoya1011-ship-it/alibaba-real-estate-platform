"""Deals API — بند 39, 40"""
from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_tenant_context, pagination, require_permission
from app.core import permissions as perm
from app.core.responses import ok, page_meta
from app.core.tenant import TenantContext
from app.db.session import get_db
from app.modules.deals.schemas import DealCreate, DealUpdate
from app.modules.deals.service import DealService

router = APIRouter(prefix="/deals", tags=["deals"])


@router.post("", dependencies=[Depends(require_permission(perm.DEAL_CREATE))])
async def create_deal(
    payload: DealCreate,
    ctx: TenantContext = Depends(get_tenant_context),
    session: AsyncSession = Depends(get_db),
) -> dict:
    service = DealService(session)
    deal = await service.create(payload)
    return ok(
        {
            "id": deal.id,
            "code": deal.code,
            "title": deal.title,
            "status": deal.status,
            "customer_id": deal.customer_id,
            "property_id": deal.property_id,
            "agent_id": deal.agent_id,
            "amount": deal.amount,
            "version": deal.version,
        }
    )


@router.get("", dependencies=[Depends(require_permission(perm.DEAL_READ))])
async def list_deals(
    ctx: TenantContext = Depends(get_tenant_context),
    session: AsyncSession = Depends(get_db),
    pag: Any = Depends(pagination),
    status: str | None = Query(default=None, description="lead, qualification, ..."),
    customer_id: int | None = Query(default=None),
    property_id: int | None = Query(default=None),
    agent_id: int | None = Query(default=None),
    q: str | None = Query(default=None, description="Search in title, code"),
) -> dict:
    service = DealService(session)
    items, total = await service.list(
        limit=pag.limit,
        offset=pag.offset,
        status=status,
        customer_id=customer_id,
        property_id=property_id,
        agent_id=agent_id,
        q=q,
    )
    data = [
        {
            "id": d.id,
            "code": d.code,
            "title": d.title,
            "status": d.status,
            "customer_id": d.customer_id,
            "property_id": d.property_id,
            "agent_id": d.agent_id,
            "amount": d.amount,
            "commission_total": d.commission_total,
            "created_at": d.created_at,
        }
        for d in items
    ]
    return ok(data, page_meta(total=total, limit=pag.limit, offset=pag.offset))


@router.get("/by-code/{code}", dependencies=[Depends(require_permission(perm.DEAL_READ))])
async def get_deal_by_code(
    code: str,
    ctx: TenantContext = Depends(get_tenant_context),
    session: AsyncSession = Depends(get_db),
) -> dict:
    service = DealService(session)
    deal = await service.get_by_code(code)
    return ok(
        {
            "id": deal.id,
            "code": deal.code,
            "title": deal.title,
            "status": deal.status,
            "customer_id": deal.customer_id,
            "property_id": deal.property_id,
            "agent_id": deal.agent_id,
            "amount": deal.amount,
            "commission_total": deal.commission_total,
            "commission_agent_share": deal.commission_agent_share,
            "commission_office_share": deal.commission_office_share,
            "commission_referral_share": deal.commission_referral_share,
            "commission_status": deal.commission_status,
            "notes": deal.notes,
            "version": deal.version,
            "created_at": deal.created_at,
        }
    )


@router.get("/{deal_id}", dependencies=[Depends(require_permission(perm.DEAL_READ))])
async def get_deal(
    deal_id: int,
    ctx: TenantContext = Depends(get_tenant_context),
    session: AsyncSession = Depends(get_db),
) -> dict:
    service = DealService(session)
    deal = await service.get_by_id(deal_id)
    return ok(
        {
            "id": deal.id,
            "code": deal.code,
            "title": deal.title,
            "description": deal.description,
            "status": deal.status,
            "customer_id": deal.customer_id,
            "property_id": deal.property_id,
            "agent_id": deal.agent_id,
            "amount": deal.amount,
            "commission_total": deal.commission_total,
            "commission_agent_share": deal.commission_agent_share,
            "commission_office_share": deal.commission_office_share,
            "commission_referral_share": deal.commission_referral_share,
            "commission_status": deal.commission_status,
            "notes": deal.notes,
            "loss_reason": deal.loss_reason,
            "version": deal.version,
            "created_at": deal.created_at,
            "updated_at": deal.updated_at,
        }
    )


@router.get("/{deal_id}/history", dependencies=[Depends(require_permission(perm.DEAL_READ))])
async def get_deal_history(
    deal_id: int,
    ctx: TenantContext = Depends(get_tenant_context),
    session: AsyncSession = Depends(get_db),
) -> dict:
    service = DealService(session)
    history = await service.get_history(deal_id)
    data = [
        {
            "id": h.id,
            "from_status": h.from_status,
            "to_status": h.to_status,
            "changed_by": h.changed_by,
            "notes": h.notes,
            "created_at": h.created_at,
        }
        for h in history
    ]
    return ok(data)


@router.patch("/{deal_id}", dependencies=[Depends(require_permission(perm.DEAL_UPDATE))])
async def update_deal(
    deal_id: int,
    payload: DealUpdate,
    ctx: TenantContext = Depends(get_tenant_context),
    session: AsyncSession = Depends(get_db),
) -> dict:
    service = DealService(session)
    deal = await service.update(deal_id, payload)
    return ok(
        {
            "id": deal.id,
            "code": deal.code,
            "status": deal.status,
            "amount": deal.amount,
            "commission_total": deal.commission_total,
            "version": deal.version,
        }
    )


@router.delete("/{deal_id}", dependencies=[Depends(require_permission(perm.DEAL_DELETE))])
async def delete_deal(
    deal_id: int,
    ctx: TenantContext = Depends(get_tenant_context),
    session: AsyncSession = Depends(get_db),
    version: int | None = Query(default=None),
) -> dict:
    service = DealService(session)
    await service.soft_delete(deal_id, version=version)
    return ok({"id": deal_id, "deleted": True})
