from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_context
from app.core.responses import ok
from app.core.tenant import TenantContext
from app.db.session import get_db
from app.modules.users.repository import UserRepository

router = APIRouter(tags=["me"])


@router.get("/me")
async def me(ctx: TenantContext = Depends(get_context), session: AsyncSession = Depends(get_db)) -> dict:
    user = await UserRepository(session).get_or_404(ctx.user_id)
    return ok(
        {
            "user": {
                "id": user.id,
                "telegram_id": user.telegram_id,
                "display_name": user.display_name,
                "phone": user.phone,
                "is_super_admin": user.is_super_admin,
            },
            "organization_id": ctx.organization_id,
            "branch_id": ctx.branch_id,
            "roles": list(ctx.roles),
            "permissions": sorted(ctx.permissions),
        }
    )
