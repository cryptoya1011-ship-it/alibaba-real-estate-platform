"""CRM API — بند 34-37

Persons, Customer Requests, Favorites, Saved Searches
"""
from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_tenant_context, pagination, require_permission
from app.core import permissions as perm
from app.core.responses import ok, page_meta
from app.core.tenant import TenantContext
from app.db.session import get_db
from app.modules.crm.schemas import (
    CustomerRequestCreate,
    CustomerRequestUpdate,
    FavoriteCreate,
    PersonCreate,
    PersonUpdate,
    SavedSearchCreate,
    SavedSearchUpdate,
)
from app.modules.crm.service import (
    CustomerRequestService,
    FavoriteService,
    PersonService,
    SavedSearchService,
)

router = APIRouter(tags=["crm"])


# --- Persons ---

persons_router = APIRouter(prefix="/persons", tags=["persons"])


@persons_router.post("", dependencies=[Depends(require_permission(perm.CUSTOMER_CREATE))])
async def create_person(
    payload: PersonCreate,
    ctx: TenantContext = Depends(get_tenant_context),
    session: AsyncSession = Depends(get_db),
) -> dict:
    service = PersonService(session)
    person = await service.create(payload)
    return ok(
        {
            "id": person.id,
            "first_name": person.first_name,
            "last_name": person.last_name,
            "phone": person.phone,
            "email": person.email,
            "display_name": person.display_name,
            "roles": [{"role": r.role} for r in person.roles],
            "version": person.version,
            "created_at": person.created_at,
        }
    )


@persons_router.get("", dependencies=[Depends(require_permission(perm.CUSTOMER_READ))])
async def list_persons(
    ctx: TenantContext = Depends(get_tenant_context),
    session: AsyncSession = Depends(get_db),
    pag: Any = Depends(pagination),
    q: str | None = Query(default=None, description="Search in name, phone"),
    role: str | None = Query(default=None, description="Filter by role: owner, buyer..."),
) -> dict:
    service = PersonService(session)
    items, total = await service.list(limit=pag.limit, offset=pag.offset, q=q, role=role)
    data = [
        {
            "id": p.id,
            "first_name": p.first_name,
            "last_name": p.last_name,
            "phone": p.phone,
            "display_name": p.display_name,
            "roles": [{"role": r.role} for r in p.roles],
            "created_at": p.created_at,
        }
        for p in items
    ]
    return ok(data, page_meta(total=total, limit=pag.limit, offset=pag.offset))


@persons_router.get("/{person_id}", dependencies=[Depends(require_permission(perm.CUSTOMER_READ))])
async def get_person(
    person_id: int,
    ctx: TenantContext = Depends(get_tenant_context),
    session: AsyncSession = Depends(get_db),
) -> dict:
    service = PersonService(session)
    p = await service.get_by_id(person_id)
    return ok(
        {
            "id": p.id,
            "organization_id": p.organization_id,
            "first_name": p.first_name,
            "last_name": p.last_name,
            "phone": p.phone,
            "email": p.email,
            "national_id": p.national_id,
            "notes": p.notes,
            "display_name": p.display_name,
            "roles": [{"role": r.role} for r in p.roles],
            "version": p.version,
            "created_at": p.created_at,
            "updated_at": p.updated_at,
        }
    )


@persons_router.patch("/{person_id}", dependencies=[Depends(require_permission(perm.CUSTOMER_UPDATE))])
async def update_person(
    person_id: int,
    payload: PersonUpdate,
    ctx: TenantContext = Depends(get_tenant_context),
    session: AsyncSession = Depends(get_db),
) -> dict:
    service = PersonService(session)
    p = await service.update(person_id, payload)
    return ok(
        {
            "id": p.id,
            "first_name": p.first_name,
            "last_name": p.last_name,
            "phone": p.phone,
            "display_name": p.display_name,
            "version": p.version,
        }
    )


@persons_router.delete("/{person_id}", dependencies=[Depends(require_permission(perm.CUSTOMER_DELETE))])
async def delete_person(
    person_id: int,
    ctx: TenantContext = Depends(get_tenant_context),
    session: AsyncSession = Depends(get_db),
    version: int | None = Query(default=None),
) -> dict:
    service = PersonService(session)
    await service.soft_delete(person_id, version=version)
    return ok({"id": person_id, "deleted": True})


@persons_router.post("/{person_id}/roles", dependencies=[Depends(require_permission(perm.CUSTOMER_UPDATE))])
async def add_person_role(
    person_id: int,
    payload: dict,
    ctx: TenantContext = Depends(get_tenant_context),
    session: AsyncSession = Depends(get_db),
) -> dict:
    role = payload.get("role")
    service = PersonService(session)
    p = await service.add_role(person_id, role)
    return ok({"id": p.id, "roles": [{"role": r.role} for r in p.roles]})


