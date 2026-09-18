from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, field_validator


class OrganizationCreate(BaseModel):
    name: str = Field(min_length=2, max_length=200)
    slug: str = Field(min_length=2, max_length=64, pattern=r"^[a-z0-9][a-z0-9-]*$")
    city_code: str | None = Field(default=None, max_length=8)
    phone: str | None = Field(default=None, max_length=32)

    @field_validator("name", "slug")
    @classmethod
    def _strip(cls, value: str) -> str:
        return value.strip()


class OrganizationUpdate(BaseModel):
    version: int = Field(ge=1, description="Optimistic locking version")
    name: str | None = Field(default=None, min_length=2, max_length=200)
    city_code: str | None = Field(default=None, max_length=8)
    phone: str | None = Field(default=None, max_length=32)


class OrganizationOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    slug: str
    city_code: str | None
    phone: str | None
    is_active: bool
    version: int
    created_at: datetime


class BranchCreate(BaseModel):
    name: str = Field(min_length=2, max_length=200)
    code: str = Field(min_length=1, max_length=32)
    address: str | None = Field(default=None, max_length=500)
    is_main: bool = False


class BranchOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    organization_id: int
    name: str
    code: str
    address: str | None
    is_main: bool
    is_active: bool
    version: int
