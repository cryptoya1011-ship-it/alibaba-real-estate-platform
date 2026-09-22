"""AI API — Phase 14 Multi-Tenant AI / Automation

- POST /ai/search/parse — Natural Language → Structured Query
- POST /ai/match/request/{request_id} — Auto matching Request ↔ Property
- POST /ai/match/property/{property_id} — Auto matching Property ↔ Request
- POST /ai/suggest/description/{property_id} — Suggest description
- GET /ai/providers — List available providers
"""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_tenant_context
from app.core.responses import ok
from app.core.tenant import TenantContext
from app.db.session import get_db
from app.modules.ai.adapter import get_provider
from app.modules.ai.service import AIService

router = APIRouter(prefix="/ai", tags=["ai"])


class SearchParseRequest(BaseModel):
    text: str = Field(min_length=2, max_length=1000, description="متن جستجوی فارسی طبیعی مثل 'آپارتمان 2 خوابه در مرداویج تا 20 میلیارد'")
    use_provider: str | None = Field(default=None, description="mock, openai, gemini, claude, local")


class MatchRequest(BaseModel):
    limit: int = Field(default=10, ge=1, le=50)


@router.get("/providers")
async def list_providers(
    ctx: TenantContext = Depends(get_tenant_context),
) -> dict:
    """لیست ارائه‌دهندگان AI — Core جدا از AI، قابل تعویض"""
    import os

    provider_name = (os.getenv("AI_PROVIDER") or "mock").lower()
    return ok(
        {
            "current": provider_name,
            "available": ["mock", "openai", "gemini", "claude", "local"],
            "details": {
                "mock": {"type": "rule-based", "requires_api_key": False, "persian": True, "description": "قانون‌محور فارسی، بدون نیاز به اینترنت، deterministic"},
                "openai": {"type": "llm", "requires_api_key": True, "env": "OPENAI_API_KEY", "has_key": bool(os.getenv("OPENAI_API_KEY"))},
                "gemini": {"type": "llm", "requires_api_key": True, "env": "GEMINI_API_KEY", "has_key": bool(os.getenv("GEMINI_API_KEY"))},
                "claude": {"type": "llm", "requires_api_key": True, "env": "CLAUDE_API_KEY or ANTHROPIC_API_KEY", "has_key": bool(os.getenv("CLAUDE_API_KEY") or os.getenv("ANTHROPIC_API_KEY"))},
                "local": {"type": "local_llm", "requires_api_key": False, "description": "برای Termux / آفلاین، فعلاً mock"},
            },
        }
    )


@router.post("/search/parse")
async def parse_search(
    payload: SearchParseRequest,
    ctx: TenantContext = Depends(get_tenant_context),
    session: AsyncSession = Depends(get_db),
) -> dict:
    """تبدیل جستجوی طبیعی فارسی به فیلترهای ساختاریافته — Natural Language → Structured Query

    مثال: 'آپارتمان 120 متری در مرداویج اصفهان با پارکینگ و آسانسور تا 15 میلیارد'
    خروجی: {property_type, transaction_type, city_code, district_code, min_area, max_area, rooms, has_parking, has_elevator, min_price, max_price, filters, confidence, parsed_by}
    """
    service = AIService(session)

    # Allow override provider via payload for testing
    if payload.use_provider:
        import os

        os.environ["AI_PROVIDER"] = payload.use_provider
        service.provider = get_provider()

    result = await service.parse_search_query(payload.text)
    return ok(result)


@router.post("/match/request/{request_id}")
async def match_request(
    request_id: int,
    payload: MatchRequest,
    ctx: TenantContext = Depends(get_tenant_context),
    session: AsyncSession = Depends(get_db),
) -> dict:
    """تطبیق خودکار درخواست مشتری با املاک — Auto matching Request ↔ Property

    ورودی: customer_request ID
    خروجی: لیست املاک با score و reasons، مرتب شده بر اساس score نزولی
    """
    service = AIService(session)
    matches = await service.match_request_to_properties(request_id, limit=payload.limit)
    return ok(matches)


@router.post("/match/property/{property_id}")
async def match_property(
    property_id: int,
    payload: MatchRequest,
    ctx: TenantContext = Depends(get_tenant_context),
    session: AsyncSession = Depends(get_db),
) -> dict:
    """تطبیق خودکار ملک با درخواست‌های مشتری — Auto matching Property ↔ Request

    ورودی: property ID
    خروجی: لیست درخواست‌ها با score و reasons
    """
    service = AIService(session)
    matches = await service.match_property_to_requests(property_id, limit=payload.limit)
    return ok(matches)


@router.post("/suggest/description/{property_id}")
async def suggest_description(
    property_id: int,
    ctx: TenantContext = Depends(get_tenant_context),
    session: AsyncSession = Depends(get_db),
) -> dict:
    """پیشنهاد توضیحات برای ملک با AI — Suggest description"""
    service = AIService(session)
    result = await service.suggest_description(property_id)
    return ok(result)


@router.post("/search/execute")
async def parse_and_execute_search(
    payload: SearchParseRequest,
    ctx: TenantContext = Depends(get_tenant_context),
    session: AsyncSession = Depends(get_db),
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
) -> dict:
    """جستجوی طبیعی + اجرای مستقیم — Parse + Search in one call

    متن فارسی را parse می‌کند و بلافاصله املاک مطابق را برمی‌گرداند.
    """
    from app.core.responses import page_meta
    from app.modules.properties.repository import PropertyRepository

    service = AIService(session)

    if payload.use_provider:
        import os

        os.environ["AI_PROVIDER"] = payload.use_provider
        service.provider = get_provider()

    parsed = await service.parse_search_query(payload.text)
    filters = parsed.get("filters", {})

    # Execute search
    prop_repo = PropertyRepository(session)
    props, total = await prop_repo.search(limit=limit, offset=offset, **filters)

    # Convert to simple dict
    data = [
        {
            "id": p.id,
            "code": p.code,
            "title": p.title,
            "property_type": p.property_type,
            "transaction_type": p.transaction_type,
            "price": p.price,
            "built_area": p.built_area,
            "rooms": p.rooms,
            "has_parking": p.has_parking,
            "has_elevator": p.has_elevator,
        }
        for p in props
    ]

    return ok(
        {
            "parsed": parsed,
            "properties": data,
        },
        page_meta(total=total, limit=limit, offset=offset),
    )
