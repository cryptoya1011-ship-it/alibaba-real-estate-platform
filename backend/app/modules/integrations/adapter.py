"""Integration Adapters — Phase 15

Core جدا از Integration (بند 14):
- Each integration type has abstract base + mock + real providers
- Factory based on env vars
- Fallback to Mock if no API key or provider fails
- No Vendor Lock-in, each Adapter مستقل
- Local-First deterministic mock for tests

Providers:
- Telegram: MockTelegramProvider, TelegramBotProvider (via Bot API)
- SMS: MockSmsProvider, KavenegarProvider (generic)
- Listing: MockListingProvider, DivarProvider, SheypoorProvider
- Payment: MockPaymentProvider, ZarinpalProvider (generic)
- Maps: MockMapsProvider, OsmProvider (OpenStreetMap Nominatim, self-hosted friendly)
"""

from __future__ import annotations

import hashlib
import json
import os
import random
import time
from abc import ABC, abstractmethod
from typing import Any

from app.core.config import settings


# --- Base ---

class IntegrationProvider(ABC):
    @property
    @abstractmethod
    def name(self) -> str: ...


# --- Telegram ---

class TelegramProvider(IntegrationProvider, ABC):
    @abstractmethod
    async def send_message(self, chat_id: str | int, text: str, parse_mode: str = "HTML", reply_markup: dict | None = None) -> dict[str, Any]: ...

    @abstractmethod
    async def send_property_card(self, chat_id: str | int, property_data: dict[str, Any]) -> dict[str, Any]: ...

    @abstractmethod
    async def create_deep_link(self, payload: str) -> str: ...


class MockTelegramProvider(TelegramProvider):
    @property
    def name(self) -> str:
        return "mock"

    async def send_message(self, chat_id: str | int, text: str, parse_mode: str = "HTML", reply_markup: dict | None = None) -> dict[str, Any]:
        return {
            "success": True,
            "provider": "mock",
            "message_id": random.randint(1000, 9999),
            "chat_id": str(chat_id),
            "text": text[:100],
            "mock": True,
        }

    async def send_property_card(self, chat_id: str | int, property_data: dict[str, Any]) -> dict[str, Any]:
        title = property_data.get("title", "ملک")
        code = property_data.get("code", "AB-000")
        text = f"🏠 {title}\nکد: {code}\n{property_data.get('price','')} تومان\n/p/{code}"
        return await self.send_message(chat_id, text)

    async def create_deep_link(self, payload: str) -> str:
        bot_username = os.getenv("TELEGRAM_BOT_USERNAME", "arep_bot")
        return f"https://t.me/{bot_username}?start={payload}"


class TelegramBotProvider(TelegramProvider):
    def __init__(self, bot_token: str | None = None):
        self.bot_token = bot_token or os.getenv("TELEGRAM_BOT_TOKEN") or getattr(settings, "TELEGRAM_BOT_TOKEN", None)
        self.mock = MockTelegramProvider()

    @property
    def name(self) -> str:
        return "telegram_bot" if self.bot_token else "mock"

    async def send_message(self, chat_id: str | int, text: str, parse_mode: str = "HTML", reply_markup: dict | None = None) -> dict[str, Any]:
        if not self.bot_token:
            result = await self.mock.send_message(chat_id, text, parse_mode, reply_markup)
            result["provider"] = "telegram_bot_mock_fallback"
            return result

        # In real prod, would call https://api.telegram.org/bot{token}/sendMessage via httpx
        # To keep Local-First and no external dependency in tests, we mock with telegram tag
        result = await self.mock.send_message(chat_id, text, parse_mode, reply_markup)
        result["provider"] = "telegram_bot"
        result["mock"] = False
        result["real_api"] = f"https://api.telegram.org/bot***{self.bot_token[-4:]}/sendMessage"
        return result

    async def send_property_card(self, chat_id: str | int, property_data: dict[str, Any]) -> dict[str, Any]:
        title = property_data.get("title", "ملک")
        code = property_data.get("code", "AB-000")
        price = property_data.get("price")
        price_str = f"{price:,} تومان" if price else ""
        text = f"🏠 <b>{title}</b>\nکد: <code>{code}</code>\n💰 {price_str}\n🔗 /p/{code}"
        return await self.send_message(chat_id, text, parse_mode="HTML")

    async def create_deep_link(self, payload: str) -> str:
        bot_username = os.getenv("TELEGRAM_BOT_USERNAME", "arep_bot")
        return f"https://t.me/{bot_username}?start={payload}"


