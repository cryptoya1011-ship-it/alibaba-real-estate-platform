"""Deal Schemas — بند 39, 40"""
from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field

DealStatus = Literal[
    "lead",
    "qualification",
    "property_match",
    "visit",
    "negotiation",
    "agreement",
    "closed_won",
    "closed_lost",
    "archived",
]

CommissionStatus = Literal["pending", "partially_paid", "paid", "cancelled"]


class DealCreate(BaseModel):
    title: str = Field(..., max_length=300)
    description: str | None = None
    customer_id: int
    property_id: int | None = None
    agent_id: int | None = None
    amount: int | None = Field(default=None, ge=0)
    commission_total: int | None = Field(default=None, ge=0)
    commission_agent_share: int | None = Field(default=None, ge=0)
    commission_office_share: int | None = Field(default=None, ge=0)
    commission_referral_share: int | None = Field(default=None, ge=0)
    commission_status: CommissionStatus | None = None
    notes: str | None = None
    status: DealStatus = "lead"


class DealUpdate(BaseModel):
    title: str | None = Field(default=None, max_length=300)
    description: str | None = None
    customer_id: int | None = None
    property_id: int | None = None
    agent_id: int | None = None
    amount: int | None = Field(default=None, ge=0)
    commission_total: int | None = Field(default=None, ge=0)
    commission_agent_share: int | None = Field(default=None, ge=0)
    commission_office_share: int | None = Field(default=None, ge=0)
    commission_referral_share: int | None = Field(default=None, ge=0)
    commission_status: CommissionStatus | None = None
    notes: str | None = None
    loss_reason: str | None = None
    status: DealStatus | None = None
    version: int


class DealResponse(BaseModel):
    id: int
    organization_id: int
    code: str
    code_period: str
    code_sequence: int
    title: str
    description: str | None
    status: str
    customer_id: int
    property_id: int | None
    agent_id: int | None
    amount: int | None
    commission_total: int | None
    commission_agent_share: int | None
    commission_office_share: int | None
    commission_referral_share: int | None
    commission_status: str | None
    notes: str | None
    loss_reason: str | None
    version: int
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class DealHistoryResponse(BaseModel):
    id: int
    deal_id: int
    from_status: str | None
    to_status: str
    changed_by: int | None
    notes: str | None
    created_at: datetime

    model_config = {"from_attributes": True}
