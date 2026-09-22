"""Property Service — Business Logic (بند 9, 22-33)

- Code Generator: AB-ISF-MJ-AP-S-2608-00124 from code_sequences (ADR-007)
- Privacy: Public DTO vs Internal DTO (بند 61)
- Lifecycle: Draft → ... → Archived
"""
from __future__ import annotations

import json
from datetime import datetime, timezone

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.errors import ConflictError, NotFoundError, ValidationError
from app.core.tenant import current_context
from app.db.system_models import CodeSequence

from .models import Property, PropertyLocation, PropertyUsage
from .repository import (
    CodeSequenceRepository,
    PropertyLocationRepository,
    PropertyRepository,
    PropertyUsageRepository,
)
from .schemas import LocationCreate, PropertyCreate, PropertyUpdate, UsageCreate


# --- Code Generator Helpers ---

PROPERTY_TYPE_CODES = {
    "residential": "RE",
    "apartment": "AP",
    "villa": "VI",
    "garden": "GA",
    "commercial": "CO",
    "office": "OF",
    "administrative": "OF",
    "land": "LA",
    "industrial": "IN",
    "factory": "IN",
    "mixed_use": "MU",
}

TRANSACTION_CODES = {
    "sale": "S",
    "rent": "R",
    "exchange": "E",
    "partnership": "P",
}

VALID_PROPERTY_TYPES = set(PROPERTY_TYPE_CODES.keys())
VALID_TRANSACTION_TYPES = set(TRANSACTION_CODES.keys())
VALID_STATUSES = {
    "draft",
    "pending_review",
    "approved",
    "published",
    "reserved",
    "sold",
    "rented",
    "archived",
}
VALID_REGISTRANT_TYPES = {"owner", "intermediary", "agent", "office_staff"}
VALID_USAGES = {"residential", "commercial", "administrative", "industrial", "garden", "office"}


def _period_now() -> str:
    """Generate period YYMM — e.g. 2609 for 2026-09

    TODO: In future use Jalali calendar (1404/08 → 0408). For now Gregorian YYMM to match example 2608.
    """
    now = datetime.now(timezone.utc)
    return f"{now.year % 100:02d}{now.month:02d}"


def _map_property_type_code(pt: str) -> str:
    return PROPERTY_TYPE_CODES.get(pt, pt[:2].upper())


def _map_transaction_code(tt: str) -> str:
    return TRANSACTION_CODES.get(tt, tt[:1].upper())


