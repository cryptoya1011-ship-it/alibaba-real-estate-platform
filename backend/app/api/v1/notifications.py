"""Notifications API — بند 41, 82"""
from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_tenant_context, pagination, require_permission
from app.core import permissions as perm
from app.core.responses import ok, page_meta
from app.core.tenant import TenantContext
from app.db.session import get_db
from app.modules.notifications.schemas import NotificationCreate
from app.modules.notifications.service import NotificationService

router = APIRouter(prefix="/notifications", tags=["notifications"])


@router.get("", dependencies=[Depends(require_permission(perm.NOTIFICATION_READ))])
async def list_notifications(
    ctx: TenantContext = Depends(get_tenant_context),
    session: AsyncSession = Depends(get_db),
    pag: Any = Depends(pagination),
    is_read: bool | None = Query(default=None),
    priority: str | None = Query(default=None),
) -> dict:
    service = NotificationService(session)
    items, total = await service.list(
        ctx.user_id, limit=pag.limit, offset=pag.offset, is_read=is_read, priority=priority
    )
    data = [
        {
            "id": n.id,
            "title": n.title,
            "body": n.body,
            "priority": n.priority,
            "channel": n.channel,
            "is_read": n.is_read,
            "entity_type": n.entity_type,
            "entity_id": n.entity_id,
            "created_at": n.created_at,
        }
        for n in items
    ]
    return ok(data, page_meta(total=total, limit=pag.limit, offset=pag.offset))


@router.get("/unread-count", dependencies=[Depends(require_permission(perm.NOTIFICATION_READ))])
async def get_unread_count(
    ctx: TenantContext = Depends(get_tenant_context),
    session: AsyncSession = Depends(get_db),
) -> dict:
    service = NotificationService(session)
    count = await service.get_unread_count(ctx.user_id)
    return ok({"unread_count": count})


@router.post("/{notification_id}/read", dependencies=[Depends(require_permission(perm.NOTIFICATION_READ))])
async def mark_read(
    notification_id: int,
    ctx: TenantContext = Depends(get_tenant_context),
    session: AsyncSession = Depends(get_db),
) -> dict:
    service = NotificationService(session)
    n = await service.mark_read(notification_id, ctx.user_id)
    return ok({"id": n.id, "is_read": n.is_read})


@router.post("/read-all", dependencies=[Depends(require_permission(perm.NOTIFICATION_READ))])
async def mark_all_read(
    ctx: TenantContext = Depends(get_tenant_context),
    session: AsyncSession = Depends(get_db),
) -> dict:
    service = NotificationService(session)
    count = await service.mark_all_read(ctx.user_id)
    return ok({"marked_count": count})


@router.delete("/{notification_id}", dependencies=[Depends(require_permission(perm.NOTIFICATION_MANAGE))])
async def delete_notification(
    notification_id: int,
    ctx: TenantContext = Depends(get_tenant_context),
    session: AsyncSession = Depends(get_db),
) -> dict:
    service = NotificationService(session)
    await service.delete(notification_id, ctx.user_id)
    return ok({"id": notification_id, "deleted": True})


# Internal endpoint for creating notifications (for testing, admin only)
@router.post("", dependencies=[Depends(require_permission(perm.NOTIFICATION_MANAGE))])
async def create_notification(
    payload: NotificationCreate,
    ctx: TenantContext = Depends(get_tenant_context),
    session: AsyncSession = Depends(get_db),
) -> dict:
    service = NotificationService(session)
    n = await service.create_from_payload(payload)
    return ok({"id": n.id, "title": n.title})
