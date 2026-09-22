"""CRM Service — بند 34-37

- Person مستقل از Role
- Prevent duplicate customer by phone per org (fix(crm): prevent duplicate customer)
- Favorites, Saved Searches
"""
from __future__ import annotations

import json

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import ConflictError, NotFoundError, ValidationError

from .models import Person
from .repository import (
    CustomerRequestRepository,
    FavoriteRepository,
    PersonRepository,
    PersonRoleRepository,
    SavedSearchRepository,
)
from .schemas import (
    CustomerRequestCreate,
    CustomerRequestUpdate,
    FavoriteCreate,
    PersonCreate,
    PersonUpdate,
    SavedSearchCreate,
    SavedSearchUpdate,
)

VALID_PERSON_ROLES = {
    "owner",
    "buyer",
    "tenant",
    "seller",
    "investor",
    "landlord",
    "developer",
    "intermediary",
}


class PersonService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session
        self.persons = PersonRepository(session)
        self.person_roles = PersonRoleRepository(session)

    async def create(self, payload: PersonCreate) -> Person:
        # Prevent duplicate by phone per org
        if payload.phone:
            existing = await self.persons.find_by_phone(payload.phone)
            if existing:
                raise ConflictError(
                    f"مشتری با شماره {payload.phone} قبلاً ثبت شده است",
                    code="CUSTOMER_PHONE_TAKEN",
                )

        person = await self.persons.create(
            first_name=payload.first_name,
            last_name=payload.last_name,
            phone=payload.phone,
            email=payload.email,
            national_id=payload.national_id,
            notes=payload.notes,
        )

        if payload.roles:
            for role in payload.roles:
                if role not in VALID_PERSON_ROLES:
                    raise ValidationError(f"نقش نامعتبر: {role}")
                await self.person_roles.create(person_id=person.id, role=role)

        await self.session.flush()
        await self.session.refresh(person)
        person.roles = [r for r in (person.roles or []) if not r.is_deleted]
        return person

    async def get_by_id(self, person_id: int) -> Person:
        person = await self.persons.get(person_id)
        if not person:
            raise NotFoundError("مشتری یافت نشد")
        # Filter soft-deleted roles in memory (relationship selectin doesn't filter is_deleted)
        # We keep only active roles for response
        person.roles = [r for r in (person.roles or []) if not r.is_deleted]
        return person

    async def list(self, *, limit: int, offset: int, q: str | None = None, role: str | None = None):
        # Simple search — for more complex, join with roles
        filters = {}
        # q handled in repository search? For now simple list with optional phone/name filter via custom query
        # We'll use base list and then filter in service for simplicity
        # TODO: improve with proper search
        from sqlalchemy import select, func

        stmt = self.persons._base_select()
        if q:
            like = f"%{q}%"
            stmt = stmt.where(
                (self.persons.model.first_name.ilike(like))
                | (self.persons.model.last_name.ilike(like))
                | (self.persons.model.phone.ilike(like))
            )
        if role:
            # Join with roles
            from .models import PersonRole

            stmt = stmt.join(PersonRole, PersonRole.person_id == self.persons.model.id).where(
                PersonRole.role == role
            )

        total = (
            await self.session.execute(select(func.count()).select_from(stmt.subquery()))
        ).scalar_one()
        stmt = stmt.order_by(self.persons.model.id.desc()).limit(limit).offset(offset)
        rows = (await self.session.execute(stmt)).scalars().all()
        # Filter deleted roles for each person
        for p in rows:
            p.roles = [r for r in (p.roles or []) if not r.is_deleted]
        return list(rows), int(total)

    async def update(self, person_id: int, payload: PersonUpdate) -> Person:
        person = await self.get_by_id(person_id)

        # If phone changed, check duplicate
        if payload.phone and payload.phone != person.phone:
            existing = await self.persons.find_by_phone(payload.phone)
            if existing and existing.id != person_id:
                raise ConflictError(
                    f"مشتری با شماره {payload.phone} قبلاً ثبت شده است",
                    code="CUSTOMER_PHONE_TAKEN",
                )

        values = payload.model_dump(exclude_unset=True, exclude={"version"})
        updated = await self.persons.update(person, expected_version=payload.version, **values)
        await self.session.refresh(updated)
        updated.roles = [r for r in (updated.roles or []) if not r.is_deleted]
        return updated

    async def soft_delete(self, person_id: int, version: int | None = None) -> Person:
        person = await self.get_by_id(person_id)
        deleted = await self.persons.soft_delete(person, expected_version=version)
        return deleted

    async def add_role(self, person_id: int, role: str) -> Person:
        if role not in VALID_PERSON_ROLES:
            raise ValidationError(f"نقش نامعتبر: {role}")
        # Check if already exists (active)
        from sqlalchemy import select

        stmt = select(self.person_roles.model).where(
            self.person_roles.model.person_id == person_id,
            self.person_roles.model.role == role,
            self.person_roles.model.is_deleted == False,  # noqa: E712
        )
        existing = (await self.session.execute(stmt)).scalar_one_or_none()
        if existing:
            return await self.get_by_id(person_id)

        await self.person_roles.create(person_id=person_id, role=role)
        return await self.get_by_id(person_id)

    async def remove_role(self, person_id: int, role: str) -> Person:
        from sqlalchemy import select

        stmt = select(self.person_roles.model).where(
            self.person_roles.model.person_id == person_id,
            self.person_roles.model.role == role,
            self.person_roles.model.is_deleted == False,  # noqa: E712
        )
        existing = (await self.session.execute(stmt)).scalar_one_or_none()
        if existing:
            await self.person_roles.soft_delete(existing)
            await self.session.flush()
        return await self.get_by_id(person_id)


