"""Notification Schemas — بند 41, 82"""
from __future__ import annotations

from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field


class NotificationCreate(BaseModel):
    user_id: int
    channel: str = "in_app"
    priority: str = "normal"
    title: str = Field(..., max_length=300)
    body: str | None = None
    entity_type: str | None = None
    entity_id: int | None = None
    data: dict[str, Any] | None = None


class NotificationUpdate(BaseModel):
    is_read: bool | None = None
    version: int | None = None


class NotificationResponse(BaseModel):
    id: int
    organization_id: int
    user_id: int
    channel: str
    priority: str
    title: str
    body: str | None
    entity_type: str | None
    entity_id: int | None
    data_json: str | None
    is_read: bool
    read_at: datetime | None
    version: int
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}

    @property
    def data(self) -> dict[str, Any] | None:
        import json

        if not self.data_json:
            return None
        try:
            return json.loads(self.data_json)
        except Exception:
            return None
