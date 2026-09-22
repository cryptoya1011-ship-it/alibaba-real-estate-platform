"""Property API — بند 32, 60, 61

- Code: AB-ISF-MJ-AP-S-2608-00124
- Privacy: Public DTO vs Internal DTO
- Deep Links: /p/{code} → handled via by-code
"""
from __future__ import annotations

import json
from typing import Any

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import fingerprint, get_tenant_context, idempotency_key, pagination, require_permission
from app.core import permissions as perm
from app.core.idempotency import run_idempotent
from app.core.responses import ok, page_meta
from app.core.tenant import TenantContext
from app.db.session import get_db
from app.modules.properties.schemas import PropertyCreate, PropertyUpdate
from app.modules.properties.service import PropertyService

router = APIRouter(prefix="/properties", tags=["properties"])


def _property_to_internal_dict(prop, ctx: TenantContext) -> dict[str, Any]:
    """Convert Property ORM to dict with privacy filtering (بند 61)"""
    has_address = ctx.has_permission(perm.PROPERTY_ADDRESS_READ)
    has_owner = ctx.has_permission(perm.PROPERTY_OWNER_READ)

    # Base
    amenities_json = prop.amenities_json

    # Location
    location = None
    if prop.location:
        loc = prop.location
        location = {
            "city": loc.city,
            "city_code": loc.city_code,
            "district": loc.district,
            "district_code": loc.district_code,
            "neighborhood": loc.neighborhood,
            "public_lat": loc.public_lat,
            "public_lng": loc.public_lng,
            "exact_address": loc.exact_address if has_address else None,
            "postal_code": loc.postal_code if has_address else None,
        }

    usages = [{"usage_type": u.usage_type, "is_primary": u.is_primary} for u in (prop.usages or [])]
    media = [
        {
            "id": m.id,
            "file_path": m.file_path,
            "file_name": m.file_name,
            "file_type": m.file_type,
            "mime_type": m.mime_type,
            "is_primary": m.is_primary,
            "sort_order": m.sort_order,
        }
        for m in (prop.media or [])
    ]

    return {
        "id": prop.id,
        "organization_id": prop.organization_id,
        "branch_id": prop.branch_id,
        "code": prop.code,
        "code_period": prop.code_period,
        "code_sequence": prop.code_sequence,
        "title": prop.title,
        "description": prop.description,
        "property_type": prop.property_type,
        "transaction_type": prop.transaction_type,
        "status": prop.status,
        "registrant_type": prop.registrant_type,
        "land_area": prop.land_area,
        "built_area": prop.built_area,
        "useful_area": prop.useful_area,
        "floor_area": prop.floor_area,
        "rooms": prop.rooms,
        "bedrooms": prop.bedrooms,
        "bathrooms": prop.bathrooms,
        "floor_number": prop.floor_number,
        "total_floors": prop.total_floors,
        "year_built": prop.year_built,
        "price": prop.price,
        "rent_price": prop.rent_price,
        "deposit": prop.deposit,
        "currency": prop.currency,
        "is_exchangeable": prop.is_exchangeable,
        "exchange_description": prop.exchange_description,
        "owner_share": prop.owner_share,
        "builder_share": prop.builder_share,
        "has_parking": prop.has_parking,
        "has_elevator": prop.has_elevator,
        "has_warehouse": prop.has_warehouse,
        "has_balcony": prop.has_balcony,
        "amenities_json": amenities_json,
        "version": prop.version,
        "created_at": prop.created_at,
        "updated_at": prop.updated_at,
        "usages": usages,
        "location": location,
        "media": media,
        # Private fields — only if permitted
        "owner_name": prop.owner_name if has_owner else None,
        "owner_phone": prop.owner_phone if has_owner else None,
        "owner_person_id": prop.owner_person_id if has_owner else None,
        "legal_info": prop.legal_info if has_owner else None,
    }


def _property_to_list_item(prop) -> dict[str, Any]:
    """Lightweight list item for search results"""
    city = None
    district = None
    city_code = None
    district_code = None
    if prop.location:
        city = prop.location.city
        district = prop.location.district
        city_code = prop.location.city_code
        district_code = prop.location.district_code

    primary_image = None
    if prop.media:
        # Find primary or first image
        for m in prop.media:
            if m.is_primary and m.file_type == "image":
                primary_image = m.file_path
                break
        if not primary_image:
            for m in prop.media:
                if m.file_type == "image":
                    primary_image = m.file_path
                    break

    return {
        "id": prop.id,
        "code": prop.code,
        "title": prop.title,
        "property_type": prop.property_type,
        "transaction_type": prop.transaction_type,
        "status": prop.status,
        "price": prop.price,
        "rent_price": prop.rent_price,
        "land_area": prop.land_area,
        "built_area": prop.built_area,
        "rooms": prop.rooms,
        "has_parking": prop.has_parking,
        "has_elevator": prop.has_elevator,
        "city": city,
        "district": district,
        "city_code": city_code,
        "district_code": district_code,
        "primary_image": primary_image,
        "created_at": prop.created_at,
    }


