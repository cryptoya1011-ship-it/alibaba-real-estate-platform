"""Property Repositories — Tenant-aware"""
from __future__ import annotations

from sqlalchemy import Select, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.system_models import CodeSequence
from app.repositories.base import BaseRepository, TenantRepository

from .models import Property, PropertyLocation, PropertyMedia, PropertyUsage


class PropertyRepository(TenantRepository[Property]):
    model = Property

    async def get_by_code(self, code: str) -> Property | None:
        stmt = self._base_select().where(self.model.code == code)
        return (await self.session.execute(stmt)).scalar_one_or_none()

    async def search(
        self,
        *,
        limit: int,
        offset: int,
        property_type: str | None = None,
        transaction_type: str | None = None,
        status: str | None = None,
        city_code: str | None = None,
        district_code: str | None = None,
        min_price: int | None = None,
        max_price: int | None = None,
        min_area: float | None = None,
        max_area: float | None = None,
        has_parking: bool | None = None,
        has_elevator: bool | None = None,
        rooms: int | None = None,
        q: str | None = None,
    ) -> tuple[list[Property], int]:
        """Structured search (بند 15) — Database Search کافی برای Local"""
        stmt = self._base_select()

        if property_type:
            stmt = stmt.where(self.model.property_type == property_type)
        if transaction_type:
            stmt = stmt.where(self.model.transaction_type == transaction_type)
        if status:
            stmt = stmt.where(self.model.status == status)
        if min_price is not None:
            stmt = stmt.where(self.model.price >= min_price)
        if max_price is not None:
            stmt = stmt.where(self.model.price <= max_price)
        if min_area is not None:
            stmt = stmt.where(
                (self.model.built_area >= min_area) | (self.model.land_area >= min_area)
            )
        if max_area is not None:
            stmt = stmt.where(
                (self.model.built_area <= max_area) | (self.model.land_area <= max_area)
            )
        if has_parking is not None:
            stmt = stmt.where(self.model.has_parking == has_parking)
        if has_elevator is not None:
            stmt = stmt.where(self.model.has_elevator == has_elevator)
        if rooms is not None:
            stmt = stmt.where(self.model.rooms == rooms)
        if q:
            # Simple LIKE search for Local — later PostgreSQL FTS
            like = f"%{q}%"
            stmt = stmt.where(
                (self.model.title.ilike(like)) | (self.model.description.ilike(like)) | (self.model.code.ilike(like))
            )

        # For city/district filter we need join with location
        if city_code or district_code:
            stmt = stmt.join(PropertyLocation, PropertyLocation.property_id == self.model.id, isouter=True)
            if city_code:
                stmt = stmt.where(PropertyLocation.city_code == city_code)
            if district_code:
                stmt = stmt.where(PropertyLocation.district_code == district_code)

        total = (await self.session.execute(select(func.count()).select_from(stmt.subquery()))).scalar_one()

        # Order by newest first
        stmt = stmt.order_by(self.model.id.desc()).limit(limit).offset(offset)
        rows = (await self.session.execute(stmt)).scalars().all()
        return list(rows), int(total)


class PropertyUsageRepository(TenantRepository[PropertyUsage]):
    model = PropertyUsage


class PropertyLocationRepository(TenantRepository[PropertyLocation]):
    model = PropertyLocation


class PropertyMediaRepository(TenantRepository[PropertyMedia]):
    model = PropertyMedia


class CodeSequenceRepository(BaseRepository[CodeSequence]):
    """Non-tenant? Actually has organization_id but we treat as Base to control manually"""

    model = CodeSequence

    async def next_value(self, organization_id: int, scope: str, period: str) -> int:
        """Atomic increment — works on SQLite and PostgreSQL

        For SQLite we rely on transaction + SELECT then UPDATE.
        For PostgreSQL we could use SELECT FOR UPDATE, but this simple approach works for both
        because we are inside a transaction (session) and flush.
        """
        # Try to find existing
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
