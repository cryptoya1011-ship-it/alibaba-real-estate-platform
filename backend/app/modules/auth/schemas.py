from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class TelegramLoginRequest(BaseModel):
    init_data: str = Field(min_length=1, description="Raw Telegram.WebApp.initData string")
    organization_id: int | None = Field(default=None, description="Optional active organization")


class DevLoginRequest(BaseModel):
    telegram_id: int = Field(gt=0)
    first_name: str | None = None
    organization_id: int | None = None


class OrganizationBrief(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    slug: str
    is_owner: bool = False


class UserBrief(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    telegram_id: int | None
    display_name: str
    is_super_admin: bool


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_at: datetime
    user: UserBrief
    organization_id: int | None
    branch_id: int | None
    roles: list[str]
    permissions: list[str]
    organizations: list[OrganizationBrief]


class SelectOrganizationRequest(BaseModel):
    organization_id: int
    branch_id: int | None = None