@persons_router.delete("/{person_id}/roles/{role}", dependencies=[Depends(require_permission(perm.CUSTOMER_UPDATE))])
async def remove_person_role(
    person_id: int,
    role: str,
    ctx: TenantContext = Depends(get_tenant_context),
    session: AsyncSession = Depends(get_db),
) -> dict:
    service = PersonService(session)
    p = await service.remove_role(person_id, role)
    return ok({"id": p.id, "roles": [{"role": r.role} for r in p.roles]})


# --- Customer Requests ---

requests_router = APIRouter(prefix="/customer-requests", tags=["customer-requests"])


@requests_router.post("", dependencies=[Depends(require_permission(perm.CUSTOMER_REQUEST_CREATE))])
async def create_request(
    payload: CustomerRequestCreate,
    ctx: TenantContext = Depends(get_tenant_context),
    session: AsyncSession = Depends(get_db),
) -> dict:
    service = CustomerRequestService(session)
    req = await service.create(payload)
    return ok(
        {
            "id": req.id,
            "person_id": req.person_id,
            "transaction_type": req.transaction_type,
            "property_type": req.property_type,
            "city_code": req.city_code,
            "status": req.status,
            "version": req.version,
        }
    )


@requests_router.get("", dependencies=[Depends(require_permission(perm.CUSTOMER_REQUEST_READ))])
async def list_requests(
    ctx: TenantContext = Depends(get_tenant_context),
    session: AsyncSession = Depends(get_db),
    pag: Any = Depends(pagination),
    person_id: int | None = Query(default=None),
    status: str | None = Query(default=None),
) -> dict:
    service = CustomerRequestService(session)
    items, total = await service.list(limit=pag.limit, offset=pag.offset, person_id=person_id, status=status)
    data = [
        {
            "id": r.id,
            "person_id": r.person_id,
            "transaction_type": r.transaction_type,
            "property_type": r.property_type,
            "city_code": r.city_code,
            "budget_min": r.budget_min,
            "budget_max": r.budget_max,
            "status": r.status,
            "created_at": r.created_at,
        }
        for r in items
    ]
    return ok(data, page_meta(total=total, limit=pag.limit, offset=pag.offset))


@requests_router.get("/{request_id}", dependencies=[Depends(require_permission(perm.CUSTOMER_REQUEST_READ))])
async def get_request(
    request_id: int,
    ctx: TenantContext = Depends(get_tenant_context),
    session: AsyncSession = Depends(get_db),
) -> dict:
    service = CustomerRequestService(session)
    r = await service.get_by_id(request_id)
    return ok(
        {
            "id": r.id,
            "person_id": r.person_id,
            "transaction_type": r.transaction_type,
            "property_type": r.property_type,
            "city_code": r.city_code,
            "district_code": r.district_code,
            "budget_min": r.budget_min,
            "budget_max": r.budget_max,
            "area_min": r.area_min,
            "area_max": r.area_max,
            "rooms": r.rooms,
            "special_requirements": r.special_requirements,
            "status": r.status,
            "version": r.version,
        }
    )


@requests_router.patch("/{request_id}", dependencies=[Depends(require_permission(perm.CUSTOMER_REQUEST_UPDATE))])
async def update_request(
    request_id: int,
    payload: CustomerRequestUpdate,
    ctx: TenantContext = Depends(get_tenant_context),
    session: AsyncSession = Depends(get_db),
) -> dict:
    service = CustomerRequestService(session)
    r = await service.update(request_id, payload)
    return ok({"id": r.id, "status": r.status, "version": r.version})


# --- Favorites ---

favorites_router = APIRouter(prefix="/favorites", tags=["favorites"])


@favorites_router.post("", dependencies=[Depends(require_permission(perm.FAVORITE_MANAGE))])
async def add_favorite(
    payload: FavoriteCreate,
    ctx: TenantContext = Depends(get_tenant_context),
    session: AsyncSession = Depends(get_db),
) -> dict:
    service = FavoriteService(session)
    fav = await service.add(ctx.user_id, payload)
    return ok({"id": fav.id, "property_id": fav.property_id, "user_id": fav.user_id})


