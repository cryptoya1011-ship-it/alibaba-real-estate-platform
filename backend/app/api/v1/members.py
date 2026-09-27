"""Organization members & branch editing (current organization).

    GET    /organizations/current/members
    GET    /organizations/current/members/{user_id}
    PUT    /organizations/current/members/{user_id}/roles      {"role_codes": [...]}
    PUT    /organizations/current/members/{user_id}/branches   {"branch_ids": [...], "default_branch_id": n}
    PATCH  /organizations/current/members/{user_id}            {"is_active": bool}
    DELETE /organizations/current/members/{user_id}
    PATCH  /organizations/current/branches/{branch_id}         {name?, address?, is_main?, is_active?, version}
"""
from __future__ import annotations

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import require_permission
from app.core import permissions as perm
from app.core.responses import ok
from app.core.tenant import TenantContext
from app.db.session import get_db
from app.modules.organizations.member_service import MemberService
from app.modules.organizations.schemas import BranchOut, BranchUpdate
from app.modules.organizations.service import OrganizationService

router = APIRouter(prefix="/organizations/current", tags=["members"])


class MemberRoles(BaseModel):
    role_codes: list[str] = Field(min_length=1, max_length=20)


class MemberBranches(BaseModel):
    branch_ids: list[int] = Field(default_factory=list, max_length=100)
    default_branch_id: int | None = None


class MemberStatus(BaseModel):
    is_active: bool


@router.get("/members")
async def list_members(
    ctx: TenantContext = Depends(require_permission(perm.ORG_MEMBER_READ)),
    session: AsyncSession = Depends(get_db),
) -> dict:
    """اعضای سازمان جاری همراه نقش‌ها و شعب"""
    return ok(await MemberService(session).list())


@router.get("/members/{user_id}")
async def get_member(
    user_id: int,
    ctx: TenantContext = Depends(require_permission(perm.ORG_MEMBER_READ)),
    session: AsyncSession = Depends(get_db),
) -> dict:
    return ok(await MemberService(session).get(user_id))


@router.put("/members/{user_id}/roles")
async def set_member_roles(
    user_id: int,
    payload: MemberRoles,
    ctx: TenantContext = Depends(require_permission(perm.ROLE_MANAGE)),
    session: AsyncSession = Depends(get_db),
) -> dict:
    """جایگزینی نقش‌های عضو در سازمان (توکن‌های قبلی عضو باطل می‌شوند)"""
    return ok(await MemberService(session).set_roles(user_id, payload.role_codes))


@router.put("/members/{user_id}/branches")
async def set_member_branches(
    user_id: int,
    payload: MemberBranches,
    ctx: TenantContext = Depends(require_permission(perm.BRANCH_MANAGE)),
    session: AsyncSession = Depends(get_db),
) -> dict:
    return ok(await MemberService(session).set_branches(user_id, payload.branch_ids, payload.default_branch_id))


@router.patch("/members/{user_id}")
async def set_member_status(
    user_id: int,
    payload: MemberStatus,
    ctx: TenantContext = Depends(require_permission(perm.ORG_UPDATE)),
    session: AsyncSession = Depends(get_db),
) -> dict:
    """تعلیق یا فعال‌سازی مجدد عضو"""
    return ok(await MemberService(session).set_active(user_id, payload.is_active))


@router.delete("/members/{user_id}")
async def remove_member(
    user_id: int,
    ctx: TenantContext = Depends(require_permission(perm.ORG_UPDATE)),
    session: AsyncSession = Depends(get_db),
) -> dict:
    """حذف عضو از سازمان (برای بازگشت باید دوباره دعوت شود)"""
    await MemberService(session).remove(user_id)
    return ok({"removed": True})


@router.patch("/branches/{branch_id}")
async def update_branch(
    branch_id: int,
    payload: BranchUpdate,
    ctx: TenantContext = Depends(require_permission(perm.BRANCH_MANAGE)),
    session: AsyncSession = Depends(get_db),
) -> dict:
    branch = await OrganizationService(session).update_branch(branch_id, payload)
    return ok(BranchOut.model_validate(branch).model_dump())
