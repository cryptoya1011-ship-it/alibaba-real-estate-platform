"""Invitation Repository — tenant aware"""

from __future__ import annotations

from sqlalchemy import select

from app.modules.organizations.models import OrganizationInvitation
from app.repositories.base import TenantRepository


class InvitationRepository(TenantRepository[OrganizationInvitation]):
    model = OrganizationInvitation

    async def get_by_token_hash(self, token_hash: str) -> OrganizationInvitation | None:
        stmt = self._base_select().where(self.model.token_hash == token_hash)
        return (await self.session.execute(stmt)).scalar_one_or_none()

    async def list_for_org(self, organization_id: int, *, limit: int = 20, offset: int = 0, status: str | None = None):
        stmt = self._base_select().where(self.model.organization_id == organization_id)
        if status:
            stmt = stmt.where(self.model.status == status)
        stmt = stmt.order_by(self.model.id.desc()).limit(limit).offset(offset)
        rows = (await self.session.execute(stmt)).scalars().all()
        return list(rows)