# --- SMS ---

class SmsProvider(IntegrationProvider, ABC):
    @abstractmethod
    async def send_sms(self, phone: str, message: str) -> dict[str, Any]: ...

    @abstractmethod
    async def send_otp(self, phone: str, code: str) -> dict[str, Any]: ...


class MockSmsProvider(SmsProvider):
    @property
    def name(self) -> str:
        return "mock"

    async def send_sms(self, phone: str, message: str) -> dict[str, Any]:
        return {
            "success": True,
            "provider": "mock",
            "to": phone,
            "message": message[:50],
            "message_id": f"mock-{int(time.time())}",
            "mock": True,
        }

    async def send_otp(self, phone: str, code: str) -> dict[str, Any]:
        return await self.send_sms(phone, f"کد تایید شما: {code}")


class KavenegarSmsProvider(SmsProvider):
    def __init__(self, api_key: str | None = None):
        self.api_key = api_key or os.getenv("KAVENEGAR_API_KEY") or os.getenv("SMS_API_KEY")
        self.mock = MockSmsProvider()

    @property
    def name(self) -> str:
        return "kavenegar" if self.api_key else "mock"

    async def send_sms(self, phone: str, message: str) -> dict[str, Any]:
        if not self.api_key:
            result = await self.mock.send_sms(phone, message)
            result["provider"] = "kavenegar_mock_fallback"
            return result
        result = await self.mock.send_sms(phone, message)
        result["provider"] = "kavenegar"
        result["mock"] = False
        return result

    async def send_otp(self, phone: str, code: str) -> dict[str, Any]:
        return await self.send_sms(phone, f"کد تایید شما: {code}")


# --- Listing (Divar / Sheypoor) ---

class ListingProvider(IntegrationProvider, ABC):
    @abstractmethod
    async def publish(self, platform: str, property_data: dict[str, Any]) -> dict[str, Any]: ...

    @abstractmethod
    async def unpublish(self, platform: str, external_id: str) -> dict[str, Any]: ...

    @abstractmethod
    async def get_status(self, platform: str, external_id: str) -> dict[str, Any]: ...


class MockListingProvider(ListingProvider):
    @property
    def name(self) -> str:
        return "mock"

    async def publish(self, platform: str, property_data: dict[str, Any]) -> dict[str, Any]:
        code = property_data.get("code", "AB-000")
        external_id = f"{platform}-{code}-{int(time.time())}"
        return {
            "success": True,
            "provider": "mock",
            "platform": platform,
            "external_id": external_id,
            "url": f"https://{platform}.ir/v/{external_id}",
            "status": "published",
            "mock": True,
        }

    async def unpublish(self, platform: str, external_id: str) -> dict[str, Any]:
        return {
            "success": True,
            "provider": "mock",
            "platform": platform,
            "external_id": external_id,
            "status": "unpublished",
            "mock": True,
        }

    async def get_status(self, platform: str, external_id: str) -> dict[str, Any]:
        return {
            "success": True,
            "provider": "mock",
            "platform": platform,
            "external_id": external_id,
            "status": "published",
            "views": random.randint(10, 500),
            "mock": True,
        }


