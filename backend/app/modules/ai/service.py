"""AI Service — Phase 14

Core جدا از AI (بند 14):
- Uses adapter.get_provider() to get current provider
- Business logic: parse_search_query, match_request_to_properties, match_property_to_requests, suggest_description
- No direct dependency on external LLM — adapter abstracts
- Tenant-aware via current_context
"""

from __future__ import annotations

from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import NotFoundError, ValidationError
from app.core.tenant import current_context
from app.modules.ai.adapter import get_provider
from app.modules.crm.repository import CustomerRequestRepository
from app.modules.properties.repository import PropertyRepository


class AIService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session
        self.properties = PropertyRepository(session)
        self.requests = CustomerRequestRepository(session)
        self.provider = get_provider()

    async def parse_search_query(self, text: str) -> dict[str, Any]:
        """Natural Language → Structured Query via AI provider"""
        if not text or len(text.strip()) < 2:
            raise ValidationError("متن جستجو خیلی کوتاه است")

        result = await self.provider.parse_search_query(text)

        # Add searchable filters that can be directly used for property search
        # Note: q is original text, we don't include it by default because it would be too restrictive
        # Only structured fields are used for search
        filters: dict[str, Any] = {}
        if result.get("property_type"):
            filters["property_type"] = result["property_type"]
        if result.get("transaction_type"):
            filters["transaction_type"] = result["transaction_type"]
        if result.get("city_code"):
            filters["city_code"] = result["city_code"]
        if result.get("district_code"):
            filters["district_code"] = result["district_code"]
        if result.get("min_price"):
            filters["min_price"] = result["min_price"]
        if result.get("max_price"):
            filters["max_price"] = result["max_price"]
        if result.get("min_area"):
            filters["min_area"] = result["min_area"]
        if result.get("max_area"):
            filters["max_area"] = result["max_area"]
        if result.get("rooms"):
            filters["rooms"] = result["rooms"]
        if result.get("has_parking") is True:
            filters["has_parking"] = True
        if result.get("has_elevator") is True:
            filters["has_elevator"] = True
        # q is kept in result for reference but not used in filters unless explicitly needed

        result["filters"] = filters
        return result

    async def match_request_to_properties(self, request_id: int, *, limit: int = 10) -> list[dict[str, Any]]:
        """Auto matching Request ↔ Property — find properties matching a customer request"""
        ctx = current_context()

        # Get request
        req = await self.requests.get(request_id)
        if req is None:
            raise NotFoundError("درخواست یافت نشد")

        # Build request_data for scoring — map actual model fields to generic names
        request_data = {
            "property_type": req.property_type,
            "transaction_type": req.transaction_type,
            "city_code": req.city_code,
            "district_code": req.district_code,
            "min_area": req.area_min,
            "max_area": req.area_max,
            "min_budget": req.budget_min,
            "max_budget": req.budget_max,
            "min_rooms": req.rooms,
        }

        # Get candidate properties — simple search based on request filters
        search_params: dict[str, Any] = {}
        if req.property_type:
            search_params["property_type"] = req.property_type
        if req.transaction_type:
            search_params["transaction_type"] = req.transaction_type
        if req.city_code:
            search_params["city_code"] = req.city_code
        if req.district_code:
            search_params["district_code"] = req.district_code

        props_result = await self.properties.search(limit=50, offset=0, **search_params)
        props = props_result[0] if isinstance(props_result, tuple) else props_result

        scored: list[dict[str, Any]] = []
        for prop in props:
            # Build property_data with location codes from relationship if available
            city_code = None
            district_code = None
            if prop.location:
                city_code = prop.location.city_code
                district_code = prop.location.district_code

            prop_data = {
                "id": prop.id,
                "code": prop.code,
                "title": prop.title,
                "property_type": prop.property_type,
                "transaction_type": prop.transaction_type,
                "city_code": city_code,
                "district_code": district_code,
                "price": prop.price,
                "built_area": prop.built_area,
                "land_area": prop.land_area,
                "rooms": prop.rooms,
            }

            match_result = await self.provider.match_score(request_data, prop_data)
            if match_result["matched"] or match_result["score"] >= 0.4:
                scored.append(
                    {
                        "property": {
                            "id": prop.id,
                            "code": prop.code,
                            "title": prop.title,
                            "property_type": prop.property_type,
                            "transaction_type": prop.transaction_type,
                            "price": prop.price,
                            "built_area": prop.built_area,
                        },
                        "score": match_result["score"],
                        "reasons": match_result["reasons"],
                        "matched": match_result["matched"],
                        "provider": match_result["provider"],
                    }
                )

        # Sort by score desc
        scored.sort(key=lambda x: x["score"], reverse=True)
        return scored[:limit]

    async def match_property_to_requests(self, property_id: int, *, limit: int = 10) -> list[dict[str, Any]]:
        """Auto matching Property ↔ Request — find requests matching a property"""
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
            "property_type": prop.property_type,
            "transaction_type": prop.transaction_type,
            "city_code": city_code,
            "district_code": district_code,
            "price": prop.price,
            "built_area": prop.built_area,
            "land_area": prop.land_area,
            "rooms": prop.rooms,
        }

        # List recent customer requests
        req_result = await self.requests.list(limit=50, offset=0)
        requests = req_result[0] if isinstance(req_result, tuple) else req_result

        scored: list[dict[str, Any]] = []
        for req in requests:
            request_data = {
                "property_type": req.property_type,
                "transaction_type": req.transaction_type,
                "city_code": req.city_code,
                "district_code": req.district_code,
                "min_area": req.area_min,
                "max_area": req.area_max,
                "min_budget": req.budget_min,
                "max_budget": req.budget_max,
                "min_rooms": req.rooms,
            }

            match_result = await self.provider.match_score(request_data, prop_data)
            if match_result["score"] >= 0.4:
                scored.append(
                    {
                        "request": {
                            "id": req.id,
                            "person_id": req.person_id,
                            "property_type": req.property_type,
                            "transaction_type": req.transaction_type,
                            "city_code": req.city_code,
                            "district_code": req.district_code,
                            "budget_min": req.budget_min,
                            "budget_max": req.budget_max,
                        },
                        "score": match_result["score"],
                        "reasons": match_result["reasons"],
                        "matched": match_result["matched"],
                        "provider": match_result["provider"],
                    }
                )

        scored.sort(key=lambda x: x["score"], reverse=True)
        return scored[:limit]

    async def suggest_description(self, property_id: int) -> dict[str, Any]:
        """Generate description suggestion for a property"""
        prop = await self.properties.get(property_id)
        if prop is None:
            raise NotFoundError("ملک یافت نشد")

        prop_data = {
            "title": prop.title,
            "property_type": prop.property_type,
            "transaction_type": prop.transaction_type,
            "built_area": prop.built_area,
            "land_area": prop.land_area,
            "rooms": prop.rooms,
            "bedrooms": prop.bedrooms,
            "price": prop.price,
            "city": getattr(prop, "city", None) or "اصفهان",
            "district": getattr(prop, "district", None) or "مرداویج",
        }

        description = await self.provider.suggest_description(prop_data)

        return {
            "property_id": prop.id,
            "code": prop.code,
            "title": prop.title,
            "suggested_description": description,
            "provider": getattr(self.provider, "__class__", type(self.provider)).__name__,
        }