@favorites_router.get("", dependencies=[Depends(require_permission(perm.FAVORITE_MANAGE))])
async def list_favorites(
    ctx: TenantContext = Depends(get_tenant_context),
    session: AsyncSession = Depends(get_db),
    pag: Any = Depends(pagination),
) -> dict:
    service = FavoriteService(session)
    items, total = await service.list(ctx.user_id, limit=pag.limit, offset=pag.offset)
    data = [{"id": f.id, "property_id": f.property_id, "created_at": f.created_at} for f in items]
    return ok(data, page_meta(total=total, limit=pag.limit, offset=pag.offset))


@favorites_router.delete("/{property_id}", dependencies=[Depends(require_permission(perm.FAVORITE_MANAGE))])
async def remove_favorite(
    property_id: int,
    ctx: TenantContext = Depends(get_tenant_context),
    session: AsyncSession = Depends(get_db),
) -> dict:
    service = FavoriteService(session)
    await service.remove(ctx.user_id, property_id)
    return ok({"property_id": property_id, "deleted": True})


# --- Saved Searches ---

saved_searches_router = APIRouter(prefix="/saved-searches", tags=["saved-searches"])


@saved_searches_router.post("", dependencies=[Depends(require_permission(perm.SAVED_SEARCH_MANAGE))])
async def create_saved_search(
    payload: SavedSearchCreate,
    ctx: TenantContext = Depends(get_tenant_context),
    session: AsyncSession = Depends(get_db),
) -> dict:
    service = SavedSearchService(session)
    ss = await service.create(ctx.user_id, payload)
    return ok({"id": ss.id, "name": ss.name, "query_json": ss.query_json})


@saved_searches_router.get("", dependencies=[Depends(require_permission(perm.SAVED_SEARCH_MANAGE))])
async def list_saved_searches(
    ctx: TenantContext = Depends(get_tenant_context),
    session: AsyncSession = Depends(get_db),
    pag: Any = Depends(pagination),
) -> dict:
    service = SavedSearchService(session)
    items, total = await service.list(ctx.user_id, limit=pag.limit, offset=pag.offset)
    data = [{"id": s.id, "name": s.name, "query_json": s.query_json, "is_active": s.is_active} for s in items]
    return ok(data, page_meta(total=total, limit=pag.limit, offset=pag.offset))


@saved_searches_router.get("/{search_id}", dependencies=[Depends(require_permission(perm.SAVED_SEARCH_MANAGE))])
async def get_saved_search(
    search_id: int,
    ctx: TenantContext = Depends(get_tenant_context),
    session: AsyncSession = Depends(get_db),
) -> dict:
    service = SavedSearchService(session)
    ss = await service.get_by_id(ctx.user_id, search_id)
    return ok({"id": ss.id, "name": ss.name, "query_json": ss.query_json, "is_active": ss.is_active, "version": ss.version})


@saved_searches_router.patch("/{search_id}", dependencies=[Depends(require_permission(perm.SAVED_SEARCH_MANAGE))])
async def update_saved_search(
    search_id: int,
    payload: SavedSearchUpdate,
    ctx: TenantContext = Depends(get_tenant_context),
    session: AsyncSession = Depends(get_db),
) -> dict:
    service = SavedSearchService(session)
    ss = await service.update(ctx.user_id, search_id, payload)
    return ok({"id": ss.id, "name": ss.name, "version": ss.version})


@saved_searches_router.delete("/{search_id}", dependencies=[Depends(require_permission(perm.SAVED_SEARCH_MANAGE))])
async def delete_saved_search(
    search_id: int,
    ctx: TenantContext = Depends(get_tenant_context),
    session: AsyncSession = Depends(get_db),
) -> dict:
    service = SavedSearchService(session)
    await service.delete(ctx.user_id, search_id)
    return ok({"id": search_id, "deleted": True})


@saved_searches_router.get("/{search_id}/matches", dependencies=[Depends(require_permission(perm.PROPERTY_READ))])
async def get_saved_search_matches(
    search_id: int,
    ctx: TenantContext = Depends(get_tenant_context),
    session: AsyncSession = Depends(get_db),
    pag: Any = Depends(pagination),
) -> dict:
    """پیدا کردن املاک منطبق با جستجوی ذخیره‌شده — بند 37"""
    service = SavedSearchService(session)
    items, total = await service.find_matches(ctx.user_id, search_id, limit=pag.limit, offset=pag.offset)
    # Reuse property list item logic
    data = [
        {
            "id": p.id,
            "code": p.code,
            "title": p.title,
            "property_type": p.property_type,
            "price": p.price,
            "city_code": p.location.city_code if p.location else None,
        }
        for p in items
    ]
    return ok(data, page_meta(total=total, limit=pag.limit, offset=pag.offset))


# Combine all CRM routers into one
router.include_router(persons_router)
router.include_router(requests_router)
router.include_router(favorites_router)
router.include_router(saved_searches_router)
