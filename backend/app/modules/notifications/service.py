"""Notification Service — بند 41, 82

Core مستقل از Provider, Priority, Channels
"""
from __future__ import annotations

import json
from datetime import datetime, timezone
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import NotFoundError
from app.core.tenant import current_context

from .models import Notification
from .repository import NotificationRepository
from .schemas import NotificationCreate

VALID_PRIORITIES = {"critical", "important", "normal", "informational"}
VALID_CHANNELS = {"in_app", "telegram", "sms", "push", "email"}


class NotificationService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session
        self.notifications = NotificationRepository(session)

    async def create(
        self,
        *,
        user_id: int,
        title: str,
        body: str | None = None,
        channel: str = "in_app",
        priority: str = "normal",
        entity_type: str | None = None,
        entity_id: int | None = None,
        data: dict[str, Any] | None = None,
    ) -> Notification:
        # Normalize
        if priority not in VALID_PRIORITIES:
            priority = "normal"
        if channel not in VALID_CHANNELS:
            channel = "in_app"

        data_json = None
        if data:
            data_json = json.dumps(data, ensure_ascii=False)

        notif = await self.notifications.create(
            user_id=user_id,
            channel=channel,
            priority=priority,
            title=title,
            body=body,
            entity_type=entity_type,
            entity_id=entity_id,
            data_json=data_json,
            is_read=False,
        )
        await self.session.flush()
        await self.session.refresh(notif)
        return notif

    async def create_from_payload(self, payload: NotificationCreate) -> Notification:
        return await self.create(
            user_id=payload.user_id,
            title=payload.title,
            body=payload.body,
            channel=payload.channel,
            priority=payload.priority,
            entity_type=payload.entity_type,
            entity_id=payload.entity_id,
            data=payload.data,
        )

    async def get_by_id(self, notification_id: int, user_id: int) -> Notification:
        notif = await self.notifications.get(notification_id)
        if not notif or notif.user_id != user_id:
            raise NotFoundError("اعلان یافت نشد")
        return notif

    async def list(
        self,
        user_id: int,
        *,
        limit: int,
        offset: int,
        is_read: bool | None = None,
        priority: str | None = None,
    ):
        from sqlalchemy import func, select

        stmt = self.notifications._base_select().where(self.notifications.model.user_id == user_id)
        if is_read is not None:
            stmt = stmt.where(self.notifications.model.is_read == is_read)
        if priority:
            stmt = stmt.where(self.notifications.model.priority == priority)

        total = (await self.session.execute(select(func.count()).select_from(stmt.subquery()))).scalar_one()
        stmt = stmt.order_by(self.notifications.model.created_at.desc()).limit(limit).offset(offset)
        rows = (await self.session.execute(stmt)).scalars().all()
        return list(rows), int(total)

    async def mark_read(self, notification_id: int, user_id: int) -> Notification:
        notif = await self.get_by_id(notification_id, user_id)
        if not notif.is_read:
            notif.is_read = True
            notif.read_at = datetime.now(timezone.utc)
            await self.session.flush()
            await self.session.refresh(notif)
        return notif

    async def mark_all_read(self, user_id: int) -> int:
        from sqlalchemy import select, update

        stmt = select(self.notifications.model).where(
            self.notifications.model.user_id == user_id,
            self.notifications.model.is_read == False,  # noqa: E712
            self.notifications.model.is_deleted == False,  # noqa: E712
        )
        # For simplicity, we fetch and update one by one (could be bulk update)
        rows = (await self.session.execute(stmt)).scalars().all()
        count = 0
        for notif in rows:
            notif.is_read = True
            notif.read_at = datetime.now(timezone.utc)
            count += 1
        await self.session.flush()
        return count

    async def delete(self, notification_id: int, user_id: int):
        notif = await self.get_by_id(notification_id, user_id)
        await self.notifications.soft_delete(notif)

    async def get_unread_count(self, user_id: int) -> int:
        from sqlalchemy import func, select

        stmt = select(func.count()).select_from(
            self.notifications._base_select().where(
                self.notifications.model.user_id == user_id,
                self.notifications.model.is_read == False,  # noqa: E712
            ).subquery()
        )
        total = (await self.session.execute(stmt)).scalar_one()
        return int(total)
