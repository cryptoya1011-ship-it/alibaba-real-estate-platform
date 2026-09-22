"""Integration Schemas — Phase 15"""

from __future__ import annotations

from typing import Any

from pydantic import BaseModel, Field


class TelegramSendRequest(BaseModel):
    chat_id: str = Field(..., description="Telegram chat_id or @username")
    text: str = Field(..., min_length=1, max_length=4096)
    parse_mode: str = Field(default="HTML")
    use_provider: str | None = None


class SmsSendRequest(BaseModel):
    phone: str = Field(..., min_length=7, max_length=20)
    message: str = Field(..., min_length=1, max_length=1000)
    use_provider: str | None = None


class SmsOtpRequest(BaseModel):
    phone: str = Field(..., min_length=7, max_length=20)
    code: str | None = Field(default=None, max_length=10)


class ListingPublishRequest(BaseModel):
    platform: str = Field(..., description="divar or sheypoor")
    property_id: int
    use_provider: str | None = None


class ListingUnpublishRequest(BaseModel):
    platform: str
    external_id: str


class PaymentCreateRequest(BaseModel):
    amount: int = Field(..., gt=0, description="Amount in IRR")
    description: str = Field(..., min_length=1, max_length=500)
    callback_url: str | None = Field(default=None)
    metadata: dict[str, Any] | None = None
    use_provider: str | None = None


class MapsGeocodeRequest(BaseModel):
    address: str = Field(..., min_length=2, max_length=500)
    use_provider: str | None = None


class MapsReverseGeocodeRequest(BaseModel):
    lat: float = Field(..., ge=-90, le=90)
    lng: float = Field(..., ge=-180, le=180)
    use_provider: str | None = None


class MapsDistanceRequest(BaseModel):
    lat1: float
    lng1: float
    lat2: float
    lng2: float
