"""CRM Schemas — بند 34-37"""
from __future__ import annotations

from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, Field

PersonRoleType = Literal[
    "owner",
    "buyer",
    "tenant",
    "seller",
    "investor",
    "landlord",
    "developer",
    "intermediary",
]


# --- Person ---

class PersonRoleCreate(BaseModel):
    role: PersonRoleType


class PersonRoleResponse(BaseModel):
    role: str

    model_config = {"from_attributes": True}


class PersonCreate(BaseModel):
    first_name: str = Field(..., max_length=100)
    last_name: str | None = Field(default=None, max_length=100)
    phone: str | None = Field(default=None, max_length=32)
    email: str | None = Field(default=None, max_length=200)
    national_id: str | None = Field(default=None, max_length=20)
    notes: str | None = None
    roles: list[PersonRoleType] | None = None  # Initial roles


class PersonUpdate(BaseModel):
    first_name: str | None = Field(default=None, max_length=100)
    last_name: str | None = Field(default=None, max_length=100)
    phone: str | None = Field(default=None, max_length=32)
    email: str | None = Field(default=None, max_length=200)
    national_id: str | None = Field(default=None, max_length=20)
    notes: str | None = None
    version: int


class PersonResponse(BaseModel):
    id: int
    organization_id: int
    first_name: str
    last_name: str | None
    phone: str | None
    email: str | None
    national_id: str | None
    notes: str | None
    version: int
    created_at: datetime
    updated_at: datetime
    roles: list[PersonRoleResponse] = []

    model_config = {"from_attributes": True}


# --- Customer Request ---

class CustomerRequestCreate(BaseModel):
    person_id: int
    transaction_type: str | None = None
    property_type: str | None = None
    city_code: str | None = Field(default=None, max_length=8)
    district_code: str | None = Field(default=None, max_length=8)
    city: str | None = None
    district: str | None = None
    budget_min: int | None = Field(default=None, ge=0)
    budget_max: int | None = Field(default=None, ge=0)
    area_min: float | None = Field(default=None, ge=0)
    area_max: float | None = Field(default=None, ge=0)
    rooms: int | None = Field(default=None, ge=0)
    bedrooms: int | None = Field(default=None, ge=0)
    has_parking: bool | None = None
    has_elevator: bool | None = None
    has_warehouse: bool | None = None
    amenities: dict[str, Any] | None = None
    special_requirements: str | None = None
    status: str = "active"


class CustomerRequestUpdate(BaseModel):
    transaction_type: str | None = None
    property_type: str | None = None
    city_code: str | None = None
    district_code: str | None = None
    city: str | None = None
    district: str | None = None
    budget_min: int | None = Field(default=None, ge=0)
    budget_max: int | None = Field(default=None, ge=0)
    area_min: float | None = Field(default=None, ge=0)
    area_max: float | None = Field(default=None, ge=0)
    rooms: int | None = Field(default=None, ge=0)
    bedrooms: int | None = Field(default=None, ge=0)
    has_parking: bool | None = None
    has_elevator: bool | None = None
    has_warehouse: bool | None = None
    amenities: dict[str, Any] | None = None
    special_requirements: str | None = None
    status: str | None = None
    version: int


class CustomerRequestResponse(BaseModel):
    id: int
    organization_id: int
    person_id: int
    transaction_type: str | None
    property_type: str | None
    city_code: str | None
    district_code: str | None
    city: str | None
    district: str | None
    budget_min: int | None
    budget_max: int | None
    area_min: float | None
    area_max: float | None
    rooms: int | None
    bedrooms: int | None
    has_parking: bool | None
    has_elevator: bool | None
    has_warehouse: bool | None
    amenities_json: str | None
    special_requirements: str | None
    status: str
    version: int
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


# --- Favorite ---

class FavoriteCreate(BaseModel):
    property_id: int


class FavoriteResponse(BaseModel):
    id: int
    organization_id: int
    user_id: int
    property_id: int
    created_at: datetime

    model_config = {"from_attributes": True}


# --- Saved Search ---

class SavedSearchCreate(BaseModel):
    name: str = Field(..., max_length=200)
    query: dict[str, Any]  # Structured search params
    is_active: bool = True


class SavedSearchUpdate(BaseModel):
    name: str | None = Field(default=None, max_length=200)
    query: dict[str, Any] | None = None
    is_active: bool | None = None
    version: int


class SavedSearchResponse(BaseModel):
    id: int
    organization_id: int
    user_id: int
    name: str
    query_json: str
    is_active: bool
    version: int
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}

    @property
    def query(self) -> dict[str, Any]:
        import json

        try:
            return json.loads(self.query_json)
        except Exception:
            return {}
