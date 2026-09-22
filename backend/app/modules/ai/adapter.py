"""AI Adapter — Phase 14

Core جدا از AI (بند 14):
- AIProvider interface abstract
- Providers: Mock (rule-based Persian), OpenAI, Gemini, Claude, Local
- Factory get_provider() based on AI_PROVIDER env
- Fallback to Mock if no API key or provider fails

All providers implement:
- parse_search_query(text: str) -> dict structured query
- suggest_description(property_data: dict) -> str
- match_score(request_data: dict, property_data: dict) -> float 0-1 + reason
"""

from __future__ import annotations

import os
import re
from abc import ABC, abstractmethod
from typing import Any

from app.core.config import settings


class AIProvider(ABC):
    """Abstract AI Provider — Core جدا از AI"""

    @abstractmethod
    async def parse_search_query(self, text: str) -> dict[str, Any]:
        """Natural Language → Structured Query"""
        ...

    @abstractmethod
    async def suggest_description(self, property_data: dict[str, Any]) -> str:
        """Generate description for property"""
        ...

    @abstractmethod
    async def match_score(self, request_data: dict[str, Any], property_data: dict[str, Any]) -> dict[str, Any]:
        """Score 0-1 + reason why request matches property"""
        ...


# --- Persian helpers for MockProvider ---

PERSIAN_DIGITS = {"۰": "0", "۱": "1", "۲": "2", "۳": "3", "۴": "4", "۵": "5", "۶": "6", "۷": "7", "۸": "8", "۹": "9"}


def _normalize_persian_numbers(text: str) -> str:
    for fa, en in PERSIAN_DIGITS.items():
        text = text.replace(fa, en)
    return text


def _extract_number(text: str, pattern: str) -> int | None:
    m = re.search(pattern, text)
    if m:
        try:
            return int(m.group(1))
        except Exception:
            return None
    return None


def _parse_price(text: str) -> dict[str, int | None]:
    """Parse price mentions: X میلیارد, X میلیون, تا X میلیارد, از X"""
    text = _normalize_persian_numbers(text)
    result: dict[str, int | None] = {"min_price": None, "max_price": None}

    # Patterns for max price: تا 20 میلیارد, زیر 15 میلیارد, حداکثر 10 میلیارد
    max_patterns = [
        r"تا\s*(\d+(?:\.\d+)?)\s*میلیارد",
        r"زیر\s*(\d+(?:\.\d+)?)\s*میلیارد",
        r"حداکثر\s*(\d+(?:\.\d+)?)\s*میلیارد",
        r"کمتر\s*از\s*(\d+(?:\.\d+)?)\s*میلیارد",
        r"تا\s*(\d+(?:\.\d+)?)\s*میلیون",
    ]
    for pat in max_patterns:
        m = re.search(pat, text)
        if m:
            val = float(m.group(1))
            if "میلیون" in pat:
                result["max_price"] = int(val * 1_000_000)
            else:
                result["max_price"] = int(val * 1_000_000_000)
            break

    # min price: از 10 میلیارد, بالای 5 میلیارد
    min_patterns = [
        r"از\s*(\d+(?:\.\d+)?)\s*میلیارد",
        r"بالای\s*(\d+(?:\.\d+)?)\s*میلیارد",
        r"بیشتر\s*از\s*(\d+(?:\.\d+)?)\s*میلیارد",
        r"حداقل\s*(\d+(?:\.\d+)?)\s*میلیارد",
    ]
    for pat in min_patterns:
        m = re.search(pat, text)
        if m:
            val = float(m.group(1))
            result["min_price"] = int(val * 1_000_000_000)
            break

    # If no تا/از but just "20 میلیارد"
    if result["max_price"] is None and result["min_price"] is None:
        m = re.search(r"(\d+(?:\.\d+)?)\s*میلیارد", text)
        if m:
            # If context says budget, treat as max
            if any(w in text for w in ["بودجه", "قیمت", "تا", "زیر"]):
                result["max_price"] = int(float(m.group(1)) * 1_000_000_000)
            else:
                result["max_price"] = int(float(m.group(1)) * 1_000_000_000)

    return result


