"""Integration Logs — audit all external calls, tenant-aware"""

from __future__ import annotations

from sqlalchemy import BigInteger, Index, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base
from app.db.mixins import TenantEntity
from app.db.types import BigInt


class IntegrationLog(Base, TenantEntity):
    """Log every external integration call for audit, retry, debug"""

    __tablename__ = "integration_logs"
    __table_args__ = (
        Index("ix_integration_logs_org_provider", "organization_id", "provider"),
        Index("ix_integration_logs_org_created", "organization_id", "created_at"),
        Index("ix_integration_logs_provider_status", "provider", "status"),
    )

    provider: Mapped[str] = mapped_column(String(64), nullable=False)  # telegram, sms, divar, sheypoor, payment, maps
    action: Mapped[str] = mapped_column(String(64), nullable=False)  # send_message, send_sms, publish, create_payment, geocode, etc.
    entity_type: Mapped[str | None] = mapped_column(String(64), nullable=True)  # property, deal, visit, etc.
    entity_id: Mapped[int | None] = mapped_column(BigInteger, nullable=True)

    # Request / Response stored as JSON string for simplicity
    request_payload: Mapped[str | None] = mapped_column(Text, nullable=True)
    response_payload: Mapped[str | None] = mapped_column(Text, nullable=True)

    status: Mapped[str] = mapped_column(String(16), nullable=False, default="success")  # success, failed, pending
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)

    # External identifiers
    external_id: Mapped[str | None] = mapped_column(String(200), nullable=True)
    external_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
