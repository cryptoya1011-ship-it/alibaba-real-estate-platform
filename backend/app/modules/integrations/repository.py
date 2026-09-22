"""IntegrationLog Repository — tenant-aware"""

from __future__ import annotations

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.repositories.base import TenantRepository
from .models import IntegrationLog


class IntegrationLogRepository(TenantRepository[IntegrationLog]):
    model = IntegrationLog

    async def list(self, *, limit: int = 20, offset: int = 0, provider: str | None = None, status: str | None = None):
        stmt = self._base_select()
        if provider:
            stmt = stmt.where(self.model.provider == provider)
        if status:
            stmt = stmt.where(self.model.status == status)

        total = (await self.session.execute(select(func.count()).select_from(stmt.subquery()))).scalar_one()
        stmt = stmt.order_by(self.model.created_at.desc()).limit(limit).offset(offset)
        rows = (await self.session.execute(stmt)).scalars().all()
        return list(rows), int(total)

    async def create_log(self, **kwargs) -> IntegrationLog:
        obj = await self.create(**kwargs)
        await self.session.flush()
        await self.session.refresh(obj)
        return obj
