"""Notification Repository"""
from __future__ import annotations

from app.repositories.base import TenantRepository

from .models import Notification


class NotificationRepository(TenantRepository[Notification]):
    model = Notification
