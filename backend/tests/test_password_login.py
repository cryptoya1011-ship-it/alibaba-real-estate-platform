"""Temporary username/password login (ADR-0023)."""

import pytest

from app.core.config import settings


@pytest.fixture
def password_login(monkeypatch):
    monkeypatch.setattr(settings, "PASSWORD_LOGIN_ENABLED", True)
    monkeypatch.setattr(settings, "LOGIN_USERNAME", "admin")
    monkeypatch.setattr(settings, "LOGIN_PASSWORD", "a-strong-pass-123")
    monkeypatch.setattr(settings, "LOGIN_TELEGRAM_ID", 31001)


@pytest.mark.asyncio
async def test_methods_endpoint_default(client):
    resp = await client.get("/api/v1/auth/methods")
    assert resp.status_code == 200, resp.text
    data = resp.json()["data"]
    assert data == {"telegram": True, "password": False, "dev": True}


@pytest.mark.asyncio
async def test_password_login_disabled_by_default(client):
    resp = await client.post("/api/v1/auth/password", json={"username": "admin", "password": "x"})
    assert resp.status_code == 401
    assert "غیرفعال" in resp.json()["error"]["message"]


@pytest.mark.asyncio
async def test_password_login_flow(client, login, password_login):
    assert (await client.get("/api/v1/auth/methods")).json()["data"]["password"] is True

    resp = await client.post("/api/v1/auth/password", json={"username": "admin", "password": "wrong-password"})
    assert resp.status_code == 401
    assert "اشتباه" in resp.json()["error"]["message"]
    assert "a-strong-pass-123" not in resp.text

    resp = await client.post("/api/v1/auth/password", json={"username": "admin", "password": "a-strong-pass-123"})
    assert resp.status_code == 200, resp.text
    data = resp.json()["data"]
    assert data["user"]["telegram_id"] == 31001
    token = data["access_token"]
    me = await client.get("/api/v1/me", headers={"Authorization": f"Bearer {token}"})
    assert me.status_code == 200, me.text

    # Same account as the Telegram login for that ID
    tg = await login(telegram_id=31001)
    assert tg["user"]["id"] == data["user"]["id"]


def test_weak_password_rejected_by_config():
    from app.core.config import Settings

    with pytest.raises(ValueError):
        Settings(PASSWORD_LOGIN_ENABLED=True, LOGIN_USERNAME="admin", LOGIN_PASSWORD="short", LOGIN_TELEGRAM_ID=1)
    with pytest.raises(ValueError):
        Settings(PASSWORD_LOGIN_ENABLED=True, LOGIN_PASSWORD="long-enough-pass", LOGIN_TELEGRAM_ID=1)