class CustomerRequestService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session
        self.requests = CustomerRequestRepository(session)
        self.persons = PersonRepository(session)

    async def create(self, payload: CustomerRequestCreate):
        # Check person exists (tenant isolation via get)
        person = await self.persons.get(payload.person_id)
        if not person:
            raise NotFoundError("مشتری یافت نشد")

        amenities_json = None
        if payload.amenities:
            amenities_json = json.dumps(payload.amenities, ensure_ascii=False)

        req = await self.requests.create(
            person_id=payload.person_id,
            transaction_type=payload.transaction_type,
            property_type=payload.property_type,
            city_code=payload.city_code,
            district_code=payload.district_code,
            city=payload.city,
            district=payload.district,
            budget_min=payload.budget_min,
            budget_max=payload.budget_max,
            area_min=payload.area_min,
            area_max=payload.area_max,
            rooms=payload.rooms,
            bedrooms=payload.bedrooms,
            has_parking=payload.has_parking,
            has_elevator=payload.has_elevator,
            has_warehouse=payload.has_warehouse,
            amenities_json=amenities_json,
            special_requirements=payload.special_requirements,
            status=payload.status,
        )
        await self.session.refresh(req)
        return req

    async def get_by_id(self, request_id: int):
        req = await self.requests.get(request_id)
        if not req:
            raise NotFoundError("درخواست یافت نشد")
        return req

    async def list(self, *, limit: int, offset: int, person_id: int | None = None, status: str | None = None):
        from sqlalchemy import func, select

        stmt = self.requests._base_select()
        if person_id:
            stmt = stmt.where(self.requests.model.person_id == person_id)
        if status:
            stmt = stmt.where(self.requests.model.status == status)

        total = (await self.session.execute(select(func.count()).select_from(stmt.subquery()))).scalar_one()
        stmt = stmt.order_by(self.requests.model.id.desc()).limit(limit).offset(offset)
        rows = (await self.session.execute(stmt)).scalars().all()
        return list(rows), int(total)

    async def update(self, request_id: int, payload: CustomerRequestUpdate):
        req = await self.get_by_id(request_id)
        values = payload.model_dump(exclude_unset=True, exclude={"version", "amenities"})
        if payload.amenities is not None:
            values["amenities_json"] = json.dumps(payload.amenities, ensure_ascii=False)
        updated = await self.requests.update(req, expected_version=payload.version, **values)
        await self.session.refresh(updated)
        return updated


