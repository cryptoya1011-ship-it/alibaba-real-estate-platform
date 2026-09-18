"""User is global: identity only. Membership in organizations is separate."""
from __future__ import annotations

from sqlalchemy import Boolean, Index, Integer, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base
from app.db.mixins import BaseEntity
from app.db.types import BigInt


class User(Base, BaseEntity):
    __tablename__ = "users"
    __table_args__ = (
        UniqueConstraint("telegram_id", name="uq_users_telegram_id"),
        Index("ix_users_phone", "phone"),
    )

    telegram_id: Mapped[int | None] = mapped_column(BigInt, nullable=True)
    telegram_username: Mapped[str | None] = mapped_column(String(64), nullable=True)
    first_name: Mapped[str | None] = mapped_column(String(128), nullable=True)
    last_name: Mapped[str | None] = mapped_column(String(128), nullable=True)
    phone: Mapped[str | None] = mapped_column(String(32), nullable=True)
    language_code: Mapped[str] = mapped_column(String(8), nullable=False, default="fa")
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True, server_default="1")
    is_super_admin: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, server_default="0")
    # Bumping this invalidates every previously issued JWT for this user.
    permissions_version: Mapped[int] = mapped_column(Integer, nullable=False, default=1, server_default="1")

    @property
    def display_name(self) -> str:
        parts = [p for p in (self.first_name, self.last_name) if p]
        return " ".join(parts) or (self.telegram_username or f"user#{self.id}")
