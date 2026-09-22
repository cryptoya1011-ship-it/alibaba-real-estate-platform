"""CRM Repositories — Tenant-aware"""
from __future__ import annotations

from sqlalchemy import select

from app.repositories.base import TenantRepository

from .models import CustomerRequest, Favorite, Person, PersonRole, SavedSearch


class PersonRepository(TenantRepository[Person]):
    model = Person

    async def find_by_phone(self, phone: str) -> Person | None:
        stmt = self._base_select().where(self.model.phone == phone)
        return (await self.session.execute(stmt)).scalar_one_or_none()


class PersonRoleRepository(TenantRepository[PersonRole]):
    model = PersonRole


class CustomerRequestRepository(TenantRepository[CustomerRequest]):
    model = CustomerRequest


class FavoriteRepository(TenantRepository[Favorite]):
    model = Favorite

    async def find_by_user_and_property(self, user_id: int, property_id: int) -> Favorite | None:
        stmt = self._base_select().where(
            self.model.user_id == user_id, self.model.property_id == property_id
        )
        return (await self.session.execute(stmt)).scalar_one_or_none()


class SavedSearchRepository(TenantRepository[SavedSearch]):
    model = SavedSearch