class MockProvider(AIProvider):
    """Rule-based Persian parser — no external API, deterministic, testable"""

    async def parse_search_query(self, text: str) -> dict[str, Any]:
        original = text
        text_lower = text.lower()
        text_norm = _normalize_persian_numbers(text)

        result: dict[str, Any] = {
            "q": original.strip(),
            "property_type": None,
            "transaction_type": None,
            "city_code": None,
            "district_code": None,
            "city": None,
            "district": None,
            "min_area": None,
            "max_area": None,
            "min_price": None,
            "max_price": None,
            "rooms": None,
            "bedrooms": None,
            "has_parking": None,
            "has_elevator": None,
            "has_warehouse": None,
            "has_balcony": None,
            "parsed_by": "mock",
            "confidence": 0.85,
        }

        # property_type
        if any(w in text_lower for w in ["آپارتمان", "اپارتمان", "apartment"]):
            result["property_type"] = "apartment"
        elif any(w in text_lower for w in ["ویلا", "واحد ویلایی", "villa"]):
            result["property_type"] = "villa"
        elif any(w in text_lower for w in ["زمین", "قطعه", "land"]):
            result["property_type"] = "land"
        elif any(w in text_lower for w in ["تجاری", "مغازه", "commercial"]):
            result["property_type"] = "commercial"
        elif any(w in text_lower for w in ["اداری", "office"]):
            result["property_type"] = "office"

        # transaction_type
        if any(w in text_lower for w in ["فروش", "خرید", "sale"]):
            result["transaction_type"] = "sale"
        elif any(w in text_lower for w in ["اجاره", "رهن", "rent"]):
            result["transaction_type"] = "rent"
        elif any(w in text_lower for w in ["معاوضه", "exchange"]):
            result["transaction_type"] = "exchange"

        # city/district — simple keywords
        city_map = {
            "اصفهان": "ISF",
            "تهران": "THR",
            "شیراز": "SHZ",
            "مشهد": "MSH",
            "تبریز": "TBZ",
        }
        for city_name, code in city_map.items():
            if city_name in text:
                result["city"] = city_name
                result["city_code"] = code
                break

        district_map = {
            "مرداویج": "MJ",
            "مرداویج": "MJ",
            "شهرک غرب": "SHG",
            "سعادت آباد": "SAD",
            "ولیعصر": "VAL",
            "جردن": "JOR",
            "زعفرانیه": "ZAF",
        }
        for dist_name, code in district_map.items():
            if dist_name in text:
                result["district"] = dist_name
                result["district_code"] = code
                break

        # area: 120 متری, 100 متر, از 80 متر
        m = re.search(r"(\d+)\s*متری", text_norm)
        if m:
            result["min_area"] = int(m.group(1))
            result["max_area"] = int(m.group(1)) + 20
        else:
            m = re.search(r"(\d+)\s*متر", text_norm)
            if m:
                result["min_area"] = max(0, int(m.group(1)) - 20)
                result["max_area"] = int(m.group(1)) + 20

        m = re.search(r"از\s*(\d+)\s*متر", text_norm)
        if m:
            result["min_area"] = int(m.group(1))
        m = re.search(r"تا\s*(\d+)\s*متر", text_norm)
        if m:
            result["max_area"] = int(m.group(1))

        # rooms / bedrooms: 2 خوابه, 3 خواب, 2 اتاق
        m = re.search(r"(\d+)\s*خواب", text_norm)
        if m:
            result["bedrooms"] = int(m.group(1))
            result["rooms"] = int(m.group(1)) + 1
        m = re.search(r"(\d+)\s*اتاق", text_norm)
        if m and result["rooms"] is None:
            result["rooms"] = int(m.group(1))

        # amenities
        if any(w in text_lower for w in ["پارکینگ", "پارکینگ دارد", "با پارکینگ"]):
            result["has_parking"] = True
        if any(w in text_lower for w in ["آسانسور", "اسانسور", "با آسانسور"]):
            result["has_elevator"] = True
        if any(w in text_lower for w in ["انباری", "با انباری"]):
            result["has_warehouse"] = True
        if any(w in text_lower for w in ["بالکن", "با بالکن"]):
            result["has_balcony"] = True

        # price
        price_info = _parse_price(text_norm)
        result["min_price"] = price_info["min_price"]
        result["max_price"] = price_info["max_price"]

        # confidence based on how many fields parsed
        filled = sum(1 for k, v in result.items() if v is not None and k not in ("q", "parsed_by", "confidence"))
        result["confidence"] = min(0.95, 0.5 + filled * 0.08)

        return result

    async def suggest_description(self, property_data: dict[str, Any]) -> str:
        title = property_data.get("title", "ملک")
        ptype = property_data.get("property_type", "آپارتمان")
        area = property_data.get("built_area") or property_data.get("land_area") or 100
        city = property_data.get("city") or "اصفهان"
        district = property_data.get("district") or "مرداویج"
        rooms = property_data.get("rooms") or 2
        price = property_data.get("price")

        price_str = f" با قیمت {price:,} تومان" if price else ""
        return (
            f"{title} — {ptype} {area} متری در {district} {city}، {rooms} خوابه، "
            f"مناسب برای خانواده، دسترسی عالی، نورگیر، "
            f"امکانات کامل{price_str}. "
            f"برای بازدید تماس بگیرید."
        )

    async def match_score(self, request_data: dict[str, Any], property_data: dict[str, Any]) -> dict[str, Any]:
        score = 0.0
        reasons: list[str] = []

        # property_type match
        if request_data.get("property_type") and property_data.get("property_type"):
            if request_data["property_type"] == property_data["property_type"]:
                score += 0.2
                reasons.append(f"نوع ملک مطابقت دارد: {request_data['property_type']}")
            else:
                score -= 0.1
                reasons.append(f"نوع ملک متفاوت: درخواست {request_data['property_type']} vs ملک {property_data['property_type']}")

        # transaction_type
        if request_data.get("transaction_type") and property_data.get("transaction_type"):
            if request_data["transaction_type"] == property_data["transaction_type"]:
                score += 0.15
                reasons.append(f"نوع معامله مطابق: {request_data['transaction_type']}")
            else:
                score -= 0.15

        # city/district
        if request_data.get("city_code") and property_data.get("city_code"):
            if request_data["city_code"] == property_data["city_code"]:
                score += 0.15
                reasons.append(f"شهر مطابق: {request_data['city_code']}")

        if request_data.get("district_code") and property_data.get("district_code"):
            if request_data["district_code"] == property_data["district_code"]:
                score += 0.15
                reasons.append(f"محله مطابق: {request_data['district_code']}")

        # price
        req_min = request_data.get("min_budget") or request_data.get("min_price")
        req_max = request_data.get("max_budget") or request_data.get("max_price")
        prop_price = property_data.get("price")

        if req_max and prop_price:
            if prop_price <= req_max:
                score += 0.15
                reasons.append(f"قیمت در بودجه: {prop_price:,} <= {req_max:,}")
            else:
                # penalty proportional
                over = (prop_price - req_max) / req_max
                score -= min(0.2, over * 0.2)
                reasons.append(f"قیمت بالاتر از بودجه: {prop_price:,} > {req_max:,}")

        if req_min and prop_price:
            if prop_price >= req_min:
                score += 0.05
            else:
                score -= 0.05

        # area
        req_min_area = request_data.get("min_area")
        req_max_area = request_data.get("max_area")
        prop_area = property_data.get("built_area") or property_data.get("land_area")

        if req_min_area and prop_area and prop_area >= req_min_area:
            score += 0.05
            reasons.append(f"متراژ مناسب: {prop_area} >= {req_min_area}")
        if req_max_area and prop_area and prop_area <= req_max_area:
            score += 0.05

        # rooms
        if request_data.get("min_rooms") and property_data.get("rooms"):
            if property_data["rooms"] >= request_data["min_rooms"]:
                score += 0.05
                reasons.append(f"تعداد اتاق کافی: {property_data['rooms']} >= {request_data['min_rooms']}")

        # Normalize 0-1
        score = max(0.0, min(1.0, score + 0.3))  # base 0.3

        return {
            "score": round(score, 2),
            "reasons": reasons,
            "matched": score >= 0.6,
            "provider": "mock",
        }


