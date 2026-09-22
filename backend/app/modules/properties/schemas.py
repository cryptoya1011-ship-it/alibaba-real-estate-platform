"""Pydantic Schemas for Property Domain — Public vs Internal DTOs (بند 61)"""
from __future__ import annotations

from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, Field


PropertyType = Literal[
    "residential",
    "apartment",
    "villa",
    "garden",
    "commercial",
    "office",
    "administrative",
    "land",
    "industrial",
    "mixed_use",
]

TransactionType = Literal["sale", "rent", "exchange", "partnership"]

PropertyStatus = Literal[
    "draft",
    "pending_review",
    "approved",
    "published",
    "reserved",
    "sold",
    "rented",
    "archived",
]

RegistrantType = Literal["owner", "intermediary", "agent", "office_staff"]

UsageType = Literal["residential", "commercial", "administrative", "industrial", "garden", "office"]


# --- Location ---

class LocationCreate(BaseModel):
    city: str | None = None
    city_code: str | None = Field(default=None, max_length=8, description="ISF")
    district: str | None = None
    district_code: str | None = Field(default=None, max_length=8, description="MJ")
    neighborhood: str | None = None
    public_lat: float | None = None
    public_lng: float | None = None
    exact_address: str | None = None  # Private
    postal_code: str | None = None


class LocationResponse(BaseModel):
    city: str | None
    city_code: str | None
    district: str | None
    district_code: str | None
    neighborhood: str | None
    public_lat: float | None
    public_lng: float | None
    # exact_address only if permission property:address:read
    exact_address: str | None = None
    postal_code: str | None = None

    model_config = {"from_attributes": True}


# --- Usage ---

class UsageCreate(BaseModel):
    usage_type: UsageType
    is_primary: bool = False


class UsageResponse(BaseModel):
    usage_type: str
    is_primary: bool

    model_config = {"from_attributes": True}


# --- Media ---

class MediaResponse(BaseModel):
    id: int
    file_path: str
    file_name: str
    file_type: str
    mime_type: str | None
    is_primary: bool
    sort_order: int

    model_config = {"from_attributes": True}


# --- Property Create / Update ---

class PropertyCreate(BaseModel):
    title: str = Field(..., max_length=300)
    description: str | None = None
    property_type: PropertyType
    transaction_type: TransactionType
    status: PropertyStatus = "draft"
    registrant_type: RegistrantType = "agent"

    # Area
    land_area: float | None = Field(default=None, ge=0)
    built_area: float | None = Field(default=None, ge=0)
    useful_area: float | None = Field(default=None, ge=0)
    floor_area: float | None = Field(default=None, ge=0)

    # Physical
    rooms: int | None = Field(default=None, ge=0)
    bedrooms: int | None = Field(default=None, ge=0)
    bathrooms: int | None = Field(default=None, ge=0)
    floor_number: int | None = None
    total_floors: int | None = None
    year_built: int | None = None

    # Financial
    price: int | None = Field(default=None, ge=0, description="Sale price IRR")
    rent_price: int | None = Field(default=None, ge=0)
    deposit: int | None = Field(default=None, ge=0)
    currency: str = "IRR"
    is_exchangeable: bool = False
    exchange_description: str | None = None

    # Partnership
    owner_share: float | None = Field(default=None, ge=0, le=100)
    builder_share: float | None = Field(default=None, ge=0, le=100)
    partnership_description: str | None = None

    # Owner (بند 29 — اگر Intermediary باشد لازم نیست)
    owner_name: str | None = Field(default=None, max_length=200)
    owner_phone: str | None = Field(default=None, max_length=32)
    owner_person_id: int | None = None

    # Amenities
    has_parking: bool = False
    has_elevator: bool = False
    has_warehouse: bool = False
    has_balcony: bool = False
    amenities: dict[str, Any] | None = None

    legal_info: str | None = None

    # Nested
    usages: list[UsageCreate] | None = None
    location: LocationCreate | None = None


class PropertyUpdate(BaseModel):
    title: str | None = Field(default=None, max_length=300)
    description: str | None = None
    property_type: PropertyType | None = None
    transaction_type: TransactionType | None = None
    status: PropertyStatus | None = None
    registrant_type: RegistrantType | None = None

    land_area: float | None = Field(default=None, ge=0)
    built_area: float | None = Field(default=None, ge=0)
    useful_area: float | None = Field(default=None, ge=0)
    floor_area: float | None = Field(default=None, ge=0)

    rooms: int | None = Field(default=None, ge=0)
    bedrooms: int | None = Field(default=None, ge=0)
    bathrooms: int | None = Field(default=None, ge=0)
    floor_number: int | None = None
    total_floors: int | None = None
    year_built: int | None = None

    price: int | None = Field(default=None, ge=0)
    rent_price: int | None = Field(default=None, ge=0)
    deposit: int | None = Field(default=None, ge=0)
    currency: str | None = None
    is_exchangeable: bool | None = None
    exchange_description: str | None = None

    owner_share: float | None = Field(default=None, ge=0, le=100)
    builder_share: float | None = Field(default=None, ge=0, le=100)
    partnership_description: str | None = None

    owner_name: str | None = None
    owner_phone: str | None = None
    owner_person_id: int | None = None

    has_parking: bool | None = None
    has_elevator: bool | None = None
    has_warehouse: bool | None = None
    has_balcony: bool | None = None
    amenities: dict[str, Any] | None = None
    legal_info: str | None = None

    usages: list[UsageCreate] | None = None
    location: LocationCreate | None = None

    version: int = Field(..., description="Optimistic locking version")


# --- Property Response (Internal vs Public) ---

class PropertyBaseResponse(BaseModel):
    id: int
    organization_id: int
    branch_id: int | None
    code: str
    code_period: str
    code_sequence: int
    title: str
    description: str | None
    property_type: str
    transaction_type: str
    status: str
    registrant_type: str

    land_area: float | None
    built_area: float | None
    useful_area: float | None
    floor_area: float | None

    rooms: int | None
    bedrooms: int | None
    bathrooms: int | None
    floor_number: int | None
    total_floors: int | None
    year_built: int | None

    price: int | None
    rent_price: int | None
    deposit: int | None
    currency: str
    is_exchangeable: bool
    exchange_description: str | None

    owner_share: float | None
    builder_share: float | None

    has_parking: bool
    has_elevator: bool
    has_warehouse: bool
    has_balcony: bool
    amenities_json: str | None

    version: int
    created_at: datetime
    updated_at: datetime

    usages: list[UsageResponse] = []
    location: LocationResponse | None = None
    media: list[MediaResponse] = []

    model_config = {"from_attributes": True}


class PropertyInternalResponse(PropertyBaseResponse):
    """Internal DTO — includes private fields if permission granted"""

    owner_name: str | None = None
    owner_phone: str | None = None
    owner_person_id: int | None = None
    legal_info: str | None = None
    # location.exact_address included if has property:address:read


class PropertyPublicResponse(PropertyBaseResponse):
    """Public DTO — never includes private fields (بند 61)"""

    # No owner info, no exact address, no legal_info
    pass


# For list with pagination
class PropertyListItem(BaseModel):
    id: int
    code: str
    title: str
    property_type: str
    transaction_type: str
    status: str
    price: int | None
    rent_price: int | None
    land_area: float | None
    built_area: float | None
    rooms: int | None
    has_parking: bool
    has_elevator: bool
    city: str | None = None
    district: str | None = None
    city_code: str | None = None
    district_code: str | None = None
    primary_image: str | None = None
    created_at: datetime

    model_config = {"from_attributes": True}
