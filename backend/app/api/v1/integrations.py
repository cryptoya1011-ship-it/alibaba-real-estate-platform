"""Integrations API — Phase 15

Endpoints for Telegram, SMS, Listings (Divar/Sheypoor), Payment, Maps, Logs
Tenant-aware, permissions integration:*
"""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db, get_tenant_context, require_permission
from app.core.permissions import (
    INTEGRATION_LISTINGS,
    INTEGRATION_LOGS,
    INTEGRATION_MAPS,
    INTEGRATION_PAYMENT,
    INTEGRATION_SMS,
    INTEGRATION_TELEGRAM,
)
from app.core.responses import ok, page_meta
from app.modules.integrations.schemas import (
    ListingPublishRequest,
    ListingUnpublishRequest,
    MapsDistanceRequest,
    MapsGeocodeRequest,
    MapsReverseGeocodeRequest,
    PaymentCreateRequest,
    SmsOtpRequest,
    SmsSendRequest,
    TelegramSendRequest,
)
from app.modules.integrations.service import IntegrationService

router = APIRouter(prefix="/integrations", tags=["integrations"])


# Providers status — public within org, permission telegram or manage
@router.get("/providers", summary="لیست Integration Providers — وضعیت فعلی و کلیدها")
async def list_providers(
    ctx=Depends(get_tenant_context),
    session: Annotated[AsyncSession, Depends(get_db)] = None,
):
    # Any authenticated user can see providers
    svc = IntegrationService(session)
    data = await svc.get_providers()
    return ok(data)


# Telegram
@router.post("/telegram/send", summary="ارسال پیام تلگرام — Telegram")
async def telegram_send(
    payload: TelegramSendRequest,
    ctx=Depends(get_tenant_context),
    perm=Depends(require_permission(INTEGRATION_TELEGRAM)),
    session: Annotated[AsyncSession, Depends(get_db)] = None,
):
    svc = IntegrationService(session)
    result = await svc.send_telegram(payload.chat_id, payload.text, payload.parse_mode, payload.use_provider)
    return ok(result)


@router.post("/telegram/send-property/{property_id}", summary="ارسال کارت ملک در تلگرام")
async def telegram_send_property(
    property_id: int,
    body: dict,
    ctx=Depends(get_tenant_context),
    perm=Depends(require_permission(INTEGRATION_TELEGRAM)),
    session: Annotated[AsyncSession, Depends(get_db)] = None,
):
    chat_id = body.get("chat_id")
    if not chat_id:
        from app.core.errors import ValidationError

        raise ValidationError("chat_id الزامی است")
    svc = IntegrationService(session)
    result = await svc.send_property_via_telegram(str(chat_id), property_id)
    return ok(result)


@router.get("/telegram/deep-link", summary="ساخت Deep Link تلگرام")
async def telegram_deep_link(
    payload: str = Query(..., min_length=1, max_length=200),
    ctx=Depends(get_tenant_context),
    session: Annotated[AsyncSession, Depends(get_db)] = None,
):
    svc = IntegrationService(session)
    result = await svc.create_deep_link(payload)
    return ok(result)


# SMS
@router.post("/sms/send", summary="ارسال SMS")
async def sms_send(
    payload: SmsSendRequest,
    ctx=Depends(get_tenant_context),
    perm=Depends(require_permission(INTEGRATION_SMS)),
    session: Annotated[AsyncSession, Depends(get_db)] = None,
):
    svc = IntegrationService(session)
    result = await svc.send_sms(payload.phone, payload.message)
    return ok(result)


@router.post("/sms/otp", summary="ارسال OTP via SMS")
async def sms_otp(
    payload: SmsOtpRequest,
    ctx=Depends(get_tenant_context),
    perm=Depends(require_permission(INTEGRATION_SMS)),
    session: Annotated[AsyncSession, Depends(get_db)] = None,
):
    svc = IntegrationService(session)
    result = await svc.send_otp(payload.phone, payload.code)
    return ok(result)


# Listings — Divar / Sheypoor
@router.post("/listings/publish", summary="انتشار ملک در دیوار/شیپور")
async def listings_publish(
    payload: ListingPublishRequest,
    ctx=Depends(get_tenant_context),
    perm=Depends(require_permission(INTEGRATION_LISTINGS)),
    session: Annotated[AsyncSession, Depends(get_db)] = None,
):
    svc = IntegrationService(session)
    result = await svc.publish_listing(payload.platform, payload.property_id)
    return ok(result)


