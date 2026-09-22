"""Custom Roles API — Phase 13 Multi-Tenant

- GET /organizations/{org_id}/roles — list system + custom
- POST /organizations/{org_id}/roles — create custom
- GET /organizations/{org_id}/roles/{role_id} — detail
- PATCH /organizations/{org_id}/roles/{role_id} — update
- DELETE /organizations/{org_id}/roles/{role_id} — delete custom
"""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_tenant_context
from app.core.responses import ok, page_meta
from app.core.tenant import TenantContext
from app.db.session import get_db
from app.modules.rbac.custom_role_service import CustomRoleService

router = APIRouter(tags=["roles"])


class RoleCreate(BaseModel):
    code: str = Field(min_length=2, max_length=64, pattern=r"^[a-z0-9_]+$", description="کد انگلیسی نقش")
    title: str = Field(min_length=2, max_length=200)
    permission_codes: list[str] = Field(default_factory=list)


class RoleUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=2, max_length=200)
    permission_codes: list[str] | None = None


async def _role_to_dict(role, service: CustomRoleService) -> dict[str, Any]:
    perms = await service.get_role_permissions(role.id)
    return {
        "id": role.id,
        "organization_id": role.organization_id,
        "code": role.code,
        "title": role.title,
        "is_system": role.is_system,
        "permissions": list(perms),
        "created_at": role.created_at,
        "updated_at": role.updated_at,
        "version": role.version,
    }


@router.get("/organizations/{organization_id}/roles")
async def list_roles(
    organization_id: int,
    ctx: TenantContext = Depends(get_tenant_context),
    session: AsyncSession = Depends(get_db),
) -> dict:
    """لیست نقش‌ها — سیستمی + سفارشی سازمان"""
    service = CustomRoleService(session)
    roles = await service.list_roles(organization_id)
    data = [await _role_to_dict(r, service) for r in roles]
    return ok(data, page_meta(total=len(data), limit=len(data) or 1, offset=0))


@router.post("/organizations/{organization_id}/roles", status_code=201)
async def create_role(
    organization_id: int,
    payload: RoleCreate,
    ctx: TenantContext = Depends(get_tenant_context),
    session: AsyncSession = Depends(get_db),
) -> dict:
    """ایجاد نقش سفارشی برای سازمان"""
    service = CustomRoleService(session)
    role = await service.create_role(
        organization_id, code=payload.code, title=payload.title, permission_codes=payload.permission_codes
    )
    data = await _role_to_dict(role, service)
    return ok(data)


@router.get("/organizations/{organization_id}/roles/{role_id}")
async def get_role(
    organization_id: int,
    role_id: int,
    ctx: TenantContext = Depends(get_tenant_context),
    session: AsyncSession = Depends(get_db),
) -> dict:
    """جزئیات نقش"""
    service = CustomRoleService(session)
    role = await service.get_role(organization_id, role_id)
    data = await _role_to_dict(role, service)
    return ok(data)


@router.patch("/organizations/{organization_id}/roles/{role_id}")
async def update_role(
    organization_id: int,
    role_id: int,
    payload: RoleUpdate,
    ctx: TenantContext = Depends(get_tenant_context),
    session: AsyncSession = Depends(get_db),
) -> dict:
    """ویرایش نقش سفارشی"""
    service = CustomRoleService(session)
    role = await service.update_role(
        organization_id, role_id, title=payload.title, permission_codes=payload.permission_codes
    )
    data = await _role_to_dict(role, service)
    return ok(data)


@router.delete("/organizations/{organization_id}/roles/{role_id}")
async def delete_role(
    organization_id: int,
    role_id: int,
    ctx: TenantContext = Depends(get_tenant_context),
    session: AsyncSession = Depends(get_db),
) -> dict:
    """حذف نقش سفارشی (نرم)"""
    service = CustomRoleService(session)
    role = await service.delete_role(organization_id, role_id)
    return ok({"id": role.id, "deleted": True})