class FavoriteService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session
        self.favorites = FavoriteRepository(session)

    async def add(self, user_id: int, payload: FavoriteCreate):
        existing = await self.favorites.find_by_user_and_property(user_id, payload.property_id)
        if existing:
            return existing

        fav = await self.favorites.create(user_id=user_id, property_id=payload.property_id)
        await self.session.refresh(fav)
        return fav

    async def list(self, user_id: int, *, limit: int, offset: int):
        from sqlalchemy import func, select

        stmt = self.favorites._base_select().where(self.favorites.model.user_id == user_id)
        total = (await self.session.execute(select(func.count()).select_from(stmt.subquery()))).scalar_one()
        stmt = stmt.order_by(self.favorites.model.id.desc()).limit(limit).offset(offset)
        rows = (await self.session.execute(stmt)).scalars().all()
        return list(rows), int(total)

    async def remove(self, user_id: int, property_id: int):
        fav = await self.favorites.find_by_user_and_property(user_id, property_id)
        if not fav:
            raise NotFoundError("علاقه‌مندی یافت نشد")
        await self.favorites.soft_delete(fav)


class SavedSearchService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session
        self.saved_searches = SavedSearchRepository(session)

    async def create(self, user_id: int, payload: SavedSearchCreate):
        query_json = json.dumps(payload.query, ensure_ascii=False)
        ss = await self.saved_searches.create(
            user_id=user_id, name=payload.name, query_json=query_json, is_active=payload.is_active
        )
        await self.session.refresh(ss)
        return ss

    async def list(self, user_id: int, *, limit: int, offset: int):
        from sqlalchemy import func, select

        stmt = self.saved_searches._base_select().where(self.saved_searches.model.user_id == user_id)
        total = (await self.session.execute(select(func.count()).select_from(stmt.subquery()))).scalar_one()
        stmt = stmt.order_by(self.saved_searches.model.id.desc()).limit(limit).offset(offset)
        rows = (await self.session.execute(stmt)).scalars().all()
        return list(rows), int(total)

    async def get_by_id(self, user_id: int, search_id: int):
        ss = await self.saved_searches.get(search_id)
        if not ss or ss.user_id != user_id:
            raise NotFoundError("جستجوی ذخیره‌شده یافت نشد")
        return ss

    async def update(self, user_id: int, search_id: int, payload: SavedSearchUpdate):
        ss = await self.get_by_id(user_id, search_id)
        values = {}
        if payload.name is not None:
            values["name"] = payload.name
        if payload.query is not None:
            values["query_json"] = json.dumps(payload.query, ensure_ascii=False)
        if payload.is_active is not None:
            values["is_active"] = payload.is_active
        updated = await self.saved_searches.update(ss, expected_version=payload.version, **values)
        await self.session.refresh(updated)
        return updated

    async def delete(self, user_id: int, search_id: int):
        ss = await self.get_by_id(user_id, search_id)
        await self.saved_searches.soft_delete(ss)

    async def find_matches(self, user_id: int, search_id: int, *, limit: int, offset: int):
        """Find properties matching saved search — بند 37

        Simple matching: uses query_json to filter properties
        """
        ss = await self.get_by_id(user_id, search_id)
        try:
            query = json.loads(ss.query_json)
        except Exception:
            query = {}

        # Use PropertyService search
        from app.modules.properties.service import PropertyService

        prop_service = PropertyService(self.session)
        # Map saved search query to property search params
        # query may contain: property_type, transaction_type, city_code, district_code, min_price, max_price, min_area, max_area, has_parking, etc.
        items, total = await prop_service.search(
            limit=limit,
            offset=offset,
            property_type=query.get("property_type"),
            transaction_type=query.get("transaction_type"),
            status=query.get("status"),
            city_code=query.get("city_code"),
            district_code=query.get("district_code"),
            min_price=query.get("min_price") or query.get("budget_min"),
            max_price=query.get("max_price") or query.get("budget_max"),
            min_area=query.get("min_area") or query.get("area_min"),
            max_area=query.get("max_area") or query.get("area_max"),
            has_parking=query.get("has_parking"),
            has_elevator=query.get("has_elevator"),
            rooms=query.get("rooms"),
            q=query.get("q"),
        )
        return items, total
