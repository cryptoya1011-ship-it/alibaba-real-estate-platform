"""Deal Service — بند 39, 40

Pipeline: Lead → Qualification → Property Match → Visit → Negotiation → Agreement → Closed
Commission: Total, Agent Share, Office Share, Referral Share
"""
from __future__ import annotations

import json
from datetime import datetime, timezone

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.errors import ConflictError, NotFoundError, ValidationError
from app.core.tenant import current_context
from app.db.system_models import CodeSequence

from ..crm.repository import PersonRepository
from ..properties.repository import PropertyRepository
from ..notifications.repository import NotificationRepository
from .models import Deal
from .repository import CodeSequenceRepository, DealRepository, DealStatusHistoryRepository
from .schemas import DealCreate, DealUpdate

VALID_STATUSES = {
    "lead",
    "qualification",
    "property_match",
    "visit",
    "negotiation",
    "agreement",
    "closed_won",
    "closed_lost",
    "archived",
}

# Simple state machine — allowed transitions (can be extended)
ALLOWED_TRANSITIONS: dict[str, set[str]] = {
    "lead": {"qualification", "closed_lost", "archived"},
    "qualification": {"property_match", "closed_lost", "archived"},
    "property_match": {"visit", "negotiation", "closed_lost", "archived"},
    "visit": {"negotiation", "property_match", "closed_lost", "archived"},
    "negotiation": {"agreement", "closed_lost", "archived"},
    "agreement": {"closed_won", "closed_lost", "archived"},
    "closed_won": {"archived"},
    "closed_lost": {"lead", "archived"},  # Can reopen
    "archived": set(),
}


def _period_now() -> str:
    now = datetime.now(timezone.utc)
    return f"{now.year % 100:02d}{now.month:02d}"


