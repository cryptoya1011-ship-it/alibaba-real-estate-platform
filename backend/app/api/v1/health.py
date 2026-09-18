from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.responses import ok
from app.db.session import get_db

router = APIRouter(tags=["system"])


@router.get("/health")
async def health() -> dict:
    return ok({"status": "ok", "app": settings.APP_CODE, "env": settings.ENV, "version": "0.1.0"})


@router.get("/health/db")
async def health_db(session: AsyncSession = Depends(get_db)) -> dict:
    await session.execute(text("SELECT 1"))
    return ok({"database": "ok", "dialect": session.bind.dialect.name if session.bind else None})
