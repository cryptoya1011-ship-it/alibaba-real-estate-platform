"""Integration Service — Phase 15

Core جدا از Integration:
- Uses adapter factories
- Logs every external call via IntegrationLogRepository
- Tenant-aware
- No direct dependency on external SDK — adapter abstracts
"""

from __future__ import annotations

import json
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import NotFoundError, ValidationError
from app.modules.properties.repository import PropertyRepository

from .adapter import (
    get_all_providers_status,
    get_listing_provider,
    get_maps_provider,
    get_payment_provider,
    get_sms_provider,
    get_telegram_provider,
)
from .repository import IntegrationLogRepository


class IntegrationService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session
        self.logs = IntegrationLogRepository(session)
        self.properties = PropertyRepository(session)

    async def get_providers(self) -> dict[str, Any]:
        return get_all_providers_status()

    async def send_telegram(self, chat_id: str, text: str, parse_mode: str = "HTML", use_provider: str | None = None) -> dict[str, Any]:
        if not text or len(text.strip()) < 1:
            raise ValidationError("متن پیام الزامی است")

        provider = get_telegram_provider()
        try:
            result = await provider.send_message(chat_id, text, parse_mode)
            # Log
            await self.logs.create_log(
                provider=f"telegram_{result.get('provider','mock')}",
                action="send_message",
                request_payload=json.dumps({"chat_id": chat_id, "text": text[:500]}, ensure_ascii=False),
                response_payload=json.dumps(result, ensure_ascii=False),
                status="success" if result.get("success") else "failed",
                external_id=str(result.get("message_id", "")),
            )
            await self.session.flush()
            return result
        except Exception as e:
            await self.logs.create_log(
                provider="telegram",
                action="send_message",
                request_payload=json.dumps({"chat_id": chat_id, "text": text[:200]}, ensure_ascii=False),
                response_payload=None,
                status="failed",
                error_message=str(e),
            )
            await self.session.flush()
            raise

    async def send_property_via_telegram(self, chat_id: str, property_id: int) -> dict[str, Any]:
        prop = await self.properties.get(property_id)
        if prop is None:
            raise NotFoundError("ملک یافت نشد")

        prop_data = {
            "id": prop.id,
            "code": prop.code,
            "title": prop.title,
            "price": prop.price,
            "property_type": prop.property_type,
        }
        provider = get_telegram_provider()
        result = await provider.send_property_card(chat_id, prop_data)

        await self.logs.create_log(
            provider=f"telegram_{result.get('provider','mock')}",
            action="send_property_card",
            entity_type="property",
            entity_id=prop.id,
            request_payload=json.dumps({"chat_id": chat_id, "property_id": property_id}, ensure_ascii=False),
            response_payload=json.dumps(result, ensure_ascii=False),
            status="success",
            external_id=str(result.get("message_id", "")),
        )
        await self.session.flush()
        return result

    async def create_deep_link(self, payload: str) -> dict[str, Any]:
        provider = get_telegram_provider()
        link = await provider.create_deep_link(payload)
        return {"deep_link": link, "payload": payload, "provider": provider.name}

    async def send_sms(self, phone: str, message: str) -> dict[str, Any]:
        if not phone or len(phone) < 7:
            raise ValidationError("شماره موبایل نامعتبر")
        provider = get_sms_provider()
        result = await provider.send_sms(phone, message)

        await self.logs.create_log(
            provider=f"sms_{result.get('provider','mock')}",
            action="send_sms",
            request_payload=json.dumps({"phone": phone, "message": message[:200]}, ensure_ascii=False),
            response_payload=json.dumps(result, ensure_ascii=False),
            status="success" if result.get("success") else "failed",
            external_id=result.get("message_id"),
        )
        await self.session.flush()
        return result

    async def send_otp(self, phone: str, code: str | None = None) -> dict[str, Any]:
        import random

        if code is None:
            code = str(random.randint(100000, 999999))

        provider = get_sms_provider()
        result = await provider.send_otp(phone, code)

        await self.logs.create_log(
            provider=f"sms_{result.get('provider','mock')}",
            action="send_otp",
            request_payload=json.dumps({"phone": phone, "code": "***"}, ensure_ascii=False),
            response_payload=json.dumps(result, ensure_ascii=False),
            status="success",
            external_id=result.get("message_id"),
        )
        await self.session.flush()
        return {**result, "code": code, "note": "code returned only in mock mode, in prod don't return"}

    async def publish_listing(self, platform: str, property_id: int) -> dict[str, Any]:
        platform = platform.lower()
        if platform not in ("divar", "sheypoor"):
            raise ValidationError("پلتفرم باید divar یا sheypoor باشد")

        prop = await self.properties.get(property_id)
        if prop is None:
            raise NotFoundError("ملک یافت نشد")

        city_code = None
        district_code = None
        if prop.location:
            city_code = prop.location.city_code
            district_code = prop.location.district_code

        prop_data = {
            "id": prop.id,
            "code": prop.code,
            "title": prop.title,
            "description": prop.description,
            "property_type": prop.property_type,
            "transaction_type": prop.transaction_type,
            "price": prop.price,
            "built_area": prop.built_area,
            "land_area": prop.land_area,
            "rooms": prop.rooms,
            "city_code": city_code,
            "district_code": district_code,
        }

        provider = get_listing_provider(platform)
        result = await provider.publish(platform, prop_data)

        await self.logs.create_log(
            provider=f"{platform}_{result.get('provider','mock')}",
            action="publish",
            entity_type="property",
            entity_id=prop.id,
            request_payload=json.dumps({"platform": platform, "property_id": property_id}, ensure_ascii=False),
            response_payload=json.dumps(result, ensure_ascii=False),
            status="success" if result.get("success") else "failed",
            external_id=result.get("external_id"),
            external_url=result.get("url"),
        )
        await self.session.flush()
        return result

    async def unpublish_listing(self, platform: str, external_id: str) -> dict[str, Any]:
        provider = get_listing_provider(platform)
        result = await provider.unpublish(platform, external_id)

        await self.logs.create_log(
            provider=f"{platform}_{result.get('provider','mock')}",
            action="unpublish",
            request_payload=json.dumps({"platform": platform, "external_id": external_id}, ensure_ascii=False),
            response_payload=json.dumps(result, ensure_ascii=False),
            status="success",
            external_id=external_id,
        )
        await self.session.flush()
        return result

    async def create_payment(self, amount: int, description: str, callback_url: str | None = None, metadata: dict | None = None) -> dict[str, Any]:
        if amount <= 0:
            raise ValidationError("مبلغ باید مثبت باشد")

        provider = get_payment_provider()
        cb_url = callback_url or "https://arep.local/payment/callback"
        result = await provider.create_payment(amount, description, cb_url, metadata)

        await self.logs.create_log(
            provider=f"payment_{result.get('provider','mock')}",
            action="create_payment",
            request_payload=json.dumps({"amount": amount, "description": description}, ensure_ascii=False),
            response_payload=json.dumps(result, ensure_ascii=False),
            status="success" if result.get("success") else "failed",
            external_id=result.get("payment_id"),
            external_url=result.get("payment_url"),
        )
        await self.session.flush()
        return result

    async def verify_payment(self, payment_id: str) -> dict[str, Any]:
        provider = get_payment_provider()
        result = await provider.verify_payment(payment_id)

        await self.logs.create_log(
            provider=f"payment_{result.get('provider','mock')}",
            action="verify_payment",
            request_payload=json.dumps({"payment_id": payment_id}, ensure_ascii=False),
            response_payload=json.dumps(result, ensure_ascii=False),
            status="success",
            external_id=payment_id,
        )
        await self.session.flush()
        return result

    async def geocode(self, address: str) -> dict[str, Any]:
        if not address or len(address.strip()) < 2:
            raise ValidationError("آدرس خیلی کوتاه است")

        provider = get_maps_provider()
        result = await provider.geocode(address)

        await self.logs.create_log(
            provider=f"maps_{result.get('provider','mock')}",
            action="geocode",
            request_payload=json.dumps({"address": address}, ensure_ascii=False),
            response_payload=json.dumps(result, ensure_ascii=False),
            status="success",
        )
        await self.session.flush()
        return result

    async def reverse_geocode(self, lat: float, lng: float) -> dict[str, Any]:
        provider = get_maps_provider()
        result = await provider.reverse_geocode(lat, lng)

        await self.logs.create_log(
            provider=f"maps_{result.get('provider','mock')}",
            action="reverse_geocode",
            request_payload=json.dumps({"lat": lat, "lng": lng}, ensure_ascii=False),
            response_payload=json.dumps(result, ensure_ascii=False),
            status="success",
        )
        await self.session.flush()
        return result

    async def get_static_map(self, lat: float, lng: float, zoom: int = 15) -> dict[str, Any]:
        provider = get_maps_provider()
        url = await provider.get_static_map_url(lat, lng, zoom)
        return {"url": url, "lat": lat, "lng": lng, "zoom": zoom, "provider": provider.name}

    async def calculate_distance(self, lat1: float, lng1: float, lat2: float, lng2: float) -> dict[str, Any]:
        provider = get_maps_provider()
        result = await provider.calculate_distance(lat1, lng1, lat2, lng2)
        return result

    async def list_logs(self, *, limit: int = 20, offset: int = 0, provider: str | None = None, status: str | None = None):
        rows, total = await self.logs.list(limit=limit, offset=offset, provider=provider, status=status)
        return rows, total
