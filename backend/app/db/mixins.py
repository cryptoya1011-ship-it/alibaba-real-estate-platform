"""Shared entity building blocks: audit, soft delete, optimistic locking, tenancy."""
from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, func

from app.db.types import BigInt
from sqlalchemy.orm import Mapped, declared_attr, mapped_column


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class TimestampMixin:
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )


class AuditMixin:
    created_by: Mapped[int | None] = mapped_column(BigInt, nullable=True)
    updated_by: Mapped[int | None] = mapped_column(BigInt, nullable=True)


class SoftDeleteMixin:
    is_deleted: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default="0", index=True
    )
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    deleted_by: Mapped[int | None] = mapped_column(BigInt, nullable=True)


class VersionMixin:
    """Optimistic locking. Bumped by the repository on every update."""

    version: Mapped[int] = mapped_column(
        Integer, nullable=False, default=1, server_default="1"
    )


class IdMixin:
    id: Mapped[int] = mapped_column(BigInt, primary_key=True, autoincrement=True)


class BaseEntity(IdMixin, TimestampMixin, AuditMixin, SoftDeleteMixin, VersionMixin):
    """Non-tenant entity (users, permissions, system tables)."""


class TenantEntity(BaseEntity):
    """Every organization-scoped entity inherits this."""

    @declared_attr
    def organization_id(cls) -> Mapped[int]:  # noqa: N805
        return mapped_column(
            BigInt,
            ForeignKey("organizations.id", ondelete="RESTRICT"),
            nullable=False,
            index=True,
        )

    @declared_attr
    def branch_id(cls) -> Mapped[int | None]:  # noqa: N805
        return mapped_column(
            BigInt,
            ForeignKey("branches.id", ondelete="SET NULL"),
            nullable=True,
            index=True,
        )
