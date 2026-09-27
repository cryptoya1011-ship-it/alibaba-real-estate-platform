"""Property photos + organization members/branches."""
from __future__ import annotations

import io

import pytest
from PIL import Image

from app.core.config import settings


async def _org_admin(client, login, auth_header, telegram_id: int, slug: str) -> tuple[str, int]:
    token = (await login(telegram_id=telegram_id))["access_token"]
    resp = await client.post(
        "/api/v1/organizations",
        json={"name": "املاک رسانه", "slug": slug},
        headers={**auth_header(token), "Idempotency-Key": f"org-{slug}"},
    )
    assert resp.status_code == 201, resp.text
    org_id = resp.json()["data"]["id"]
    resp = await client.post(
        "/api/v1/auth/select-organization", json={"organization_id": org_id}, headers=auth_header(token)
    )
    return resp.json()["data"]["access_token"], org_id


async def _property(client, auth_header, token: str) -> int:
    resp = await client.post(
        "/api/v1/properties",
        json={
            "title": "آپارتمان تست رسانه",
            "property_type": "apartment",
            "transaction_type": "sale",
            "price": 1000,
            "usages": [{"usage_type": "residential", "is_primary": True}],
            "location": {"city": "اصفهان", "city_code": "ISF", "district": "مرکز", "district_code": "CT"},
        },
        headers={**auth_header(token), "Idempotency-Key": "prop-media"},
    )
    assert resp.status_code == 200, resp.text
    return resp.json()["data"]["id"]


def _jpeg_with_gps(size=(3000, 2000)) -> bytes:
    img = Image.new("RGB", size, (20, 120, 110))
    exif = Image.Exif()
    exif[0x010F] = "PhoneMaker"  # Make
    exif[0x8825] = {1: "N", 2: (35.0, 41.0, 0.0)}  # GPS IFD
    buf = io.BytesIO()
    img.save(buf, "JPEG", exif=exif)
    return buf.getvalue()


