"""Deal Repositories"""
from __future__ import annotations

from sqlalchemy import select

from app.db.system_models import CodeSequence
from app.repositories.base import BaseRepository, TenantRepository

from .models import Deal, DealStatusHistory


class DealRepository(TenantRepository[Deal]):
    model = Deal

    async def get_by_code(self, code: str) -> Deal | None:
        stmt = self._base_select().where(self.model.code == code)
        return (await self.session.execute(stmt)).scalar_one_or_none()


class DealStatusHistoryRepository(TenantRepository[DealStatusHistory]):
    model = DealStatusHistory


class CodeSequenceRepository(BaseRepository[CodeSequence]):
    model = CodeSequence

    async def next_value(self, organization_id: int, scope: str, period: str) -> int:
        stmt = select(self.model).where(
            self.model.organization_id == organization_id,
            self.model.scope == scope,
            self.model.period == period,
            self.model.is_deleted == False,  # noqa: E712
        )
        seq = (await self.session.execute(stmt)).scalar_one_or_none()
        if seq is None:
            seq = self.model(
                organization_id=organization_id,
                scope=scope,
                period=period,
                last_value=1,
            )
            self.session.add(seq)
            await self.session.flush()
            return 1
        else:
            seq.last_value = (seq.last_value or 0) + 1
            await self.session.flush()
            return seq.last_value
