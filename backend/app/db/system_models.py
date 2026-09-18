"""Infrastructure tables that are not part of a business domain."""
from __future__ import annotations

from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base
from app.db.mixins import BaseEntity
from app.db.types import BigInt


class CodeSequence(Base, BaseEntity):
    """Sequence store for human-readable codes (e.g. ISF-MJ-AP-S-2608-00124).

    Formatting lives in the service layer; this table only owns the counter.
    """

    __tablename__ = "code_sequences"
    __table_args__ = (
        UniqueConstraint("organization_id", "scope", "period", name="uq_code_sequences_organization_id_scope_period"),
    )

    organization_id: Mapped[int] = mapped_column(
        BigInt, ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True
    )
    scope: Mapped[str] = mapped_column(String(64), nullable=False)   # e.g. "property"
    period: Mapped[str] = mapped_column(String(16), nullable=False)  # e.g. "2608"
    last_value: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default="0")


class IdempotencyKey(Base, BaseEntity):
    """Stores the first response for an Idempotency-Key so retries are safe."""

    __tablename__ = "idempotency_keys"
    __table_args__ = (
        UniqueConstraint("organization_id", "endpoint", "key", name="uq_idempotency_keys_organization_id_endpoint_key"),
    )

    organization_id: Mapped[int | None] = mapped_column(BigInt, nullable=True, index=True)
    user_id: Mapped[int | None] = mapped_column(BigInt, nullable=True)
    endpoint: Mapped[str] = mapped_column(String(200), nullable=False)
    key: Mapped[str] = mapped_column(String(128), nullable=False)
    request_fingerprint: Mapped[str] = mapped_column(String(64), nullable=False)
    status_code: Mapped[int] = mapped_column(Integer, nullable=False, default=200)
    response_body: Mapped[str] = mapped_column(Text, nullable=False)
    expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
