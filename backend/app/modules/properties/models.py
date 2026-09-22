"""Property Domain Models — Layered and Flexible (بند 22-33)

Core + Usage (Mixed Use) + Location + Financial + Media + Extended Attributes
"""
from __future__ import annotations

from sqlalchemy import (
    BigInteger,
    Boolean,
    Float,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.db.mixins import TenantEntity
from app.db.types import BigInt


class Property(Base, TenantEntity):
    """Property Core (بند 22, 32, 33)

    Code یکتا: AB-ISF-MJ-AP-S-2608-00124
    Lifecycle: Draft → Pending Review → Approved → Published → Reserved → Sold/Rented → Archived
    """

    __tablename__ = "properties"
    __table_args__ = (
        UniqueConstraint("organization_id", "code", name="uq_properties_organization_id_code"),
        Index("ix_properties_organization_id_status", "organization_id", "status"),
        Index("ix_properties_organization_id_property_type", "organization_id", "property_type"),
        Index("ix_properties_organization_id_transaction_type", "organization_id", "transaction_type"),
        Index("ix_properties_code", "code"),
        Index("ix_properties_property_type", "property_type"),
        Index("ix_properties_transaction_type", "transaction_type"),
        Index("ix_properties_status", "status"),
    )

    # Human-readable code
    code: Mapped[str] = mapped_column(String(64), nullable=False)  # Index via __table_args__
    code_period: Mapped[str] = mapped_column(String(16), nullable=False)  # e.g. 2608
    code_sequence: Mapped[int] = mapped_column(Integer, nullable=False)

    title: Mapped[str] = mapped_column(String(300), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Types (بند 23, 26)
    property_type: Mapped[str] = mapped_column(String(32), nullable=False)  # apartment, villa, land, etc.
    transaction_type: Mapped[str] = mapped_column(String(32), nullable=False)  # sale, rent, exchange, partnership

    # Lifecycle (بند 33)
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="draft", server_default="draft")

    # Registrant (بند 29)
    registrant_type: Mapped[str] = mapped_column(String(32), nullable=False, default="agent", server_default="agent")
    # owner vs intermediary
    owner_name: Mapped[str | None] = mapped_column(String(200), nullable=True)
    owner_phone: Mapped[str | None] = mapped_column(String(32), nullable=True)
    owner_person_id: Mapped[int | None] = mapped_column(BigInt, nullable=True)  # Future CRM link

    # Area (بند 25) — main fields + flexible via property_sections if needed
    land_area: Mapped[float | None] = mapped_column(Float, nullable=True)
    built_area: Mapped[float | None] = mapped_column(Float, nullable=True)
    useful_area: Mapped[float | None] = mapped_column(Float, nullable=True)
    floor_area: Mapped[float | None] = mapped_column(Float, nullable=True)

    # Physical Characteristics
    rooms: Mapped[int | None] = mapped_column(Integer, nullable=True)
    bedrooms: Mapped[int | None] = mapped_column(Integer, nullable=True)
    bathrooms: Mapped[int | None] = mapped_column(Integer, nullable=True)
    floor_number: Mapped[int | None] = mapped_column(Integer, nullable=True)
    total_floors: Mapped[int | None] = mapped_column(Integer, nullable=True)
    year_built: Mapped[int | None] = mapped_column(Integer, nullable=True)

    # Financial (بند 26, 27, 28)
    price: Mapped[int | None] = mapped_column(BigInteger, nullable=True)  # Sale price (IRR)
    rent_price: Mapped[int | None] = mapped_column(BigInteger, nullable=True)  # Monthly rent
    deposit: Mapped[int | None] = mapped_column(BigInteger, nullable=True)  # Rahn
    currency: Mapped[str] = mapped_column(String(8), nullable=False, default="IRR", server_default="IRR")
    is_exchangeable: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, server_default="0")
    exchange_description: Mapped[str | None] = mapped_column(Text, nullable=True)  # Flexible: car, gold, etc.

    # Partnership (بند 28)
    owner_share: Mapped[float | None] = mapped_column(Float, nullable=True)
    builder_share: Mapped[float | None] = mapped_column(Float, nullable=True)
    partnership_description: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Amenities (بند 15, 25)
    has_parking: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, server_default="0")
    has_elevator: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, server_default="0")
    has_warehouse: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, server_default="0")
    has_balcony: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, server_default="0")
    amenities_json: Mapped[str | None] = mapped_column(Text, nullable=True)  # JSON for extra amenities

    # Legal
    legal_info: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Relationships
    usages: Mapped[list[PropertyUsage]] = relationship(
        "PropertyUsage", back_populates="property", cascade="all, delete-orphan", lazy="selectin"
    )
    location: Mapped[PropertyLocation | None] = relationship(
        "PropertyLocation", back_populates="property", cascade="all, delete-orphan", uselist=False, lazy="selectin"
    )
    media: Mapped[list[PropertyMedia]] = relationship(
        "PropertyMedia", back_populates="property", cascade="all, delete-orphan", lazy="selectin"
    )