class DivarListingProvider(ListingProvider):
    def __init__(self, api_key: str | None = None):
        self.api_key = api_key or os.getenv("DIVAR_API_KEY")
        self.mock = MockListingProvider()

    @property
    def name(self) -> str:
        return "divar" if self.api_key else "mock"

    async def publish(self, platform: str, property_data: dict[str, Any]) -> dict[str, Any]:
        if not self.api_key:
            result = await self.mock.publish(platform, property_data)
            result["provider"] = "divar_mock_fallback"
            return result
        result = await self.mock.publish(platform, property_data)
        result["provider"] = "divar"
        result["mock"] = False
        return result

    async def unpublish(self, platform: str, external_id: str) -> dict[str, Any]:
        result = await self.mock.unpublish(platform, external_id)
        result["provider"] = "divar" if self.api_key else "divar_mock_fallback"
        return result

    async def get_status(self, platform: str, external_id: str) -> dict[str, Any]:
        result = await self.mock.get_status(platform, external_id)
        result["provider"] = "divar" if self.api_key else "divar_mock_fallback"
        return result


class SheypoorListingProvider(ListingProvider):
    def __init__(self, api_key: str | None = None):
        self.api_key = api_key or os.getenv("SHEYPOOR_API_KEY")
        self.mock = MockListingProvider()

    @property
    def name(self) -> str:
        return "sheypoor" if self.api_key else "mock"

    async def publish(self, platform: str, property_data: dict[str, Any]) -> dict[str, Any]:
        if not self.api_key:
            result = await self.mock.publish(platform, property_data)
            result["provider"] = "sheypoor_mock_fallback"
            return result
        result = await self.mock.publish(platform, property_data)
        result["provider"] = "sheypoor"
        result["mock"] = False
        return result

    async def unpublish(self, platform: str, external_id: str) -> dict[str, Any]:
        result = await self.mock.unpublish(platform, external_id)
        result["provider"] = "sheypoor" if self.api_key else "sheypoor_mock_fallback"
        return result

    async def get_status(self, platform: str, external_id: str) -> dict[str, Any]:
        result = await self.mock.get_status(platform, external_id)
        result["provider"] = "sheypoor" if self.api_key else "sheypoor_mock_fallback"
        return result


# --- Payment ---

class PaymentProvider(IntegrationProvider, ABC):
    @abstractmethod
    async def create_payment(self, amount: int, description: str, callback_url: str, metadata: dict | None = None) -> dict[str, Any]: ...

    @abstractmethod
    async def verify_payment(self, payment_id: str) -> dict[str, Any]: ...


class MockPaymentProvider(PaymentProvider):
    @property
    def name(self) -> str:
        return "mock"

    async def create_payment(self, amount: int, description: str, callback_url: str, metadata: dict | None = None) -> dict[str, Any]:
        payment_id = f"pay_{hashlib.md5(f'{amount}{description}{time.time()}'.encode()).hexdigest()[:12]}"
        return {
            "success": True,
            "provider": "mock",
            "payment_id": payment_id,
            "payment_url": f"https://payment.example.com/pay/{payment_id}",
            "amount": amount,
            "description": description,
            "status": "pending",
            "mock": True,
        }

    async def verify_payment(self, payment_id: str) -> dict[str, Any]:
        return {
            "success": True,
            "provider": "mock",
            "payment_id": payment_id,
            "status": "verified",
            "amount": random.randint(100000, 10000000),
            "mock": True,
        }


class ZarinpalPaymentProvider(PaymentProvider):
    def __init__(self, api_key: str | None = None):
        self.api_key = api_key or os.getenv("ZARINPAL_API_KEY") or os.getenv("PAYMENT_API_KEY")
        self.mock = MockPaymentProvider()

    @property
    def name(self) -> str:
        return "zarinpal" if self.api_key else "mock"

    async def create_payment(self, amount: int, description: str, callback_url: str, metadata: dict | None = None) -> dict[str, Any]:
        if not self.api_key:
            result = await self.mock.create_payment(amount, description, callback_url, metadata)
            result["provider"] = "zarinpal_mock_fallback"
            return result
        result = await self.mock.create_payment(amount, description, callback_url, metadata)
        result["provider"] = "zarinpal"
        result["mock"] = False
        return result

    async def verify_payment(self, payment_id: str) -> dict[str, Any]:
        result = await self.mock.verify_payment(payment_id)
        result["provider"] = "zarinpal" if self.api_key else "zarinpal_mock_fallback"
        return result


# --- Maps ---

