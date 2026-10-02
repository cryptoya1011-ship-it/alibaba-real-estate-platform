from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.responses import ok
from app.core.tenant import TenantContext
from app.db.session import get_db
from app.modules.auth.schemas import (
    DevLoginRequest,
    PasswordLoginRequest,
    SelectOrganizationRequest,
    TelegramLoginRequest,
)
from app.modules.auth.service import AuthService
from app.api.deps import get_context
from app.modules.users.repository import UserRepository
from app.core.config import settings

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/telegram")
async def login_telegram(payload: TelegramLoginRequest, session: AsyncSession = Depends(get_db)) -> dict:
    """Validate Telegram Web App initData (HMAC-SHA256) and issue an AREP token."""
    result = await AuthService(session).login_with_telegram(payload.init_data, payload.organization_id)
    return ok(result.model_dump())


@router.post("/dev-login")
async def dev_login(payload: DevLoginRequest, session: AsyncSession = Depends(get_db)) -> dict:
    """Local development only; disabled when ENV=production."""
    result = await AuthService(session).dev_login(
        payload.telegram_id, payload.first_name, payload.organization_id
    )
    return ok(result.model_dump())


@router.get("/methods")
async def login_methods() -> dict:
    """Which login methods the server accepts (no secrets) — lets the UI pick the right screen."""
    return ok(
        {
            "telegram": bool(settings.TELEGRAM_BOT_TOKEN),
            "password": bool(settings.PASSWORD_LOGIN_ENABLED),
            "dev": bool(settings.ALLOW_DEV_LOGIN and not settings.is_production),
        }
    )


@router.post("/password")
async def password_login(payload: PasswordLoginRequest, session: AsyncSession = Depends(get_db)) -> dict:
    """TEMPORARY username/password login (ADR-0023); disabled unless PASSWORD_LOGIN_ENABLED=true."""
    result = await AuthService(session).password_login(payload.username, payload.password, payload.organization_id)
    return ok(result.model_dump())


@router.post("/select-organization")
async def select_organization(
    payload: SelectOrganizationRequest,
    ctx: TenantContext = Depends(get_context),
    session: AsyncSession = Depends(get_db),
) -> dict:
    """Switch the active tenant; returns a new token carrying the new context."""
    user = await UserRepository(session).get_or_404(ctx.user_id)
    result = await AuthService(session).issue_token(user, payload.organization_id, payload.branch_id)
    return ok(result.model_dump())
