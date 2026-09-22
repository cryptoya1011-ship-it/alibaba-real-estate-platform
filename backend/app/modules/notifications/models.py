"""Notifications Domain — بند 41, 82

Notification Core مستقل از Provider
Channelهای آینده: In-App, Telegram, SMS, Push, Email
Priority: Critical, Important, Normal, Informational
"""
from __future__ import annotations

from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Index, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base
from app.db.mixins import TenantEntity
from app.db.types import BigInt


class Notification(Base, TenantEntity):
    __tablename__ = "notifications"
    __table_args__ = (
        Index("ix_notifications_organization_id_user_id", "organization_id", "user_id"),
        Index("ix_notifications_organization_id_is_read", "organization_id", "is_read"),
        Index("ix_notifications_organization_id_priority", "organization_id", "priority"),
        Index("ix_notifications_organization_id_channel", "organization_id", "channel"),
        Index("ix_notifications_user_id_is_read", "user_id", "is_read"),
    )

    user_id: Mapped[int] = mapped_column(BigInt, nullable=False, index=True)
    channel: Mapped[str] = mapped_column(
        String(32), nullable=False, default="in_app", server_default="in_app"
    )  # in_app, telegram, sms, push, email
    priority: Mapped[str] = mapped_column(
        String(32), nullable=False, default="normal", server_default="normal"
    )  # critical, important, normal, informational

    title: Mapped[str] = mapped_column(String(300), nullable=False)
    body: Mapped[str | None] = mapped_column(Text, nullable=True)

    # For linking to entity (property, visit, etc.)
    entity_type: Mapped[str | None] = mapped_column(String(32), nullable=True)  # property, visit, person, etc.
    entity_id: Mapped[int | None] = mapped_column(BigInt, nullable=True)

    # Extra data as JSON
    data_json: Mapped[str | None] = mapped_column(Text, nullable=True)

    is_read: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, server_default="0")
    read_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
