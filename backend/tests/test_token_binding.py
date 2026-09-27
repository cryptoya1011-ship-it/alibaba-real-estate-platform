"""A token is bound to the Telegram identity, not only to the user row id.

After a database reset/restore the same numeric user id can belong to a
different person; such stale tokens must be rejected, while fresh tokens work.
"""
import uuid

import pytest

from app.core.security import create_access_token, decode_access_token

pytestmark = pytest.mark.asyncio


async def test_token_carries_telegram_id_and_works(client, login, auth_header):
    data = await login(telegram_id=424201)
    assert decode_access_token(data["access_token"])["telegram_id"] == 424201
    resp = await client.get("/api/v1/me", headers=auth_header(data["access_token"]))
    assert resp.status_code == 200


async def test_token_for_other_person_with_same_user_id_is_rejected(client, login, auth_header):
    data = await login(telegram_id=424202)
    user_id = data["user"]["id"]
    forged, _ = create_access_token(
        user_id=user_id,
        session_id=str(uuid.uuid4()),
        permissions_version=1,
        telegram_id=999999999,  # someone else held this id before the reset
    )
    resp = await client.get("/api/v1/me", headers=auth_header(forged))
    assert resp.status_code == 401


async def test_legacy_token_without_telegram_id_still_accepted(client, login, auth_header):
    data = await login(telegram_id=424203)
    legacy, _ = create_access_token(user_id=data["user"]["id"], session_id=str(uuid.uuid4()), permissions_version=1)
    resp = await client.get("/api/v1/me", headers=auth_header(legacy))
    assert resp.status_code == 200


async def test_super_admin_cannot_enter_nonexistent_organization(client, login, engine):
    """A stale organization id (old browser session, reset database) is refused
    even for a super admin, instead of issuing a token for a ghost tenant."""
    from sqlalchemy import text

    from tests.conftest import make_init_data

    data = await login(telegram_id=424204)
    async with engine.begin() as conn:
        await conn.execute(text(f"UPDATE users SET is_super_admin=1 WHERE id={data['user']['id']}"))
    resp = await client.post(
        "/api/v1/auth/telegram",
        json={"init_data": make_init_data(424204), "organization_id": 987654},
    )
    assert resp.status_code == 404
    # …while logging in without an organization still works.
    resp = await client.post("/api/v1/auth/telegram", json={"init_data": make_init_data(424204)})
    assert resp.status_code == 200
