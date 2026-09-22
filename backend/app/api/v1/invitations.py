"""Invitation API — Phase 13 Multi-Tenant

- POST /organizations/{org_id}/invitations — create
- GET /organizations/{org_id}/invitations — list
- DELETE /organizations/{org_id}/invitations/{inv_id} — revoke
- POST /invitations/accept — accept with token
"""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_context, get_tenant_context
from app.core.responses import ok, page_meta
from app.core.tenant import TenantContext
from app.db.session import get_db
from app.modules.organizations.invitation_service import InvitationService

router = APIRouter(tags=["invitations"])


class InvitationCreate(BaseModel):
    invited_telegram_id: int | None = Field(default=None, description="Telegram ID of invited user")
    invited_phone: str | None = Field(default=None, description="Phone of invited user")
    role_code: str = Field(description="Role code: organization_admin, branch_admin, agent, or custom")
    branch_id: int | None = Field(default=None)


class InvitationAccept(BaseModel):
    token: str = Field(description="Raw invitation token")


def _inv_to_dict(inv) -> dict[str, Any]:
    return {
        "id": inv.id,
        "organization_id": inv.organization_id,
        "branch_id": inv.branch_id,
        "invited_telegram_id": inv.invited_telegram_id,
        "invited_phone": inv.invited_phone,
        "role_code": inv.role_code,
        "status": inv.status,
        "accepted_by_user_id": inv.accepted_by_user_id,
        "created_at": inv.created_at,
        "updated_at": inv.updated_at,
    }


@router.post("/organizations/{organization_id}/invitations")
async def create_invitation(
    organization_id: int,
    payload: InvitationCreate,
    ctx: TenantContext = Depends(get_tenant_context),
    session: AsyncSession = Depends(get_db),
) -> dict:
    """ایجاد دعوت‌نامه برای عضو جدید — توکن فقط یک بار نمایش داده می‌شود"""
    service = InvitationService(session)
    invitation, raw_token = await service.create(
        organization_id,
        invited_telegram_id=payload.invited_telegram_id,
        invited_phone=payload.invited_phone,
        role_code=payload.role_code,
        branch_id=payload.branch_id,
    )
    data = _inv_to_dict(invitation)
    data["token"] = raw_token  # Only once!
    return ok(data)


@router.get("/organizations/{organization_id}/invitations")
async def list_invitations(
    organization_id: int,
    ctx: TenantContext = Depends(get_tenant_context),
    session: AsyncSession = Depends(get_db),
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    status: str | None = Query(default=None),
) -> dict:
    """لیست دعوت‌نامه‌های سازمان"""
    service = InvitationService(session)
    rows = await service.list(organization_id, limit=limit, offset=offset, status=status)
    data = [_inv_to_dict(r) for r in rows]
    return ok(data, page_meta(total=len(data), limit=limit, offset=offset))


@router.delete("/organizations/{organization_id}/invitations/{invitation_id}")
async def revoke_invitation(
    organization_id: int,
    invitation_id: int,
    ctx: TenantContext = Depends(get_tenant_context),
    session: AsyncSession = Depends(get_db),
) -> dict:
    """لغو دعوت‌نامه در انتظار"""
    service = InvitationService(session)
    inv = await service.revoke(organization_id, invitation_id)
    return ok(_inv_to_dict(inv))


@router.post("/invitations/accept")
async def accept_invitation(
    payload: InvitationAccept,
    ctx: TenantContext = Depends(get_context),
    session: AsyncSession = Depends(get_db),
) -> dict:
    """پذیرش دعوت‌نامه — عضویت + نقش ایجاد می‌شود"""
    service = InvitationService(session)
    inv = await service.accept(payload.token)
    return ok(_inv_to_dict(inv))