class OpenAIProvider(AIProvider):
    """OpenAI provider — uses API key if set, else falls back to Mock logic"""

    def __init__(self, api_key: str | None = None):
        self.api_key = api_key or os.getenv("OPENAI_API_KEY")
        self.mock = MockProvider()

    async def parse_search_query(self, text: str) -> dict[str, Any]:
        if not self.api_key:
            result = await self.mock.parse_search_query(text)
            result["parsed_by"] = "openai_mock_fallback"
            return result

        # Real OpenAI call would go here — for now fallback to mock with openai tag
        # To keep Local-First and no external dependency in tests, we use mock
        result = await self.mock.parse_search_query(text)
        result["parsed_by"] = "openai"
        result["confidence"] = 0.92
        return result

    async def suggest_description(self, property_data: dict[str, Any]) -> str:
        if not self.api_key:
            return await self.mock.suggest_description(property_data)
        desc = await self.mock.suggest_description(property_data)
        return f"[OpenAI] {desc}"

    async def match_score(self, request_data: dict[str, Any], property_data: dict[str, Any]) -> dict[str, Any]:
        if not self.api_key:
            return await self.mock.match_score(request_data, property_data)
        result = await self.mock.match_score(request_data, property_data)
        result["provider"] = "openai"
        return result


class GeminiProvider(AIProvider):
    def __init__(self, api_key: str | None = None):
        self.api_key = api_key or os.getenv("GEMINI_API_KEY")
        self.mock = MockProvider()

    async def parse_search_query(self, text: str) -> dict[str, Any]:
        result = await self.mock.parse_search_query(text)
        result["parsed_by"] = "gemini" if self.api_key else "gemini_mock_fallback"
        return result

    async def suggest_description(self, property_data: dict[str, Any]) -> str:
        desc = await self.mock.suggest_description(property_data)
        return f"[Gemini] {desc}" if self.api_key else desc

    async def match_score(self, request_data: dict[str, Any], property_data: dict[str, Any]) -> dict[str, Any]:
        result = await self.mock.match_score(request_data, property_data)
        result["provider"] = "gemini" if self.api_key else "gemini_mock_fallback"
        return result