@pytest.mark.asyncio
async def test_media_upload_process_order_delete(client, login, auth_header, tmp_path, monkeypatch):
    monkeypatch.setattr(settings, "MEDIA_ROOT", str(tmp_path))
    token, _ = await _org_admin(client, login, auth_header, 7001, "media-org")
    pid = await _property(client, auth_header, token)
    h = auth_header(token)

    # Invalid file is rejected
    resp = await client.post(
        f"/api/v1/properties/{pid}/media", files={"file": ("x.jpg", b"not an image", "image/jpeg")}, headers=h
    )
    assert resp.status_code == 422, resp.text

    ids = []
    for i in range(3):
        resp = await client.post(
            f"/api/v1/properties/{pid}/media",
            files={"file": (f"p{i}.jpg", _jpeg_with_gps(), "image/jpeg")},
            headers=h,
        )
        assert resp.status_code == 201, resp.text
        ids.append(resp.json()["data"]["id"])
        assert resp.json()["data"]["is_primary"] is (i == 0)

    key = resp.json()["data"]["file_path"]
    assert "." not in key.split("/")[-1]  # extension-less (nginx static regex)

    # Public file: resized + metadata stripped
    resp = await client.get(f"/api/v1/media/{key}")
    assert resp.status_code == 200
    assert resp.headers["content-type"] == "image/jpeg"
    out = Image.open(io.BytesIO(resp.content))
    assert max(out.size) == settings.MEDIA_MAX_DIMENSION
    assert len(out.getexif()) == 0
    resp = await client.get(f"/api/v1/media/{key}?size=thumb")
    assert max(Image.open(io.BytesIO(resp.content)).size) == settings.MEDIA_THUMB_DIMENSION
    assert (await client.get("/api/v1/media/../../etc/passwd")).status_code == 404

    # Property detail + list expose the images
    detail = (await client.get(f"/api/v1/properties/{pid}", headers=h)).json()["data"]
    assert [m["id"] for m in detail["media"]] == ids

    # Reorder + set primary
    resp = await client.put(f"/api/v1/properties/{pid}/media/order", json={"media_ids": ids[::-1]}, headers=h)
    data = resp.json()["data"]
    assert [m["id"] for m in data] == ids[::-1]
    assert [m["id"] for m in data if m["is_primary"]] == [ids[2]]  # first photo is the cover
    resp = await client.post(f"/api/v1/properties/{pid}/media/{ids[1]}/primary", headers=h)
    data = resp.json()["data"]
    assert [m["id"] for m in data if m["is_primary"]] == [ids[1]]
    assert data[0]["id"] == ids[1]  # the cover moves to the front
    resp = await client.post(f"/api/v1/properties/{pid}/media/{ids[2]}/primary", headers=h)
    assert [m["id"] for m in resp.json()["data"] if m["is_primary"]] == [ids[2]]

    # Delete primary → next image becomes primary, files removed
    resp = await client.delete(f"/api/v1/properties/{pid}/media/{ids[2]}", headers=h)
    items = resp.json()["data"]
    assert len(items) == 2 and sum(m["is_primary"] for m in items) == 1
    assert (await client.get(f"/api/v1/media/{key}")).status_code == 404

    # Other organizations cannot touch these photos
    other, _ = await _org_admin(client, login, auth_header, 7002, "media-other")
    resp = await client.post(
        f"/api/v1/properties/{pid}/media",
        files={"file": ("p.jpg", _jpeg_with_gps((50, 50)), "image/jpeg")},
        headers=auth_header(other),
    )
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_members_roles_branches_remove(client, login, auth_header):
    token, org_id = await _org_admin(client, login, auth_header, 7101, "members-org")
    h = auth_header(token)
    inv = (
        await client.post(
            f"/api/v1/organizations/{org_id}/invitations",
            json={"invited_telegram_id": 7102, "role_code": "agent"},
            headers=h,
        )
    ).json()["data"]
    agent_token = (await login(telegram_id=7102))["access_token"]
    resp = await client.post("/api/v1/invitations/accept", json={"token": inv["token"]}, headers=auth_header(agent_token))
    assert resp.status_code == 200, resp.text
    agent_token = (await login(telegram_id=7102, organization_id=org_id))["access_token"]

    members = (await client.get("/api/v1/organizations/current/members", headers=h)).json()["data"]
    assert len(members) == 2
    owner = next(m for m in members if m["is_owner"])
    agent = next(m for m in members if not m["is_owner"])
    assert [r["code"] for r in agent["roles"]] == ["agent"]

    # Cannot change yourself / agents cannot manage
    assert (
        await client.put(
            f"/api/v1/organizations/current/members/{owner['user_id']}/roles", json={"role_codes": ["agent"]}, headers=h
        )
    ).status_code == 403
    assert (
        await client.put(
            f"/api/v1/organizations/current/members/{agent['user_id']}/roles",
            json={"role_codes": ["organization_admin"]},
            headers=auth_header(agent_token),
        )
    ).status_code == 403

    # Promote agent → branch_admin; old agent token becomes invalid
    resp = await client.put(
        f"/api/v1/organizations/current/members/{agent['user_id']}/roles",
        json={"role_codes": ["branch_admin"]},
        headers=h,
    )
    assert resp.status_code == 200, resp.text
    assert [r["code"] for r in resp.json()["data"]["roles"]] == ["branch_admin"]
    assert (await client.get("/api/v1/properties", headers=auth_header(agent_token))).status_code == 401
    assert (
        await client.put(
            f"/api/v1/organizations/current/members/{agent['user_id']}/roles", json={"role_codes": ["nope"]}, headers=h
        )
    ).status_code == 422

    # Branches: create, edit, assign
    br = (
        await client.post(
            "/api/v1/organizations/current/branches",
            json={"name": "شعبه مرکزی", "code": "B1"},
            headers={**h, "Idempotency-Key": "br-1"},
        )
    ).json()["data"]
    resp = await client.patch(
        f"/api/v1/organizations/current/branches/{br['id']}",
        json={"name": "شعبه مرکزی اصفهان", "is_main": True, "version": br["version"]},
        headers=h,
    )
    assert resp.status_code == 200, resp.text
    assert resp.json()["data"]["name"] == "شعبه مرکزی اصفهان" and resp.json()["data"]["is_main"] is True
    assert (
        await client.patch(
            f"/api/v1/organizations/current/branches/{br['id']}", json={"name": "x2", "version": 1}, headers=h
        )
    ).status_code == 409
    resp = await client.put(
        f"/api/v1/organizations/current/members/{agent['user_id']}/branches",
        json={"branch_ids": [br["id"]]},
        headers=h,
    )
    assert resp.status_code == 200, resp.text
    assert resp.json()["data"]["branches"][0]["is_default"] is True

    # Suspend, reactivate, remove
    resp = await client.patch(
        f"/api/v1/organizations/current/members/{agent['user_id']}", json={"is_active": False}, headers=h
    )
    assert resp.json()["data"]["is_active"] is False
    resp = await client.patch(
        f"/api/v1/organizations/current/members/{agent['user_id']}", json={"is_active": True}, headers=h
    )
    assert resp.json()["data"]["is_active"] is True
    assert (await client.delete(f"/api/v1/organizations/current/members/{agent['user_id']}", headers=h)).status_code == 200
    members = (await client.get("/api/v1/organizations/current/members", headers=h)).json()["data"]
    assert [m["user_id"] for m in members] == [owner["user_id"]]
    assert (await client.delete(f"/api/v1/organizations/current/members/{owner['user_id']}", headers=h)).status_code == 403

    # Removed member can be invited again
    inv2 = (
        await client.post(
            f"/api/v1/organizations/{org_id}/invitations",
            json={"invited_telegram_id": 7102, "role_code": "agent"},
            headers=h,
        )
    ).json()["data"]
    agent_token = (await login(telegram_id=7102))["access_token"]
    resp = await client.post("/api/v1/invitations/accept", json={"token": inv2["token"]}, headers=auth_header(agent_token))
    assert resp.status_code == 200, resp.text