@router.post("", dependencies=[Depends(require_permission(perm.PROPERTY_CREATE))])
async def create_property(
    payload: PropertyCreate,
    ctx: TenantContext = Depends(get_tenant_context),
    session: AsyncSession = Depends(get_db),
    key: str | None = Depends(idempotency_key),
) -> dict:
    """ثبت ملک جدید — کد یکتا AB-ISF-MJ-AP-S-2608-00124 تولید می‌شود"""

    service = PropertyService(session)

    async def _handler():
        prop = await service.create(payload)
        return _property_to_internal_dict(prop, ctx)

    data = await run_idempotent(
        session,
        key=key,
        endpoint="POST /properties",
        request_fingerprint=fingerprint(payload.model_dump()),
        handler=_handler,
    )
    return ok(data)


@router.get("", dependencies=[Depends(require_permission(perm.PROPERTY_READ))])
async def list_properties(
    ctx: TenantContext = Depends(get_tenant_context),
    session: AsyncSession = Depends(get_db),
    pag: Any = Depends(pagination),
    property_type: str | None = Query(default=None, description="apartment, villa, land..."),
    transaction_type: str | None = Query(default=None, description="sale, rent..."),
    status: str | None = Query(default=None),
    city_code: str | None = Query(default=None),
    district_code: str | None = Query(default=None),
    min_price: int | None = Query(default=None, ge=0),
    max_price: int | None = Query(default=None, ge=0),
    min_area: float | None = Query(default=None, ge=0),
    max_area: float | None = Query(default=None, ge=0),
    has_parking: bool | None = Query(default=None),
    has_elevator: bool | None = Query(default=None),
    rooms: int | None = Query(default=None, ge=0),
    q: str | None = Query(default=None, description="Search in title, description, code"),
) -> dict:
    """لیست و جستجوی ساختاریافته املاک (بند 15)"""
    service = PropertyService(session)
    items, total = await service.search(
        limit=pag.limit,
        offset=pag.offset,
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
    data = [_property_to_list_item(p) for p in items]
    return ok(data, page_meta(total=total, limit=pag.limit, offset=pag.offset))


@router.get("/by-code/{code}", dependencies=[Depends(require_permission(perm.PROPERTY_READ))])
async def get_property_by_code(
    code: str,
    ctx: TenantContext = Depends(get_tenant_context),
    session: AsyncSession = Depends(get_db),
) -> dict:
    """دریافت ملک با کد یکتا — برای Deep Link /p/{code} (بند 62)"""
    service = PropertyService(session)
    prop = await service.get_by_code(code)
    return ok(_property_to_internal_dict(prop, ctx))


@router.get("/{property_id}", dependencies=[Depends(require_permission(perm.PROPERTY_READ))])
async def get_property(
    property_id: int,
    ctx: TenantContext = Depends(get_tenant_context),
    session: AsyncSession = Depends(get_db),
) -> dict:
    service = PropertyService(session)
    prop = await service.get_by_id(property_id)
    return ok(_property_to_internal_dict(prop, ctx))


@router.patch("/{property_id}", dependencies=[Depends(require_permission(perm.PROPERTY_UPDATE))])
async def update_property(
    property_id: int,
    payload: PropertyUpdate,
    ctx: TenantContext = Depends(get_tenant_context),
    session: AsyncSession = Depends(get_db),
) -> dict:
    """ویرایش ملک — نیاز به version برای Optimistic Locking"""
    service = PropertyService(session)
    prop = await service.update(property_id, payload)
    return ok(_property_to_internal_dict(prop, ctx))


@router.delete("/{property_id}", dependencies=[Depends(require_permission(perm.PROPERTY_DELETE))])
async def delete_property(
    property_id: int,
    ctx: TenantContext = Depends(get_tenant_context),
    session: AsyncSession = Depends(get_db),
    version: int | None = Query(default=None, description="Optional version for optimistic locking"),
) -> dict:
    """حذف نرم ملک"""
    service = PropertyService(session)
    await service.soft_delete(property_id, version=version)
    return ok({"id": property_id, "deleted": True})