class PropertyUsage(Base, TenantEntity):
    """Mixed Use support (بند 24) — ملک می‌تواند همزمان چند Usage داشته باشد"""

    __tablename__ = "property_usages"
    __table_args__ = (
        UniqueConstraint("property_id", "usage_type", name="uq_property_usages_property_id_usage_type"),
        Index("ix_property_usages_organization_id_property_id", "organization_id", "property_id"),
    )

    property_id: Mapped[int] = mapped_column(
        BigInt, ForeignKey("properties.id", ondelete="CASCADE"), nullable=False, index=True
    )
    usage_type: Mapped[str] = mapped_column(String(32), nullable=False)  # residential, commercial, administrative, etc.
    is_primary: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, server_default="0")

    property: Mapped[Property] = relationship("Property", back_populates="usages")


class PropertyLocation(Base, TenantEntity):
    """Location — Public vs Exact Private (بند 30, 61)"""

    __tablename__ = "property_locations"
    __table_args__ = (
        UniqueConstraint("property_id", name="uq_property_locations_property_id"),
        Index("ix_property_locations_organization_id_city_code", "organization_id", "city_code"),
        Index("ix_property_locations_organization_id_district_code", "organization_id", "district_code"),
    )

    property_id: Mapped[int] = mapped_column(
        BigInt, ForeignKey("properties.id", ondelete="CASCADE"), nullable=False, index=True
    )

    city: Mapped[str | None] = mapped_column(String(100), nullable=True)
    city_code: Mapped[str | None] = mapped_column(String(8), nullable=True)  # ISF
    district: Mapped[str | None] = mapped_column(String(100), nullable=True)
    district_code: Mapped[str | None] = mapped_column(String(8), nullable=True)  # MJ
    neighborhood: Mapped[str | None] = mapped_column(String(100), nullable=True)

    # Public controlled location
    public_lat: Mapped[float | None] = mapped_column(Float, nullable=True)
    public_lng: Mapped[float | None] = mapped_column(Float, nullable=True)

    # Private exact address — never public (بند 30, 61)
    exact_address: Mapped[str | None] = mapped_column(Text, nullable=True)
    postal_code: Mapped[str | None] = mapped_column(String(20), nullable=True)

    property: Mapped[Property] = relationship("Property", back_populates="location")


class PropertyMedia(Base, TenantEntity):
    """Media — Images, Videos, Documents with abstraction (بند 31)"""

    __tablename__ = "property_media"
    __table_args__ = (
        Index("ix_property_media_organization_id_property_id", "organization_id", "property_id"),
        Index("ix_property_media_property_id_sort_order", "property_id", "sort_order"),
    )

    property_id: Mapped[int] = mapped_column(
        BigInt, ForeignKey("properties.id", ondelete="CASCADE"), nullable=False, index=True
    )

    file_path: Mapped[str] = mapped_column(String(500), nullable=False)
    file_name: Mapped[str] = mapped_column(String(200), nullable=False)
    file_type: Mapped[str] = mapped_column(String(20), nullable=False)  # image, video, document
    mime_type: Mapped[str | None] = mapped_column(String(100), nullable=True)
    size_bytes: Mapped[int | None] = mapped_column(Integer, nullable=True)
    is_primary: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, server_default="0")
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default="0")
    storage_backend: Mapped[str] = mapped_column(String(20), nullable=False, default="filesystem", server_default="filesystem")

    property: Mapped[Property] = relationship("Property", back_populates="media")
