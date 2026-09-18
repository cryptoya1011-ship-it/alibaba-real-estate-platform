"""Operational CLI: seed RBAC, promote a super admin, inspect state.

Usage (from the backend directory, venv active):
    python -m app.cli seed
    python -m app.cli make-super-admin <telegram_id>
    python -m app.cli status
"""
from __future__ import annotations

import asyncio
import sys

from sqlalchemy import func, select

from app.core.config import settings
from app.db.models_registry import Base  # noqa: F401
from app.db.session import SessionFactory
from app.modules.organizations.models import Organization
from app.modules.rbac.models import Permission, Role
from app.modules.rbac.service import RbacService
from app.modules.users.models import User


async def seed() -> None:
    async with SessionFactory() as session:
        rbac = RbacService(session)
        roles = await rbac.ensure_system_roles()
        await session.commit()
        print(f"permissions + system roles ensured: {sorted(roles)}")


async def make_super_admin(telegram_id: int) -> None:
    async with SessionFactory() as session:
        user = (
            await session.execute(select(User).where(User.telegram_id == telegram_id))
        ).scalars().first()
        if user is None:
            print(f"user with telegram_id={telegram_id} not found; log in through the app once first")
            return
        user.is_super_admin = True
        user.permissions_version += 1  # invalidates existing tokens
        await session.commit()
        print(f"user {user.id} ({user.display_name}) is now super admin; previous tokens invalidated")


async def status() -> None:
    async with SessionFactory() as session:
        async def count(model) -> int:
            return int((await session.execute(select(func.count()).select_from(model))).scalar_one())

        print(f"database        : {settings.DATABASE_URL}")
        print(f"users           : {await count(User)}")
        print(f"organizations   : {await count(Organization)}")
        print(f"roles           : {await count(Role)}")
        print(f"permissions     : {await count(Permission)}")


def main() -> None:
    if len(sys.argv) < 2:
        print(__doc__)
        raise SystemExit(1)
    command = sys.argv[1]
    if command == "seed":
        asyncio.run(seed())
    elif command == "make-super-admin":
        if len(sys.argv) < 3:
            raise SystemExit("telegram_id is required")
        asyncio.run(make_super_admin(int(sys.argv[2])))
    elif command == "status":
        asyncio.run(status())
    else:
        print(__doc__)
        raise SystemExit(1)


if __name__ == "__main__":
    main()