class PropertyService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session
        self.properties = PropertyRepository(session)
        self.usages = PropertyUsageRepository(session)
        self.locations = PropertyLocationRepository(session)
        self.sequences = CodeSequenceRepository(session)

    # --- Code Generation ---

    async def _generate_code(
        self,
        *,
        city_code: str | None,
        district_code: str | None,
        property_type: str,
        transaction_type: str,
        period: str | None = None,
    ) -> tuple[str, str, int]:
        """Returns (full_code, period, sequence_number)"""
        ctx = current_context()
        org_id = ctx.require_organization()
        period = period or _period_now()

        seq_num = await self.sequences.next_value(org_id, "property", period)

        city = (city_code or "XX").upper()[:3]
        district = (district_code or "XX").upper()[:2]
        pt_code = _map_property_type_code(property_type)
        tt_code = _map_transaction_code(transaction_type)

        # AB-ISF-MJ-AP-S-2608-00124
        full_code = f"{settings.APP_CODE}-{city}-{district}-{pt_code}-{tt_code}-{period}-{seq_num:05d}"
        return full_code, period, seq_num

    # --- Validation ---

    def _validate_create(self, payload: PropertyCreate) -> None:
        if payload.property_type not in VALID_PROPERTY_TYPES:
            raise ValidationError(f"نوع ملک نامعتبر: {payload.property_type}")
        if payload.transaction_type not in VALID_TRANSACTION_TYPES:
            raise ValidationError(f"نوع معامله نامعتبر: {payload.transaction_type}")
        if payload.status not in VALID_STATUSES:
            raise ValidationError(f"وضعیت نامعتبر: {payload.status}")
        if payload.registrant_type not in VALID_REGISTRANT_TYPES:
            raise ValidationError(f"نوع ثبت‌کننده نامعتبر: {payload.registrant_type}")

        # بند 29: اگر Intermediary نیست, owner لازم نیست اما اگر Owner باشد باید داشته باشد؟
        # طبق قانون: اگر Intermediary باشد نام و شماره مالک الزاماً لازم نیست — یعنی بقیه باید داشته باشند؟
        # ما سخت نمی‌گیریم اما اگر registrant_type == owner و owner_name خالی باشد هشدار می‌دهیم
        if payload.registrant_type == "owner" and not payload.owner_name:
            raise ValidationError("برای ثبت‌کننده مالک, نام مالک الزامی است")

        if payload.usages:
            for u in payload.usages:
                if u.usage_type not in VALID_USAGES:
                    raise ValidationError(f"کاربری نامعتبر: {u.usage_type}")

    # --- Create ---

    async def create(self, payload: PropertyCreate) -> Property:
        self._validate_create(payload)

        ctx = current_context()

        city_code = payload.location.city_code if payload.location else None
        district_code = payload.location.district_code if payload.location else None

        code, period, seq_num = await self._generate_code(
            city_code=city_code,
            district_code=district_code,
            property_type=payload.property_type,
            transaction_type=payload.transaction_type,
        )

        # Check duplicate code (should not happen due to sequence, but safe)
        existing = await self.properties.get_by_code(code)
        if existing:
            raise ConflictError("کد ملک تکراری است", code="PROPERTY_CODE_TAKEN")

        # Prepare amenities JSON
        amenities_json = None
        if payload.amenities:
            amenities_json = json.dumps(payload.amenities, ensure_ascii=False)

        prop = await self.properties.create(
            code=code,
            code_period=period,
            code_sequence=seq_num,
            title=payload.title,
            description=payload.description,
            property_type=payload.property_type,
            transaction_type=payload.transaction_type,
            status=payload.status,
            registrant_type=payload.registrant_type,
            land_area=payload.land_area,
            built_area=payload.built_area,
            useful_area=payload.useful_area,
            floor_area=payload.floor_area,
            rooms=payload.rooms,
            bedrooms=payload.bedrooms,
            bathrooms=payload.bathrooms,
            floor_number=payload.floor_number,
            total_floors=payload.total_floors,
            year_built=payload.year_built,
            price=payload.price,
            rent_price=payload.rent_price,
            deposit=payload.deposit,
            currency=payload.currency,
            is_exchangeable=payload.is_exchangeable,
            exchange_description=payload.exchange_description,
            owner_share=payload.owner_share,
            builder_share=payload.builder_share,
            partnership_description=payload.partnership_description,
            owner_name=payload.owner_name,
            owner_phone=payload.owner_phone,
            owner_person_id=payload.owner_person_id,
            has_parking=payload.has_parking,
            has_elevator=payload.has_elevator,
            has_warehouse=payload.has_warehouse,
            has_balcony=payload.has_balcony,
            amenities_json=amenities_json,
            legal_info=payload.legal_info,
        )

        # Usages (Mixed Use)
        if payload.usages:
            for u in payload.usages:
                await self.usages.create(
                    property_id=prop.id,
                    usage_type=u.usage_type,
                    is_primary=u.is_primary,
                )
        else:
            # Default usage from property_type if not mixed
            # Map property_type to usage if possible
            default_usage = payload.property_type if payload.property_type in VALID_USAGES else "residential"
            if default_usage in VALID_USAGES:
                await self.usages.create(
                    property_id=prop.id,
                    usage_type=default_usage,
                    is_primary=True,
                )

        # Location
        if payload.location:
            await self.locations.create(
                property_id=prop.id,
                city=payload.location.city,
                city_code=payload.location.city_code,
                district=payload.location.district,
                district_code=payload.location.district_code,
                neighborhood=payload.location.neighborhood,
                public_lat=payload.location.public_lat,
                public_lng=payload.location.public_lng,
                exact_address=payload.location.exact_address,
                postal_code=payload.location.postal_code,
            )

        await self.session.flush()
        # Reload with relationships — need to ensure all columns loaded for async
        await self.session.refresh(prop)
        # Ensure relationships are loaded (selectin should already, but explicit)
        # Access to trigger selectin if needed within async context
        _ = prop.usages
        _ = prop.location
        _ = prop.media
        return prop

    # --- Get ---

    async def get_by_id(self, property_id: int) -> Property:
        prop = await self.properties.get(property_id)
        if prop is None:
            raise NotFoundError("ملک یافت نشد")
        return prop

    async def get_by_code(self, code: str) -> Property:
        prop = await self.properties.get_by_code(code)
        if prop is None:
            raise NotFoundError("ملک یافت نشد")
        return prop

    # --- List / Search ---

    async def search(
        self,
        *,
        limit: int,
        offset: int,
        property_type: str | None = None,
        transaction_type: str | None = None,
        status: str | None = None,
        city_code: str | None = None,
        district_code: str | None = None,
        min_price: int | None = None,
        max_price: int | None = None,
        min_area: float | None = None,
        max_area: float | None = None,
        has_parking: bool | None = None,
        has_elevator: bool | None = None,
        rooms: int | None = None,
        q: str | None = None,
    ):
        return await self.properties.search(
            limit=limit,
            offset=offset,
            property_type=property_type,
            transaction_type=transaction_type,
            status=status,
            city_code=city_code,
            district_code=district_code,
            min_price=min_price,
            max_price=max_price,
            min_area=min_area,
            max_area=max_area,
            has_parking=has_parking,
            has_elevator=has_elevator,
            rooms=rooms,
            q=q,
        )

    # --- Update ---

    async def update(self, property_id: int, payload: PropertyUpdate) -> Property:
        prop = await self.get_by_id(property_id)

        # Validate if types changed
        if payload.property_type and payload.property_type not in VALID_PROPERTY_TYPES:
            raise ValidationError(f"نوع ملک نامعتبر: {payload.property_type}")
        if payload.transaction_type and payload.transaction_type not in VALID_TRANSACTION_TYPES:
            raise ValidationError(f"نوع معامله نامعتبر: {payload.transaction_type}")
        if payload.status and payload.status not in VALID_STATUSES:
            raise ValidationError(f"وضعیت نامعتبر: {payload.status}")

        values = payload.model_dump(exclude_unset=True, exclude={"version", "usages", "location", "amenities"})
        # Handle amenities separately
        if payload.amenities is not None:
            values["amenities_json"] = json.dumps(payload.amenities, ensure_ascii=False)

        # Remove None values that were not set? model_dump exclude_unset already handles
        # But we need to allow explicit None to clear field — so keep as is

        updated = await self.properties.update(prop, expected_version=payload.version, **values)

        # Update usages if provided — replace all
        if payload.usages is not None:
            # Delete existing
            for existing_usage in list(updated.usages):
                await self.session.delete(existing_usage)
            await self.session.flush()
            for u in payload.usages:
                await self.usages.create(
                    property_id=updated.id,
                    usage_type=u.usage_type,
                    is_primary=u.is_primary,
                )

        # Update location if provided
        if payload.location is not None:
            loc_payload = payload.location
            if updated.location:
                loc = updated.location
                # Update fields if set
                for field in ["city", "city_code", "district", "district_code", "neighborhood", "public_lat", "public_lng", "exact_address", "postal_code"]:
                    val = getattr(loc_payload, field)
                    if val is not None or field in loc_payload.model_fields_set:
                        setattr(loc, field, val)
                await self.session.flush()
            else:
                await self.locations.create(
                    property_id=updated.id,
                    city=loc_payload.city,
                    city_code=loc_payload.city_code,
                    district=loc_payload.district,
                    district_code=loc_payload.district_code,
                    neighborhood=loc_payload.neighborhood,
                    public_lat=loc_payload.public_lat,
                    public_lng=loc_payload.public_lng,
                    exact_address=loc_payload.exact_address,
                    postal_code=loc_payload.postal_code,
                )

        await self.session.flush()
        await self.session.refresh(updated)
        _ = updated.usages
        _ = updated.location
        _ = updated.media
        return updated

    # --- Delete (Soft) ---

    async def soft_delete(self, property_id: int, version: int | None = None) -> Property:
        prop = await self.get_by_id(property_id)
        deleted = await self.properties.soft_delete(prop, expected_version=version)
        return deleted

    # --- Privacy Helpers (بند 61) ---

    @staticmethod
    def to_public_dict(prop: Property, *, has_address_perm: bool, has_owner_perm: bool) -> dict:
        """Convert to dict with privacy filtering — used by API layer"""
        # This is helper, but actual Pydantic filtering done in API
        return {
            "has_address_perm": has_address_perm,
            "has_owner_perm": has_owner_perm,
        }
