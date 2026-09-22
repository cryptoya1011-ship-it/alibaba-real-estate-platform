"""Deals & Commission Domain — بند 39, 40, 87

Deal مستقل از Property, Pipeline: Lead → ... → Closed
Commission: Total, Agent Share, Office Share, Referral Share, Payment Status
"""
from __future__ import annotations

from sqlalchemy import BigInteger, Float, ForeignKey, Index, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.db.mixins import TenantEntity
from app.db.types import BigInt


class Deal(Base, TenantEntity):
    __tablename__ = "deals"
    __table_args__ = (
        UniqueConstraint("organization_id", "code", name="uq_deals_organization_id_code"),
        Index("ix_deals_organization_id_status", "organization_id", "status"),
        Index("ix_deals_organization_id_customer_id", "organization_id", "customer_id"),
        Index("ix_deals_organization_id_property_id", "organization_id", "property_id"),
        Index("ix_deals_organization_id_agent_id", "organization_id", "agent_id"),
        Index("ix_deals_code", "code"),
    )

    # Code: DL-ISF-2609-00001
    code: Mapped[str] = mapped_column(String(64), nullable=False)
    code_period: Mapped[str] = mapped_column(String(16), nullable=False)
    code_sequence: Mapped[int] = mapped_column(Integer, nullable=False)

    title: Mapped[str] = mapped_column(String(300), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Pipeline (بند 39)
    status: Mapped[str] = mapped_column(
        String(32), nullable=False, default="lead", server_default="lead"
    )  # lead, qualification, property_match, visit, negotiation, agreement, closed_won, closed_lost, archived

    # Relations — independent of Property but can have one
    customer_id: Mapped[int] = mapped_column(
        BigInt, ForeignKey("persons.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    property_id: Mapped[int | None] = mapped_column(
        BigInt, ForeignKey("properties.id", ondelete="SET NULL"), nullable=True, index=True
    )
    agent_id: Mapped[int | None] = mapped_column(
        BigInt, ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True
    )

    # Financial
    amount: Mapped[int | None] = mapped_column(BigInteger, nullable=True)  # Deal amount

    # Commission (بند 40)
    commission_total: Mapped[int | None] = mapped_column(BigInteger, nullable=True)
    commission_agent_share: Mapped[int | None] = mapped_column(BigInteger, nullable=True)
    commission_office_share: Mapped[int | None] = mapped_column(BigInteger, nullable=True)
    commission_referral_share: Mapped[int | None] = mapped_column(BigInteger, nullable=True)
    commission_status: Mapped[str | None] = mapped_column(String(32), nullable=True)  # pending, paid, etc.

    # Extra
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    loss_reason: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Relationships
    history: Mapped[list[DealStatusHistory]] = relationship(
        "DealStatusHistory", back_populates="deal", cascade="all, delete-orphan", lazy="selectin"
    )


class DealStatusHistory(Base, TenantEntity):
    """تاریخچه تغییر وضعیت معامله — برای Audit و Pipeline"""

    __tablename__ = "deal_status_history"
    __table_args__ = (
        Index("ix_deal_status_history_organization_id_deal_id", "organization_id", "deal_id"),
        Index("ix_deal_status_history_deal_id_created_at", "deal_id", "created_at"),
    )

    deal_id: Mapped[int] = mapped_column(
        BigInt, ForeignKey("deals.id", ondelete="CASCADE"), nullable=False, index=True
    )
    from_status: Mapped[str | None] = mapped_column(String(32), nullable=True)
    to_status: Mapped[str] = mapped_column(String(32), nullable=False)
    changed_by: Mapped[int | None] = mapped_column(BigInt, nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    deal: Mapped[Deal] = relationship("Deal", back_populates="history")
