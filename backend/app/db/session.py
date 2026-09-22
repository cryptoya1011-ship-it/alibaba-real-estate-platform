"""Async engine/session wiring. Works with SQLite (Termux) and PostgreSQL (prod)."""

from __future__ import annotations

from collections.abc import AsyncGenerator

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.core.config import settings

_connect_args: dict = {}
if settings.DATABASE_URL.startswith("sqlite"):
    _connect_args = {"check_same_thread": False}

engine = create_async_engine(
    settings.DATABASE_URL,
    echo=settings.DB_ECHO,
    pool_pre_ping=True,
    future=True,
    connect_args=_connect_args,
)

SessionFactory = async_sessionmaker(
    bind=engine, expire_on_commit=False, autoflush=False, class_=AsyncSession
)


async def _set_rls_context(session: AsyncSession, org_id: int | None, bypass: bool = False) -> None:
    """Set PostgreSQL RLS context via SET LOCAL (Phase 11)

    - Uses current_setting('app.current_org_id', true) in RLS policies
    - For SQLite, this is a no-op (SQLite doesn't support SET LOCAL)
    - For public endpoints, bypass=True sets app.bypass_rls=1 to allow published read
    """
    if not settings.DATABASE_URL.startswith("postgresql"):
        return

    try:
        # Use SET LOCAL inside transaction — will be reset after commit/rollback
        if bypass:
            await session.execute(text("SET LOCAL app.bypass_rls = '1'"))
        else:
            await session.execute(text("SET LOCAL app.bypass_rls = '0'"))

        if org_id is not None:
            await session.execute(text(f"SET LOCAL app.current_org_id = '{int(org_id)}'"))
        else:
            # Set to empty or 0 to indicate no org — policies handle NULL case
            # For public with bypass, org_id may be None
            if not bypass:
                await session.execute(text("SET LOCAL app.current_org_id = ''"))
    except Exception:
        # If SET fails (e.g., setting not defined), ignore — RLS will be permissive via policy handling NULL
        pass


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async with SessionFactory() as session:
        try:
            # Try to set RLS context from current tenant if available
            try:
                from app.core.tenant import get_context_or_none

                ctx = get_context_or_none()
                if ctx:
                    await _set_rls_context(session, ctx.organization_id, bypass=False)
                else:
                    await _set_rls_context(session, None, bypass=False)
            except Exception:
                pass

            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise


async def get_db_public() -> AsyncGenerator[AsyncSession, None]:
    """Public DB session — bypasses RLS for published read (Phase 12)

    Used by /public/* endpoints to allow reading published properties across all orgs.
    Sets app.bypass_rls=1 so RLS policies allow it.
    """

    async with SessionFactory() as session:
        try:
            await _set_rls_context(session, None, bypass=True)
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
