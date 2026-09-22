"""Super Admin API — Phase 13 Multi-Tenant Dashboard

- All endpoints require is_super_admin
- Uses get_db_public to bypass RLS (admin sees all tenants)
- Endpoints: /admin/organizations, /admin/organizations/{id}, /admin/organizations/{id}/stats, /admin/users, /admin/users/{id}/super-admin, /admin/stats
"""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_context
from app.core.responses import ok, page_meta
from app.core.tenant import TenantContext
from app.db.session import get_db_public
from app.modules.admin.service import AdminService

router = APIRouter(prefix="/admin", tags=["admin"])


class SuperAdminToggle(BaseModel):
    is_super_admin: bool = Field(description="آیا سوپر ادمین باشد؟")


def _org_to_dict(org) -> dict[str, Any]:
    return {
        "id": org.id,
        "name": org.name,
        "slug": org.slug,
        "city_code": org.city_code,
        "phone": org.phone,
        "is_active": org.is_active,
        "created_at": org.created_at,
        "updated_at": org.updated_at,
        "version": org.version,
    }


def _user_to_dict(user) -> dict[str, Any]:
    return {
        "id": user.id,
        "telegram_id": user.telegram_id,
        "first_name": user.first_name,
        "last_name": user.last_name,
        "phone": user.phone,
        "is_active": user.is_active,
        "is_super_admin": user.is_super_admin,
        "permissions_version": user.permissions_version,
        "created_at": user.created_at,
    }


@router.get("/organizations")
async def admin_list_organizations(
    ctx: TenantContext = Depends(get_context),
    session: AsyncSession = Depends(get_db_public),
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    q: str | None = Query(default=None),
) -> dict:
    """لیست تمام سازمان‌ها — سوپر ادمین"""
    service = AdminService(session)
    rows, total = await service.list_organizations(limit=limit, offset=offset, q=q)
    data = [_org_to_dict(r) for r in rows]
    return ok(data, page_meta(total=total, limit=limit, offset=offset))


@router.get("/organizations/{organization_id}")
async def admin_get_organization(
    organization_id: int,
    ctx: TenantContext = Depends(get_context),
    session: AsyncSession = Depends(get_db_public),
) -> dict:
    """جزئیات سازمان — سوپر ادمین"""
    service = AdminService(session)
    org = await service.get_organization(organization_id)
    return ok(_org_to_dict(org))


@router.get("/organizations/{organization_id}/stats")
async def admin_get_org_stats(
    organization_id: int,
    ctx: TenantContext = Depends(get_context),
    session: AsyncSession = Depends(get_db_public),
) -> dict:
    """آمار سازمان — تعداد اعضا، شعب، املاک، مشتریان، بازدیدها، معاملات"""
    service = AdminService(session)
    stats = await service.get_organization_stats(organization_id)
    return ok(stats)


@router.get("/users")
async def admin_list_users(
    ctx: TenantContext = Depends(get_context),
    session: AsyncSession = Depends(get_db_public),
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    q: str | None = Query(default=None),
) -> dict:
    """لیست تمام کاربران — سوپر ادمین"""
    service = AdminService(session)
    rows, total = await service.list_users(limit=limit, offset=offset, q=q)
    data = [_user_to_dict(r) for r in rows]
    return ok(data, page_meta(total=total, limit=limit, offset=offset))


@router.patch("/users/{user_id}/super-admin")
async def admin_toggle_super_admin(
    user_id: int,
    payload: SuperAdminToggle,
    ctx: TenantContext = Depends(get_context),
    session: AsyncSession = Depends(get_db_public),
) -> dict:
    """تغییر وضعیت سوپر ادمین — سوپر ادمین"""
    service = AdminService(session)
    user = await service.toggle_super_admin(user_id, is_super_admin=payload.is_super_admin)
    return ok(_user_to_dict(user))


@router.get("/stats")
async def admin_global_stats(
    ctx: TenantContext = Depends(get_context),
    session: AsyncSession = Depends(get_db_public),
) -> dict:
    """آمار کلی پلتفرم — سوپر ادمین"""
    service = AdminService(session)
    stats = await service.global_stats()
    return ok(stats)
