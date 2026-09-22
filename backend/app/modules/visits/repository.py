"""Visit Repository"""
from __future__ import annotations

from app.repositories.base import TenantRepository

from .models import Visit


class VisitRepository(TenantRepository[Visit]):
    model = Visit