@router.post("/listings/unpublish", summary="حذف آگهی از دیوار/شیپور")
async def listings_unpublish(
    payload: ListingUnpublishRequest,
    ctx=Depends(get_tenant_context),
    perm=Depends(require_permission(INTEGRATION_LISTINGS)),
    session: Annotated[AsyncSession, Depends(get_db)] = None,
):
    svc = IntegrationService(session)
    result = await svc.unpublish_listing(payload.platform, payload.external_id)
    return ok(result)


# Payment
@router.post("/payment/create", summary="ایجاد لینک پرداخت")
async def payment_create(
    payload: PaymentCreateRequest,
    ctx=Depends(get_tenant_context),
    perm=Depends(require_permission(INTEGRATION_PAYMENT)),
    session: Annotated[AsyncSession, Depends(get_db)] = None,
):
    svc = IntegrationService(session)
    result = await svc.create_payment(payload.amount, payload.description, payload.callback_url, payload.metadata)
    return ok(result)


@router.get("/payment/verify/{payment_id}", summary="تایید پرداخت")
async def payment_verify(
    payment_id: str,
    ctx=Depends(get_tenant_context),
    perm=Depends(require_permission(INTEGRATION_PAYMENT)),
    session: Annotated[AsyncSession, Depends(get_db)] = None,
):
    svc = IntegrationService(session)
    result = await svc.verify_payment(payment_id)
    return ok(result)


# Maps — OSM / Mock
@router.post("/maps/geocode", summary="Geocode آدرس → lat/lng — OpenStreetMap")
async def maps_geocode(
    payload: MapsGeocodeRequest,
    ctx=Depends(get_tenant_context),
    perm=Depends(require_permission(INTEGRATION_MAPS)),
    session: Annotated[AsyncSession, Depends(get_db)] = None,
):
    svc = IntegrationService(session)
    result = await svc.geocode(payload.address)
    return ok(result)


@router.post("/maps/reverse-geocode", summary="Reverse Geocode lat/lng → آدرس")
async def maps_reverse_geocode(
    payload: MapsReverseGeocodeRequest,
    ctx=Depends(get_tenant_context),
    perm=Depends(require_permission(INTEGRATION_MAPS)),
    session: Annotated[AsyncSession, Depends(get_db)] = None,
):
    svc = IntegrationService(session)
    result = await svc.reverse_geocode(payload.lat, payload.lng)
    return ok(result)


@router.get("/maps/static-map", summary="URL نقشه ایستا — OSM")
async def maps_static_map(
    lat: float = Query(...),
    lng: float = Query(...),
    zoom: int = Query(default=15, ge=1, le=20),
    ctx=Depends(get_tenant_context),
    session: Annotated[AsyncSession, Depends(get_db)] = None,
):
    svc = IntegrationService(session)
    result = await svc.get_static_map(lat, lng, zoom)
    return ok(result)


@router.post("/maps/distance", summary="محاسبه فاصله بین دو نقطه")
async def maps_distance(
    payload: MapsDistanceRequest,
    ctx=Depends(get_tenant_context),
    perm=Depends(require_permission(INTEGRATION_MAPS)),
    session: Annotated[AsyncSession, Depends(get_db)] = None,
):
    svc = IntegrationService(session)
    result = await svc.calculate_distance(payload.lat1, payload.lng1, payload.lat2, payload.lng2)
    return ok(result)


# Logs
@router.get("/logs", summary="لاگ‌های Integration — Audit")
async def list_logs(
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    provider: str | None = Query(default=None),
    status: str | None = Query(default=None),
    ctx=Depends(get_tenant_context),
    perm=Depends(require_permission(INTEGRATION_LOGS)),
    session: Annotated[AsyncSession, Depends(get_db)] = None,
):
    svc = IntegrationService(session)
    rows, total = await svc.list_logs(limit=limit, offset=offset, provider=provider, status=status)
    data = [
        {
            "id": r.id,
            "provider": r.provider,
            "action": r.action,
            "entity_type": r.entity_type,
            "entity_id": r.entity_id,
            "status": r.status,
            "external_id": r.external_id,
            "external_url": r.external_url,
            "error_message": r.error_message,
            "created_at": r.created_at.isoformat() if r.created_at else None,
        }
        for r in rows
    ]
    return ok(data, page_meta(total=total, limit=limit, offset=offset))
