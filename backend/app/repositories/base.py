"""Repository bases.

TenantRepository applies `organization_id` and `is_deleted` filters centrally, so a
missing tenant filter is not something a developer can forget in a query.
"""
from __future__ import annotations

from typing import Any, Generic, Sequence, TypeVar

from sqlalchemy import Select, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import NotFoundError, VersionConflictError
from app.core.tenant import current_context
from app.db.base import Base
from app.db.mixins import utcnow

ModelT = TypeVar("ModelT", bound=Base)


class BaseRepository(Generic[ModelT]):
    """Non-tenant repository: soft-delete aware, no organization filter."""

    model: type[ModelT]

    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    # -- query building -------------------------------------------------
    def _base_select(self, *, include_deleted: bool = False) -> Select:
        stmt = select(self.model)
        if not include_deleted:
            stmt = stmt.where(self.model.is_deleted.is_(False))
        return stmt

    # -- reads ----------------------------------------------------------
    async def get(self, entity_id: int, *, include_deleted: bool = False) -> ModelT | None:
        stmt = self._base_select(include_deleted=include_deleted).where(self.model.id == entity_id)
        return (await self.session.execute(stmt)).scalar_one_or_none()

    async def get_or_404(self, entity_id: int) -> ModelT:
        entity = await self.get(entity_id)
        if entity is None:
            raise NotFoundError()
        return entity

    async def find_one_by(self, **filters: Any) -> ModelT | None:
        stmt = self._base_select()
        for field, value in filters.items():
            stmt = stmt.where(getattr(self.model, field) == value)
        return (await self.session.execute(stmt)).scalars().first()

    async def list(
        self,
        *,
        limit: int = 20,
        offset: int = 0,
        order_by: str = "-id",
        **filters: Any,
    ) -> tuple[Sequence[ModelT], int]:
        stmt = self._base_select()
        for field, value in filters.items():
            if value is not None:
                stmt = stmt.where(getattr(self.model, field) == value)
        total = (
            await self.session.execute(select(func.count()).select_from(stmt.subquery()))
        ).scalar_one()
        column = getattr(self.model, order_by.lstrip("-"))
        stmt = stmt.order_by(column.desc() if order_by.startswith("-") else column.asc())
        rows = (await self.session.execute(stmt.limit(limit).offset(offset))).scalars().all()
        return rows, int(total)

    # -- writes ---------------------------------------------------------
    def _actor_id(self) -> int | None:
        from app.core.tenant import get_context_or_none

        ctx = get_context_or_none()
        return ctx.user_id if ctx else None

    async def create(self, **values: Any) -> ModelT:
        actor = self._actor_id()
        entity = self.model(**values)
        if actor is not None:
            entity.created_by = actor
            entity.updated_by = actor
        self.session.add(entity)
        await self.session.flush()
        return entity

    async def update(self, entity: ModelT, *, expected_version: int | None = None, **values: Any) -> ModelT:
        if expected_version is not None and entity.version != expected_version:
            raise VersionConflictError()
        for field, value in values.items():
            setattr(entity, field, value)
        entity.version = (entity.version or 1) + 1
        actor = self._actor_id()
        if actor is not None:
            entity.updated_by = actor
        await self.session.flush()
        return entity

    async def soft_delete(self, entity: ModelT, *, expected_version: int | None = None) -> ModelT:
        if expected_version is not None and entity.version != expected_version:
            raise VersionConflictError()
        entity.is_deleted = True
        entity.deleted_at = utcnow()
        entity.deleted_by = self._actor_id()
        entity.version = (entity.version or 1) + 1
        await self.session.flush()
        return entity


class TenantRepository(BaseRepository[ModelT]):
    """Adds a mandatory organization filter derived from the request context."""

    def _organization_id(self) -> int:
        return current_context().require_organization()

    def _base_select(self, *, include_deleted: bool = False) -> Select:
        stmt = super()._base_select(include_deleted=include_deleted)
        return stmt.where(self.model.organization_id == self._organization_id())

    async def create(self, **values: Any) -> ModelT:
        # organization_id always comes from the context, never from client input.
        values["organization_id"] = self._organization_id()
        ctx = current_context()
        if hasattr(self.model, "branch_id"):
            values.setdefault("branch_id", ctx.branch_id)
        return await super().create(**values)
