"""Visit Schemas — بند 38"""
from __future__ import annotations

from datetime import date, datetime, time

from pydantic import BaseModel, Field


class VisitCreate(BaseModel):
    property_id: int
    customer_id: int  # person_id
    agent_id: int | None = None
    visit_date: date
    visit_time: time | None = None
    status: str = "scheduled"
    notes: str | None = None
    follow_up_notes: str | None = None
    result: str | None = None


class VisitUpdate(BaseModel):
    property_id: int | None = None
    customer_id: int | None = None
    agent_id: int | None = None
    visit_date: date | None = None
    visit_time: time | None = None
    status: str | None = None
    notes: str | None = None
    follow_up_notes: str | None = None
    result: str | None = None
    version: int


class VisitResponse(BaseModel):
    id: int
    organization_id: int
    property_id: int
    customer_id: int
    agent_id: int | None
    visit_date: date
    visit_time: time | None
    status: str
    notes: str | None
    follow_up_notes: str | None
    result: str | None
    version: int
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
