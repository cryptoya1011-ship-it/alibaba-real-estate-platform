"""Visit Service — بند 38

- Property, Customer, Agent, Date, Time, Status, Notes
- Creates notification on schedule (future: Telegram adapter)
"""
from __future__ import annotations

import json
from datetime import datetime, timezone

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import NotFoundError, ValidationError
from app.core.tenant import current_context

from ..crm.repository import PersonRepository
from ..properties.repository import PropertyRepository
from ..notifications.repository import NotificationRepository
from .models import Visit
from .repository import VisitRepository
from .schemas import VisitCreate, VisitUpdate

VALID_STATUSES = {"scheduled", "done", "cancelled", "no_show", "rescheduled"}


class VisitService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session
        self.visits = VisitRepository(session)
        self.properties = PropertyRepository(session)
        self.persons = PersonRepository(session)
        self.notifications = NotificationRepository(session)

    async def create(self, payload: VisitCreate) -> Visit:
        if payload.status not in VALID_STATUSES:
            raise ValidationError(f"وضعیت بازدید نامعتبر: {payload.status}")

        # Check property exists (tenant isolation)
        prop = await self.properties.get(payload.property_id)
        if not prop:
            raise NotFoundError("ملک یافت نشد")

        # Check customer exists
        customer = await self.persons.get(payload.customer_id)
        if not customer:
            raise NotFoundError("مشتری یافت نشد")

        ctx = current_context()
        agent_id = payload.agent_id or ctx.user_id

        visit = await self.visits.create(
            property_id=payload.property_id,
            customer_id=payload.customer_id,
            agent_id=agent_id,
            visit_date=payload.visit_date,
            visit_time=payload.visit_time,
            status=payload.status,
            notes=payload.notes,
            follow_up_notes=payload.follow_up_notes,
            result=payload.result,
        )

        # Create notification for agent (in_app) — بند 41
        try:
            await self.notifications.create(
                user_id=agent_id,
                channel="in_app",
                priority="important",
                title=f"بازدید جدید: {prop.title}",
                body=f"بازدید برای {customer.display_name} در تاریخ {payload.visit_date} ثبت شد",
                entity_type="visit",
                entity_id=visit.id,
                data_json=json.dumps(
                    {"property_id": prop.id, "customer_id": customer.id, "visit_date": str(payload.visit_date)},
                    ensure_ascii=False,
                ),
            )
        except Exception:
            # Notification failure should not fail visit creation
            pass

        await self.session.flush()
        await self.session.refresh(visit)
        return visit

    async def get_by_id(self, visit_id: int) -> Visit:
        visit = await self.visits.get(visit_id)
        if not visit:
            raise NotFoundError("بازدید یافت نشد")
        return visit

    async def list(
        self,
        *,
        limit: int,
        offset: int,
        property_id: int | None = None,
        customer_id: int | None = None,
        agent_id: int | None = None,
        status: str | None = None,
        date_from: str | None = None,
        date_to: str | None = None,
    ):
        from sqlalchemy import func, select
        from datetime import date as date_type

        stmt = self.visits._base_select()
        if property_id:
            stmt = stmt.where(self.visits.model.property_id == property_id)
        if customer_id:
            stmt = stmt.where(self.visits.model.customer_id == customer_id)
        if agent_id:
            stmt = stmt.where(self.visits.model.agent_id == agent_id)
        if status:
            stmt = stmt.where(self.visits.model.status == status)
        if date_from:
            try:
                df = date_type.fromisoformat(date_from)
                stmt = stmt.where(self.visits.model.visit_date >= df)
            except Exception:
                pass
        if date_to:
            try:
                dt = date_type.fromisoformat(date_to)
                stmt = stmt.where(self.visits.model.visit_date <= dt)
            except Exception:
                pass

        total = (await self.session.execute(select(func.count()).select_from(stmt.subquery()))).scalar_one()
        stmt = stmt.order_by(self.visits.model.visit_date.desc(), self.visits.model.id.desc()).limit(limit).offset(offset)
        rows = (await self.session.execute(stmt)).scalars().all()
        return list(rows), int(total)

    async def update(self, visit_id: int, payload: VisitUpdate) -> Visit:
        visit = await self.get_by_id(visit_id)
        if payload.status and payload.status not in VALID_STATUSES:
            raise ValidationError(f"وضعیت نامعتبر: {payload.status}")

        values = payload.model_dump(exclude_unset=True, exclude={"version"})
        updated = await self.visits.update(visit, expected_version=payload.version, **values)
        await self.session.refresh(updated)
        return updated

    async def soft_delete(self, visit_id: int, version: int | None = None) -> Visit:
        visit = await self.get_by_id(visit_id)
        deleted = await self.visits.soft_delete(visit, expected_version=version)
        return deleted