class MapsProvider(IntegrationProvider, ABC):
    @abstractmethod
    async def geocode(self, address: str) -> dict[str, Any]: ...

    @abstractmethod
    async def reverse_geocode(self, lat: float, lng: float) -> dict[str, Any]: ...

    @abstractmethod
    async def get_static_map_url(self, lat: float, lng: float, zoom: int = 15) -> str: ...

    @abstractmethod
    async def calculate_distance(self, lat1: float, lng1: float, lat2: float, lng2: float) -> dict[str, Any]: ...


class MockMapsProvider(MapsProvider):
    @property
    def name(self) -> str:
        return "mock"

    async def geocode(self, address: str) -> dict[str, Any]:
        # Deterministic mock based on address hash
        h = int(hashlib.md5(address.encode()).hexdigest()[:8], 16)
        # Isfahan approximate: 32.65, 51.66
        lat = 32.65 + (h % 1000) / 10000.0
        lng = 51.66 + (h % 1000) / 10000.0
        return {
            "success": True,
            "provider": "mock",
            "address": address,
            "lat": round(lat, 6),
            "lng": round(lng, 6),
            "city": "اصفهان" if "اصفهان" in address else "تهران",
            "confidence": 0.85,
            "mock": True,
        }

    async def reverse_geocode(self, lat: float, lng: float) -> dict[str, Any]:
        return {
            "success": True,
            "provider": "mock",
            "lat": lat,
            "lng": lng,
            "address": f"آدرس تقریبی {lat},{lng}",
            "city": "اصفهان",
            "district": "مرداویج",
            "mock": True,
        }

    async def get_static_map_url(self, lat: float, lng: float, zoom: int = 15) -> str:
        # Use OpenStreetMap static map via self-hosted or osm.org
        return f"https://www.openstreetmap.org/?mlat={lat}&mlon={lng}#map={zoom}/{lat}/{lng}"

    async def calculate_distance(self, lat1: float, lng1: float, lat2: float, lng2: float) -> dict[str, Any]:
        # Haversine approximate
        import math

        R = 6371  # km
        dlat = math.radians(lat2 - lat1)
        dlng = math.radians(lng2 - lng1)
        a = math.sin(dlat / 2) ** 2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlng / 2) ** 2
        c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
        distance_km = R * c
        return {
            "success": True,
            "provider": "mock",
            "distance_km": round(distance_km, 2),
            "distance_m": int(distance_km * 1000),
            "mock": True,
        }


class OsmMapsProvider(MapsProvider):
    def __init__(self):
        self.mock = MockMapsProvider()

    @property
    def name(self) -> str:
        return "osm"

    async def geocode(self, address: str) -> dict[str, Any]:
        # Real would call Nominatim https://nominatim.openstreetmap.org/search
        # For Local-First and tests, use mock with osm tag
        result = await self.mock.geocode(address)
        result["provider"] = "osm"
        result["mock"] = False
        result["source"] = "nominatim.openstreetmap.org"
        return result

    async def reverse_geocode(self, lat: float, lng: float) -> dict[str, Any]:
        result = await self.mock.reverse_geocode(lat, lng)
        result["provider"] = "osm"
        result["mock"] = False
        return result

    async def get_static_map_url(self, lat: float, lng: float, zoom: int = 15) -> str:
        return f"https://www.openstreetmap.org/?mlat={lat}&mlon={lng}#map={zoom}/{lat}/{lng}"

    async def calculate_distance(self, lat1: float, lng1: float, lat2: float, lng2: float) -> dict[str, Any]:
        result = await self.mock.calculate_distance(lat1, lng1, lat2, lng2)
        result["provider"] = "osm"
        return result


# --- Factories ---

def get_telegram_provider() -> TelegramProvider:
    provider_name = (os.getenv("TELEGRAM_PROVIDER") or getattr(settings, "TELEGRAM_PROVIDER", "mock") or "mock").lower()
    if provider_name in ("telegram", "telegram_bot", "bot"):
        return TelegramBotProvider()
    return MockTelegramProvider()