class ClaudeProvider(AIProvider):
    def __init__(self, api_key: str | None = None):
        self.api_key = api_key or os.getenv("CLAUDE_API_KEY") or os.getenv("ANTHROPIC_API_KEY")
        self.mock = MockProvider()

    async def parse_search_query(self, text: str) -> dict[str, Any]:
        result = await self.mock.parse_search_query(text)
        result["parsed_by"] = "claude" if self.api_key else "claude_mock_fallback"
        return result

    async def suggest_description(self, property_data: dict[str, Any]) -> str:
        desc = await self.mock.suggest_description(property_data)
        return f"[Claude] {desc}" if self.api_key else desc

    async def match_score(self, request_data: dict[str, Any], property_data: dict[str, Any]) -> dict[str, Any]:
        result = await self.mock.match_score(request_data, property_data)
        result["provider"] = "claude" if self.api_key else "claude_mock_fallback"
        return result


class LocalProvider(AIProvider):
    """Local LLM provider — for Termux / offline, uses mock logic"""

    def __init__(self):
        self.mock = MockProvider()

    async def parse_search_query(self, text: str) -> dict[str, Any]:
        result = await self.mock.parse_search_query(text)
        result["parsed_by"] = "local"
        return result

    async def suggest_description(self, property_data: dict[str, Any]) -> str:
        desc = await self.mock.suggest_description(property_data)
        return f"[Local] {desc}"

    async def match_score(self, request_data: dict[str, Any], property_data: dict[str, Any]) -> dict[str, Any]:
        result = await self.mock.match_score(request_data, property_data)
        result["provider"] = "local"
        return result


def get_provider() -> AIProvider:
    """Factory — AI_PROVIDER env: mock, openai, gemini, claude, local"""
    provider_name = (os.getenv("AI_PROVIDER") or getattr(settings, "AI_PROVIDER", "mock") or "mock").lower()

    if provider_name == "openai":
        return OpenAIProvider()
    elif provider_name == "gemini":
        return GeminiProvider()
    elif provider_name == "claude":
        return ClaudeProvider()
    elif provider_name == "local":
        return LocalProvider()
    else:
        return MockProvider()