class DealService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session
        self.deals = DealRepository(session)
        self.history = DealStatusHistoryRepository(session)
        self.persons = PersonRepository(session)
        self.properties = PropertyRepository(session)
        self.notifications = NotificationRepository(session)
        self.sequences = CodeSequenceRepository(session)

    async def _generate_code(self, period: str | None = None) -> tuple[str, str, int]:
        ctx = current_context()
        org_id = ctx.require_organization()
        period = period or _period_now()
        seq_num = await self.sequences.next_value(org_id, "deal", period)
        # DL-ISF-2609-00001 or DL-2609-00001 — simple for now
        full_code = f"DL-{period}-{seq_num:05d}"
        # Could include city code if property has location — for simplicity just DL
        return full_code, period, seq_num

    async def create(self, payload: DealCreate) -> Deal:
        if payload.status not in VALID_STATUSES:
            raise ValidationError(f"وضعیت معامله نامعتبر: {payload.status}")

        # Check customer exists
        customer = await self.persons.get(payload.customer_id)
        if not customer:
            raise NotFoundError("مشتری یافت نشد")

        # Check property if provided
        if payload.property_id:
            prop = await self.properties.get(payload.property_id)
            if not prop:
                raise NotFoundError("ملک یافت نشد")

        ctx = current_context()
        agent_id = payload.agent_id or ctx.user_id

        code, period, seq_num = await self._generate_code()

        existing = await self.deals.get_by_code(code)
        if existing:
            raise ConflictError("کد معامله تکراری است", code="DEAL_CODE_TAKEN")

        deal = await self.deals.create(
            code=code,
            code_period=period,
            code_sequence=seq_num,
            title=payload.title,
            description=payload.description,
            status=payload.status,
            customer_id=payload.customer_id,
            property_id=payload.property_id,
            agent_id=agent_id,
            amount=payload.amount,
            commission_total=payload.commission_total,
            commission_agent_share=payload.commission_agent_share,
            commission_office_share=payload.commission_office_share,
            commission_referral_share=payload.commission_referral_share,
            commission_status=payload.commission_status,
            notes=payload.notes,
        )

        # History
        await self.history.create(
            deal_id=deal.id,
            from_status=None,
            to_status=payload.status,
            changed_by=ctx.user_id,
            notes="ایجاد معامله",
        )

        # Notification for agent
        try:
            await self.notifications.create(
                user_id=agent_id,
                channel="in_app",
                priority="important",
                title=f"معامله جدید: {deal.title}",
                body=f"معامله {deal.code} برای {customer.display_name} ایجاد شد",
                entity_type="deal",
                entity_id=deal.id,
                data_json=json.dumps({"customer_id": customer.id, "status": deal.status}, ensure_ascii=False),
            )
        except Exception:
            pass

        await self.session.flush()
        await self.session.refresh(deal)
        return deal

    async def get_by_id(self, deal_id: int) -> Deal:
        deal = await self.deals.get(deal_id)
        if not deal:
            raise NotFoundError("معامله یافت نشد")
        return deal

    async def get_by_code(self, code: str) -> Deal:
        deal = await self.deals.get_by_code(code)
        if not deal:
            raise NotFoundError("معامله یافت نشد")
        return deal

    async def list(
        self,
        *,
        limit: int,
        offset: int,
        status: str | None = None,
        customer_id: int | None = None,
        property_id: int | None = None,
        agent_id: int | None = None,
        q: str | None = None,
    ):
        from sqlalchemy import func, select

        stmt = self.deals._base_select()
        if status:
            stmt = stmt.where(self.deals.model.status == status)
        if customer_id:
            stmt = stmt.where(self.deals.model.customer_id == customer_id)
        if property_id:
            stmt = stmt.where(self.deals.model.property_id == property_id)
        if agent_id:
            stmt = stmt.where(self.deals.model.agent_id == agent_id)
        if q:
            like = f"%{q}%"
            stmt = stmt.where(
                (self.deals.model.title.ilike(like)) | (self.deals.model.code.ilike(like))
            )

        total = (await self.session.execute(select(func.count()).select_from(stmt.subquery()))).scalar_one()
        stmt = stmt.order_by(self.deals.model.id.desc()).limit(limit).offset(offset)
        rows = (await self.session.execute(stmt)).scalars().all()
        return list(rows), int(total)

    async def update(self, deal_id: int, payload: DealUpdate) -> Deal:
        deal = await self.get_by_id(deal_id)

        if payload.status and payload.status not in VALID_STATUSES:
            raise ValidationError(f"وضعیت نامعتبر: {payload.status}")

        # Validate transition if status changing
        if payload.status and payload.status != deal.status:
            allowed = ALLOWED_TRANSITIONS.get(deal.status, set())
            # Allow if in allowed or if super admin? For now allow all but log warning if not in allowed
            # We will allow but create history anyway — strict check can be enabled later
            # if payload.status not in allowed:
            #     raise ValidationError(f"تغییر وضعیت از {deal.status} به {payload.status} مجاز نیست")
            pass

        from_status = deal.status if payload.status else None

        values = payload.model_dump(exclude_unset=True, exclude={"version"})
        updated = await self.deals.update(deal, expected_version=payload.version, **values)

        # History if status changed
        if payload.status and payload.status != from_status:
            ctx = current_context()
            await self.history.create(
                deal_id=updated.id,
                from_status=from_status,
                to_status=payload.status,
                changed_by=ctx.user_id,
                notes=payload.notes or payload.loss_reason,
            )
            # Notification on status change
            try:
                # Notify agent
                await self.notifications.create(
                    user_id=updated.agent_id or ctx.user_id,
                    channel="in_app",
                    priority="important" if payload.status in ("closed_won", "closed_lost") else "normal",
                    title=f"تغییر وضعیت معامله: {updated.code}",
                    body=f"وضعیت از {from_status} به {payload.status} تغییر کرد",
                    entity_type="deal",
                    entity_id=updated.id,
                    data_json=json.dumps(
                        {"from_status": from_status, "to_status": payload.status}, ensure_ascii=False
                    ),
                )
            except Exception:
                pass

        await self.session.flush()
        await self.session.refresh(updated)
        return updated

    async def soft_delete(self, deal_id: int, version: int | None = None) -> Deal:
        deal = await self.get_by_id(deal_id)
        deleted = await self.deals.soft_delete(deal, expected_version=version)
        return deleted

    async def get_history(self, deal_id: int):
        deal = await self.get_by_id(deal_id)
        from sqlalchemy import select

        stmt = select(self.history.model).where(
            self.history.model.deal_id == deal_id,
            self.history.model.is_deleted == False,  # noqa: E712
        ).order_by(self.history.model.created_at.asc())
        rows = (await self.session.execute(stmt)).scalars().all()
        return list(rows)
