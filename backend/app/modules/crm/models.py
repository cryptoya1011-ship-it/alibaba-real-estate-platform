"""CRM Domain — بند 34-37

Person مستقل از Role, Customer Requests, Favorites, Saved Searches
"""
from __future__ import annotations

from sqlalchemy import Boolean, Float, ForeignKey, Index, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.db.mixins import TenantEntity
from app.db.types import BigInt


class Person(Base, TenantEntity):
    """Person — مستقل از Business Role (بند 34)

    یک Person می‌تواند همزمان Owner, Buyer, Tenant, Seller, Investor, Landlord, Developer, Intermediary باشد
    """

    __tablename__ = "persons"
    __table_args__ = (
        UniqueConstraint("organization_id", "phone", name="uq_persons_organization_id_phone"),
        Index("ix_persons_organization_id_first_name", "organization_id", "first_name"),
        Index("ix_persons_organization_id_phone", "organization_id", "phone"),
    )

    first_name: Mapped[str] = mapped_column(String(100), nullable=False)
    last_name: Mapped[str | None] = mapped_column(String(100), nullable=True)
    phone: Mapped[str | None] = mapped_column(String(32), nullable=True)  # Unique per org
    email: Mapped[str | None] = mapped_column(String(200), nullable=True)
    national_id: Mapped[str | None] = mapped_column(String(20), nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Relationships
    roles: Mapped[list[PersonRole]] = relationship(
        "PersonRole", back_populates="person", cascade="all, delete-orphan", lazy="selectin"
    )
    requests: Mapped[list[CustomerRequest]] = relationship(
        "CustomerRequest", back_populates="person", cascade="all, delete-orphan", lazy="selectin"
    )

    @property
    def display_name(self) -> str:
        parts = [p for p in (self.first_name, self.last_name) if p]
        return " ".join(parts) or (self.phone or f"person#{self.id}")


class PersonRole(Base, TenantEntity):
    """نقش‌های چندگانه یک Person (بند 34)"""

    __tablename__ = "person_roles"
    __table_args__ = (
        UniqueConstraint("person_id", "role", name="uq_person_roles_person_id_role"),
        Index("ix_person_roles_organization_id_person_id", "organization_id", "person_id"),
    )

    person_id: Mapped[int] = mapped_column(
        BigInt, ForeignKey("persons.id", ondelete="CASCADE"), nullable=False, index=True
    )
    role: Mapped[str] = mapped_column(String(32), nullable=False)  # owner, buyer, tenant, seller, investor, landlord, developer, intermediary

    person: Mapped[Person] = relationship("Person", back_populates="roles")


class CustomerRequest(Base, TenantEntity):
    """درخواست مشتری — بند 35

    شامل transaction type, property type, location, budget, area, rooms, amenities, special requirements
    """

    __tablename__ = "customer_requests"
    __table_args__ = (
        Index("ix_customer_requests_organization_id_person_id", "organization_id", "person_id"),
        Index("ix_customer_requests_organization_id_status", "organization_id", "status"),
        Index("ix_customer_requests_organization_id_transaction_type", "organization_id", "transaction_type"),
    )

    person_id: Mapped[int] = mapped_column(
        BigInt, ForeignKey("persons.id", ondelete="CASCADE"), nullable=False, index=True
    )

    transaction_type: Mapped[str | None] = mapped_column(String(32), nullable=True)  # sale, rent, exchange, partnership
    property_type: Mapped[str | None] = mapped_column(String(32), nullable=True)

    # Location
    city_code: Mapped[str | None] = mapped_column(String(8), nullable=True)
    district_code: Mapped[str | None] = mapped_column(String(8), nullable=True)
    city: Mapped[str | None] = mapped_column(String(100), nullable=True)
    district: Mapped[str | None] = mapped_column(String(100), nullable=True)

    # Budget
    budget_min: Mapped[int | None] = mapped_column(BigInt, nullable=True)
    budget_max: Mapped[int | None] = mapped_column(BigInt, nullable=True)

    # Area
    area_min: Mapped[float | None] = mapped_column(Float, nullable=True)
    area_max: Mapped[float | None] = mapped_column(Float, nullable=True)

    # Rooms, amenities
    rooms: Mapped[int | None] = mapped_column(Integer, nullable=True)
    bedrooms: Mapped[int | None] = mapped_column(Integer, nullable=True)
    has_parking: Mapped[bool | None] = mapped_column(Boolean, nullable=True)
    has_elevator: Mapped[bool | None] = mapped_column(Boolean, nullable=True)
    has_warehouse: Mapped[bool | None] = mapped_column(Boolean, nullable=True)

    amenities_json: Mapped[str | None] = mapped_column(Text, nullable=True)  # JSON for extra amenities
    special_requirements: Mapped[str | None] = mapped_column(Text, nullable=True)

    status: Mapped[str] = mapped_column(String(32), nullable=False, default="active", server_default="active")

    person: Mapped[Person] = relationship("Person", back_populates="requests")


class Favorite(Base, TenantEntity):
    """Favorite — کاربر ملک را Favorite می‌کند (بند 36)"""

    __tablename__ = "favorites"
    __table_args__ = (
        UniqueConstraint("user_id", "property_id", name="uq_favorites_user_id_property_id"),
        Index("ix_favorites_organization_id_user_id", "organization_id", "user_id"),
        Index("ix_favorites_organization_id_property_id", "organization_id", "property_id"),
    )

    user_id: Mapped[int] = mapped_column(BigInt, nullable=False, index=True)
    property_id: Mapped[int] = mapped_column(
        BigInt, ForeignKey("properties.id", ondelete="CASCADE"), nullable=False, index=True
    )


class SavedSearch(Base, TenantEntity):
    """Saved Search — کاربر جستجو را ذخیره می‌کند (بند 37)

    Matching Property جدید → Notification (آینده)
    """

    __tablename__ = "saved_searches"
    __table_args__ = (
        Index("ix_saved_searches_organization_id_user_id", "organization_id", "user_id"),
        Index("ix_saved_searches_organization_id_is_active", "organization_id", "is_active"),
    )

    user_id: Mapped[int] = mapped_column(BigInt, nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    query_json: Mapped[str] = mapped_column(Text, nullable=False)  # JSON of search params
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True, server_default="1")
