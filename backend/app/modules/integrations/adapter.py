"""Integration Adapters — Phase 15

Core جدا از Integration (بند 14):
- Each integration type has abstract base + mock + real providers
- Factory based on env vars
- "mock" providers are an explicit *test mode* (every result carries mock=True)
- A real provider is either implemented for real (Telegram Bot API, OSM Nominatim)
  or raises IntegrationUnavailableError — it NEVER returns mock data labelled as real
  (docs/BUSINESS_RULES.md §9, ADR-0019).
- No Vendor Lock-in, each Adapter مستقل

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

import httpx

from app.core.config import settings
from app.core.errors import ExternalServiceError, IntegrationUnavailableError

# Tests inject an httpx.MockTransport here; production uses the real network.
HTTP_TRANSPORT: httpx.AsyncBaseTransport | None = None
TELEGRAM_API_BASE = "https://api.telegram.org"
NOMINATIM_BASE = "https://nominatim.openstreetmap.org"


def _http_client(timeout: float = 10.0, headers: dict[str, str] | None = None) -> httpx.AsyncClient:
    return httpx.AsyncClient(timeout=timeout, transport=HTTP_TRANSPORT, headers=headers)


def _not_implemented(label: str) -> IntegrationUnavailableError:
    return IntegrationUnavailableError(
        f"اتصال واقعی به {label} هنوز پیاده‌سازی نشده است؛ تا آن زمان فقط حالت آزمایشی در دسترس است"
    )


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
    """Real Telegram Bot API (https://core.telegram.org/bots/api)."""

    implemented = True

    def __init__(self, bot_token: str | None = None):
        self.bot_token = bot_token or os.getenv("TELEGRAM_BOT_TOKEN") or getattr(settings, "TELEGRAM_BOT_TOKEN", None)

    @property
    def name(self) -> str:
        return "telegram_bot"

    async def _call(self, method: str, payload: dict[str, Any] | None = None) -> Any:
        if not self.bot_token:
            raise IntegrationUnavailableError("توکن ربات تلگرام تنظیم نشده است")
        url = f"{TELEGRAM_API_BASE}/bot{self.bot_token}/{method}"
        try:
            async with _http_client() as client:
                response = await client.post(url, json=payload or {})
            data = response.json()
        except (httpx.HTTPError, ValueError) as exc:
            # Never include the URL: it contains the bot token.
            raise ExternalServiceError("ارتباط با سرور تلگرام برقرار نشد") from None
        if not data.get("ok"):
            raise ExternalServiceError(f"تلگرام پیام را نپذیرفت: {data.get('description') or 'خطای نامشخص'}")
        return data.get("result")

    async def get_me(self) -> dict[str, Any]:
        me = await self._call("getMe")
        return {"success": True, "provider": self.name, "mock": False, "bot_username": me.get("username"), "bot_id": me.get("id")}

    async def send_message(self, chat_id: str | int, text: str, parse_mode: str = "HTML", reply_markup: dict | None = None) -> dict[str, Any]:
        payload: dict[str, Any] = {"chat_id": chat_id, "text": text, "parse_mode": parse_mode}
        if reply_markup:
            payload["reply_markup"] = reply_markup
        result = await self._call("sendMessage", payload)
        return {
            "success": True,
            "provider": self.name,
            "mock": False,
            "chat_id": chat_id,
            "message_id": result.get("message_id") if isinstance(result, dict) else None,
            "text": text[:100],
        }

    async def send_property_card(self, chat_id: str | int, property_data: dict[str, Any]) -> dict[str, Any]:
        title = property_data.get("title", "ملک")
        code = property_data.get("code", "")
        price = property_data.get("price")
        price_str = f"{price:,} تومان" if price else ""
        text = f"🏠 <b>{title}</b>\nکد: <code>{code}</code>\n💰 {price_str}\n🔗 /p/{code}"
        return await self.send_message(chat_id, text, parse_mode="HTML")

    async def create_deep_link(self, payload: str) -> str:
        bot_username = os.getenv("TELEGRAM_BOT_USERNAME") or getattr(settings, "TELEGRAM_BOT_USERNAME", None) or "arep_bot"
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
    """Placeholder for Kavenegar — the real API call is NOT implemented yet (no fake results)."""

    implemented = False
    label = "کاوه‌نگار"

    @property
    def name(self) -> str:
        return "kavenegar"

    async def send_sms(self, phone: str, message: str) -> dict[str, Any]:
        raise _not_implemented(self.label)

    async def send_otp(self, phone: str, code: str) -> dict[str, Any]:
        raise _not_implemented(self.label)

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
    """Placeholder for divar — no official public API is integrated yet (no fake results)."""

    implemented = False
    label = "دیوار"

    @property
    def name(self) -> str:
        return "divar"

    async def publish(self, platform: str, property_data: dict[str, Any]) -> dict[str, Any]:
        raise _not_implemented(self.label)

    async def unpublish(self, platform: str, external_id: str) -> dict[str, Any]:
        raise _not_implemented(self.label)

    async def get_status(self, platform: str, external_id: str) -> dict[str, Any]:
        raise _not_implemented(self.label)

class SheypoorListingProvider(ListingProvider):
    """Placeholder for sheypoor — no official public API is integrated yet (no fake results)."""

    implemented = False
    label = "شیپور"

    @property
    def name(self) -> str:
        return "sheypoor"

    async def publish(self, platform: str, property_data: dict[str, Any]) -> dict[str, Any]:
        raise _not_implemented(self.label)

    async def unpublish(self, platform: str, external_id: str) -> dict[str, Any]:
        raise _not_implemented(self.label)

    async def get_status(self, platform: str, external_id: str) -> dict[str, Any]:
        raise _not_implemented(self.label)

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
    """Placeholder for Zarinpal — the real gateway call is NOT implemented yet (no fake payments)."""

    implemented = False
    label = "زرین‌پال"

    @property
    def name(self) -> str:
        return "zarinpal"

    async def create_payment(self, amount: int, description: str, callback_url: str, metadata: dict | None = None) -> dict[str, Any]:
        raise _not_implemented(self.label)

    async def verify_payment(self, payment_id: str) -> dict[str, Any]:
        raise _not_implemented(self.label)

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
    """Real OpenStreetMap Nominatim geocoding (usage policy: 1 req/s, identifying User-Agent)."""

    implemented = True

    def __init__(self):
        self.math = MockMapsProvider()  # only for the local haversine formula

    @property
    def name(self) -> str:
        return "osm"

    async def _get(self, path: str, params: dict[str, Any]) -> Any:
        headers = {"User-Agent": "AREP/1.0 (Alibaba Real Estate Platform)", "Accept-Language": "fa"}
        try:
            async with _http_client(headers=headers) as client:
                response = await client.get(f"{NOMINATIM_BASE}{path}", params={**params, "format": "jsonv2"})
            response.raise_for_status()
            return response.json()
        except (httpx.HTTPError, ValueError):
            raise ExternalServiceError("ارتباط با سرویس نقشه (OpenStreetMap) برقرار نشد") from None

    async def geocode(self, address: str) -> dict[str, Any]:
        rows = await self._get("/search", {"q": address, "limit": 1, "countrycodes": "ir"})
        if not rows:
            return {"success": False, "provider": self.name, "mock": False, "address": address, "lat": None, "lng": None}
        row = rows[0]
        return {
            "success": True,
            "provider": self.name,
            "mock": False,
            "address": row.get("display_name") or address,
            "lat": round(float(row["lat"]), 6),
            "lng": round(float(row["lon"]), 6),
            "source": "nominatim.openstreetmap.org",
        }

    async def reverse_geocode(self, lat: float, lng: float) -> dict[str, Any]:
        row = await self._get("/reverse", {"lat": lat, "lon": lng})
        addr = (row or {}).get("address", {}) if isinstance(row, dict) else {}
        return {
            "success": bool(row) and "error" not in row,
            "provider": self.name,
            "mock": False,
            "lat": lat,
            "lng": lng,
            "address": (row or {}).get("display_name"),
            "city": addr.get("city") or addr.get("town") or addr.get("village"),
            "district": addr.get("suburb") or addr.get("neighbourhood"),
        }

    async def get_static_map_url(self, lat: float, lng: float, zoom: int = 15) -> str:
        return f"https://www.openstreetmap.org/?mlat={lat}&mlon={lng}#map={zoom}/{lat}/{lng}"

    async def calculate_distance(self, lat1: float, lng1: float, lat2: float, lng2: float) -> dict[str, Any]:
        result = await self.math.calculate_distance(lat1, lng1, lat2, lng2)
        result.update({"provider": "haversine", "mock": False})
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


def _requested(env: str, default: str = "mock") -> str:
    return (os.getenv(env) or getattr(settings, env, default) or default).lower()


def _status(requested: str, real_names: tuple[str, ...], implemented: bool, has_key: bool, key_required: bool = True) -> dict[str, Any]:
    """Honest connection status for the UI. mode: live | test | unavailable."""
    if requested not in real_names:
        return {"mode": "test", "connected": False, "implemented": implemented, "reason": "حالت آزمایشی فعال است"}
    if not implemented:
        return {"mode": "unavailable", "connected": False, "implemented": False, "reason": "اتصال واقعی هنوز پیاده‌سازی نشده است"}
    if key_required and not has_key:
        return {"mode": "unavailable", "connected": False, "implemented": True, "reason": "کلید/توکن تنظیم نشده است"}
    return {"mode": "live", "connected": True, "implemented": True, "reason": None}


def get_all_providers_status() -> dict[str, Any]:
    """Connection status per integration. Secrets are never returned — only has_key."""
    telegram_token = os.getenv("TELEGRAM_BOT_TOKEN") or getattr(settings, "TELEGRAM_BOT_TOKEN", None)
    sms_key = os.getenv("KAVENEGAR_API_KEY") or os.getenv("SMS_API_KEY") or getattr(settings, "SMS_API_KEY", None)
    divar_key = os.getenv("DIVAR_API_KEY") or getattr(settings, "DIVAR_API_KEY", None)
    sheypoor_key = os.getenv("SHEYPOOR_API_KEY") or getattr(settings, "SHEYPOOR_API_KEY", None)
    payment_key = os.getenv("ZARINPAL_API_KEY") or os.getenv("PAYMENT_API_KEY") or getattr(settings, "PAYMENT_API_KEY", None)

    telegram_provider = _requested("TELEGRAM_PROVIDER")
    sms_provider = _requested("SMS_PROVIDER")
    divar_provider = _requested("DIVAR_PROVIDER")
    sheypoor_provider = _requested("SHEYPOOR_PROVIDER")
    payment_provider = _requested("PAYMENT_PROVIDER")
    maps_provider = _requested("MAPS_PROVIDER")

    return {
        "current": {
            "telegram": telegram_provider,
            "sms": sms_provider,
            "payment": payment_provider,
            "maps": maps_provider,
            "listings": [divar_provider, sheypoor_provider],
        },
        "available": {
            "telegram": ["mock", "telegram_bot"],
            "sms": ["mock", "kavenegar"],
            "listings": ["mock", "divar", "sheypoor"],
            "payment": ["mock", "zarinpal"],
            "maps": ["mock", "osm"],
        },
        "details": {
            "telegram": {"has_key": bool(telegram_token), "provider": telegram_provider,
                         **_status(telegram_provider, ("telegram", "telegram_bot", "bot"), True, bool(telegram_token))},
            "sms": {"has_key": bool(sms_key), "provider": sms_provider,
                    **_status(sms_provider, ("kavenegar", "sms"), False, bool(sms_key))},
            "divar": {"has_key": bool(divar_key), "provider": divar_provider,
                      **_status(divar_provider, ("divar",), False, bool(divar_key))},
            "sheypoor": {"has_key": bool(sheypoor_key), "provider": sheypoor_provider,
                         **_status(sheypoor_provider, ("sheypoor",), False, bool(sheypoor_key))},
            "payment": {"has_key": bool(payment_key), "provider": payment_provider,
                        **_status(payment_provider, ("zarinpal", "payment"), False, bool(payment_key))},
            "maps": {"has_key": True, "provider": maps_provider, "note": "OpenStreetMap رایگان است و کلید نمی‌خواهد",
                     **_status(maps_provider, ("osm", "openstreetmap", "nominatim"), True, True, key_required=False)},
        },
    }