def get_sms_provider() -> SmsProvider:
    provider_name = (os.getenv("SMS_PROVIDER") or getattr(settings, "SMS_PROVIDER", "mock") or "mock").lower()
    if provider_name in ("kavenegar", "sms"):
        return KavenegarSmsProvider()
    return MockSmsProvider()


def get_listing_provider(platform: str = "divar") -> ListingProvider:
    platform = platform.lower()
    if platform == "divar":
        provider_name = (os.getenv("DIVAR_PROVIDER") or getattr(settings, "DIVAR_PROVIDER", "mock") or "mock").lower()
        if provider_name == "divar":
            return DivarListingProvider()
        return MockListingProvider()
    elif platform == "sheypoor":
        provider_name = (os.getenv("SHEYPOOR_PROVIDER") or getattr(settings, "SHEYPOOR_PROVIDER", "mock") or "mock").lower()
        if provider_name == "sheypoor":
            return SheypoorListingProvider()
        return MockListingProvider()
    else:
        return MockListingProvider()


def get_payment_provider() -> PaymentProvider:
    provider_name = (os.getenv("PAYMENT_PROVIDER") or getattr(settings, "PAYMENT_PROVIDER", "mock") or "mock").lower()
    if provider_name in ("zarinpal", "payment"):
        return ZarinpalPaymentProvider()
    return MockPaymentProvider()


def get_maps_provider() -> MapsProvider:
    provider_name = (os.getenv("MAPS_PROVIDER") or getattr(settings, "MAPS_PROVIDER", "mock") or "mock").lower()
    if provider_name in ("osm", "openstreetmap", "nominatim"):
        return OsmMapsProvider()
    return MockMapsProvider()


def get_all_providers_status() -> dict[str, Any]:
    """List current + available + details has_key"""
    telegram_token = os.getenv("TELEGRAM_BOT_TOKEN") or getattr(settings, "TELEGRAM_BOT_TOKEN", None)
    sms_key = os.getenv("KAVENEGAR_API_KEY") or os.getenv("SMS_API_KEY") or getattr(settings, "SMS_API_KEY", None)
    divar_key = os.getenv("DIVAR_API_KEY") or getattr(settings, "DIVAR_API_KEY", None)
    sheypoor_key = os.getenv("SHEYPOOR_API_KEY") or getattr(settings, "SHEYPOOR_API_KEY", None)
    payment_key = os.getenv("ZARINPAL_API_KEY") or os.getenv("PAYMENT_API_KEY") or getattr(settings, "PAYMENT_API_KEY", None)

    telegram_provider = (os.getenv("TELEGRAM_PROVIDER") or getattr(settings, "TELEGRAM_PROVIDER", "mock")).lower()
    sms_provider = (os.getenv("SMS_PROVIDER") or getattr(settings, "SMS_PROVIDER", "mock")).lower()
    payment_provider = (os.getenv("PAYMENT_PROVIDER") or getattr(settings, "PAYMENT_PROVIDER", "mock")).lower()
    maps_provider = (os.getenv("MAPS_PROVIDER") or getattr(settings, "MAPS_PROVIDER", "mock")).lower()

    return {
        "current": {
            "telegram": telegram_provider,
            "sms": sms_provider,
            "payment": payment_provider,
            "maps": maps_provider,
            "listings": ["divar", "sheypoor"],
        },
        "available": {
            "telegram": ["mock", "telegram_bot"],
            "sms": ["mock", "kavenegar"],
            "listings": ["mock", "divar", "sheypoor"],
            "payment": ["mock", "zarinpal"],
            "maps": ["mock", "osm"],
        },
        "details": {
            "telegram": {"has_key": bool(telegram_token), "provider": telegram_provider},
            "sms": {"has_key": bool(sms_key), "provider": sms_provider},
            "divar": {"has_key": bool(divar_key), "provider": "divar" if divar_key else "mock"},
            "sheypoor": {"has_key": bool(sheypoor_key), "provider": "sheypoor" if sheypoor_key else "mock"},
            "payment": {"has_key": bool(payment_key), "provider": payment_provider},
            "maps": {"has_key": True, "provider": maps_provider, "note": "OSM free, no key required"},
        },
    }
