"""Test harness: isolated SQLite database, real app, no external services."""
from __future__ import annotations

import os
import pathlib

os.environ.update(
    ENV="test",
    DEBUG="false",
    DATABASE_URL="sqlite+aiosqlite:///./test_arep.db",
    JWT_SECRET="test-secret-not-for-production",
    TELEGRAM_BOT_TOKEN="123456:TEST-BOT-TOKEN",
    ALLOW_DEV_LOGIN="true",
)

import time  # noqa: E402
import pytest  # noqa: E402
import pytest_asyncio  # noqa: E402
from httpx import ASGITransport, AsyncClient  # noqa: E402
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine  # noqa: E402

from app.core.security import build_init_data  # noqa: E402
from app.db.models_registry import Base  # noqa: E402
from app.db.session import get_db  # noqa: E402
from app.main import create_app  # noqa: E402

DB_FILE = pathlib.Path("test_arep.db")
BOT_TOKEN = "123456:TEST-BOT-TOKEN"


@pytest_asyncio.fixture
async def engine():
    if DB_FILE.exists():
        DB_FILE.unlink()
    eng = create_async_engine("sqlite+aiosqlite:///./test_arep.db", connect_args={"check_same_thread": False})
    async with eng.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield eng
    await eng.dispose()
    if DB_FILE.exists():
        DB_FILE.unlink()


@pytest_asyncio.fixture
async def client(engine):
    factory = async_sessionmaker(bind=engine, expire_on_commit=False, autoflush=False)

    async def _override_get_db():
        async with factory() as session:
            try:
                yield session
                await session.commit()
            except Exception:
                await session.rollback()
                raise

    app = create_app()
    app.dependency_overrides[get_db] = _override_get_db
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac
    app.dependency_overrides.clear()


def make_init_data(telegram_id: int, first_name: str = "Ali", auth_date: int | None = None) -> str:
    import json

    return build_init_data(
        {
            "auth_date": str(auth_date or int(time.time())),
            "query_id": "AAF_test",
            "user": json.dumps({"id": telegram_id, "first_name": first_name, "username": f"u{telegram_id}"}),
        },
        BOT_TOKEN,
    )


@pytest_asyncio.fixture
async def login(client):
    async def _login(telegram_id: int = 111, organization_id: int | None = None) -> dict:
        response = await client.post(
            "/api/v1/auth/telegram",
            json={"init_data": make_init_data(telegram_id), "organization_id": organization_id},
        )
        assert response.status_code == 200, response.text
        return response.json()["data"]

    return _login


def auth(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def auth_header():
    return auth
