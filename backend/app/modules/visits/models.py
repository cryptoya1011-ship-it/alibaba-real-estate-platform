"""Visits Domain — بند 38

Visit شامل Property, Customer, Agent, Date, Time, Status, Notes
"""
from __future__ import annotations

from datetime import date, time

from sqlalchemy import Boolean, Date, ForeignKey, Index, String, Text, Time
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.db.mixins import TenantEntity
from app.db.types import BigInt


class Visit(Base, TenantEntity):
    __tablename__ = "visits"
    __table_args__ = (
        Index("ix_visits_organization_id_property_id", "organization_id", "property_id"),
        Index("ix_visits_organization_id_customer_id", "organization_id", "customer_id"),
        Index("ix_visits_organization_id_agent_id", "organization_id", "agent_id"),
        Index("ix_visits_organization_id_date", "organization_id", "visit_date"),
        Index("ix_visits_organization_id_status", "organization_id", "status"),
    )

    property_id: Mapped[int] = mapped_column(
        BigInt, ForeignKey("properties.id", ondelete="CASCADE"), nullable=False, index=True
    )
    customer_id: Mapped[int] = mapped_column(
        BigInt, ForeignKey("persons.id", ondelete="CASCADE"), nullable=False, index=True
    )
    agent_id: Mapped[int] = mapped_column(
        BigInt, ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True
    )

    visit_date: Mapped[date] = mapped_column(Date, nullable=False)
    visit_time: Mapped[time | None] = mapped_column(Time, nullable=True)

    status: Mapped[str] = mapped_column(
        String(32), nullable=False, default="scheduled", server_default="scheduled"
    )  # scheduled, done, cancelled, no_show, rescheduled

    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    follow_up_notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    # For future: result, feedback, etc.
    result: Mapped[str | None] = mapped_column(String(32), nullable=True)  # interested, not_interested, etc.

    # Relationships (optional, for eager loading)
    # property: Mapped[Property] = relationship("Property", lazy="selectin")
    # customer: Mapped[Person] = relationship("Person", lazy="selectin")
