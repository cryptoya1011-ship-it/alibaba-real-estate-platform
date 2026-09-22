"""Tests for Phase 13 Multi-Tenant — Org A,B,C isolation + Invitations + Custom Roles + Admin"""

import pytest


@pytest.mark.asyncio
async def test_multi_tenant_isolation_abc(client, login, auth_header):
    # Create 3 users, 3 orgs
    sess_a = await login(telegram_id=13001)
    token_a = sess_a["access_token"]
    resp = await client.post(
        "/api/v1/organizations",
        json={"name": "Org A", "slug": "org-a-mt"},
        headers={**auth_header(token_a), "Idempotency-Key": "org-a-mt"},
    )
    assert resp.status_code == 201, resp.text
    org_a = resp.json()["data"]["id"]
    resp = await client.post(
        "/api/v1/auth/select-organization", json={"organization_id": org_a}, headers=auth_header(token_a)
    )
    token_a = resp.json()["data"]["access_token"]

    sess_b = await login(telegram_id=13002)
    token_b = sess_b["access_token"]
    resp = await client.post(
        "/api/v1/organizations",
        json={"name": "Org B", "slug": "org-b-mt"},
        headers={**auth_header(token_b), "Idempotency-Key": "org-b-mt"},
    )
    assert resp.status_code == 201
    org_b = resp.json()["data"]["id"]
    resp = await client.post(
        "/api/v1/auth/select-organization", json={"organization_id": org_b}, headers=auth_header(token_b)
    )
    token_b = resp.json()["data"]["access_token"]

    sess_c = await login(telegram_id=13003)
    token_c = sess_c["access_token"]
    resp = await client.post(
        "/api/v1/organizations",
        json={"name": "Org C", "slug": "org-c-mt"},
        headers={**auth_header(token_c), "Idempotency-Key": "org-c-mt"},
    )
    assert resp.status_code == 201
    org_c = resp.json()["data"]["id"]
    resp = await client.post(
        "/api/v1/auth/select-organization", json={"organization_id": org_c}, headers=auth_header(token_c)
    )
    token_c = resp.json()["data"]["access_token"]

    # Each creates a property
    payload = {
        "title": "ملک تست",
        "property_type": "apartment",
        "transaction_type": "sale",
        "built_area": 100,
        "price": 1000000000,
    }
    r_a = await client.post(
        "/api/v1/properties", json=payload, headers={**auth_header(token_a), "Idempotency-Key": "prop-a-mt"}
    )
    assert r_a.status_code == 200
    id_a = r_a.json()["data"]["id"]

    r_b = await client.post(
        "/api/v1/properties", json=payload, headers={**auth_header(token_b), "Idempotency-Key": "prop-b-mt"}
    )
    assert r_b.status_code == 200
    id_b = r_b.json()["data"]["id"]

    r_c = await client.post(
        "/api/v1/properties", json=payload, headers={**auth_header(token_c), "Idempotency-Key": "prop-c-mt"}
    )
    assert r_c.status_code == 200
    id_c = r_c.json()["data"]["id"]

    # Isolation: A cannot see B or C
    for token, other_id in [(token_a, id_b), (token_a, id_c), (token_b, id_a), (token_c, id_a)]:
        r = await client.get(f"/api/v1/properties/{other_id}", headers=auth_header(token))
        assert r.status_code == 404, f"Expected 404 for cross-tenant access, got {r.status_code} {r.text}"

    # List should only show own
    r_list_a = await client.get("/api/v1/properties", headers=auth_header(token_a))
    assert r_list_a.status_code == 200
    assert len(r_list_a.json()["data"]) == 1
    assert r_list_a.json()["data"][0]["id"] == id_a


@pytest.mark.asyncio
async def test_invitation_flow(client, login, auth_header):
    # Org admin creates invitation for user B
    sess_admin = await login(telegram_id=13101)
    token_admin = sess_admin["access_token"]
    resp = await client.post(
        "/api/v1/organizations",
        json={"name": "Org Invite", "slug": "org-invite"},
        headers={**auth_header(token_admin), "Idempotency-Key": "org-invite"},
    )
    org_id = resp.json()["data"]["id"]
    resp = await client.post(
        "/api/v1/auth/select-organization", json={"organization_id": org_id}, headers=auth_header(token_admin)
    )
    token_admin = resp.json()["data"]["access_token"]

    # Create invitation for telegram_id 13102 as agent
    resp = await client.post(
        f"/api/v1/organizations/{org_id}/invitations",
        json={"invited_telegram_id": 13102, "role_code": "agent"},
        headers=auth_header(token_admin),
    )
    assert resp.status_code == 200, resp.text
    data = resp.json()["data"]
    assert "token" in data
    raw_token = data["token"]
    inv_id = data["id"]

    # List invitations
    resp = await client.get(f"/api/v1/organizations/{org_id}/invitations", headers=auth_header(token_admin))
    assert resp.status_code == 200
    assert len(resp.json()["data"]) >= 1

    # User B accepts
    sess_b = await login(telegram_id=13102)
    token_b = sess_b["access_token"]
    resp = await client.post(
        "/api/v1/invitations/accept", json={"token": raw_token}, headers=auth_header(token_b)
    )
    assert resp.status_code == 200, resp.text
    assert resp.json()["data"]["status"] == "accepted"

    # After accept, permissions_version bumped → old token invalid, need re-login
    sess_b2 = await login(telegram_id=13102)
    token_b2 = sess_b2["access_token"]

    # Now B should be able to select org and see properties
    resp = await client.post(
        "/api/v1/auth/select-organization", json={"organization_id": org_id}, headers=auth_header(token_b2)
    )
    assert resp.status_code == 200, resp.text
    token_b_org = resp.json()["data"]["access_token"]

    # B creates property (agent has property:create)
    resp = await client.post(
        "/api/v1/properties",
        json={"title": "ملک دعوتی", "property_type": "apartment", "transaction_type": "sale", "built_area": 80},
        headers={**auth_header(token_b_org), "Idempotency-Key": "prop-invite"},
    )
    assert resp.status_code == 200, resp.text

    # Try accept again should 404 (already accepted) — need fresh token again because version bumped once
    sess_b3 = await login(telegram_id=13102)
    token_b3 = sess_b3["access_token"]
    resp = await client.post(
        "/api/v1/invitations/accept", json={"token": raw_token}, headers=auth_header(token_b3)
    )
    assert resp.status_code == 404

    # Admin tries to revoke already accepted → conflict
    resp = await client.delete(
        f"/api/v1/organizations/{org_id}/invitations/{inv_id}", headers=auth_header(token_admin)
    )
    assert resp.status_code in (400, 404, 409)


@pytest.mark.asyncio
async def test_custom_roles(client, login, auth_header):
    sess = await login(telegram_id=13201)
    token = sess["access_token"]
    resp = await client.post(
        "/api/v1/organizations",
        json={"name": "Org Roles", "slug": "org-roles"},
        headers={**auth_header(token), "Idempotency-Key": "org-roles"},
    )
    org_id = resp.json()["data"]["id"]
    resp = await client.post(
        "/api/v1/auth/select-organization", json={"organization_id": org_id}, headers=auth_header(token)
    )
    token = resp.json()["data"]["access_token"]

    # List roles — should have system roles
    resp = await client.get(f"/api/v1/organizations/{org_id}/roles", headers=auth_header(token))
    assert resp.status_code == 200, resp.text
    roles = resp.json()["data"]
    assert any(r["code"] == "organization_admin" for r in roles)

    # Create custom role
    resp = await client.post(
        f"/api/v1/organizations/{org_id}/roles",
        json={"code": "sales_manager", "title": "مدیر فروش", "permission_codes": ["property:read", "property:create", "customer:read"]},
        headers=auth_header(token),
    )
    assert resp.status_code == 201, resp.text
    role_id = resp.json()["data"]["id"]
    assert resp.json()["data"]["code"] == "sales_manager"

    # Get role detail
    resp = await client.get(f"/api/v1/organizations/{org_id}/roles/{role_id}", headers=auth_header(token))
    assert resp.status_code == 200
    assert "property:read" in resp.json()["data"]["permissions"]

    # Update role
    resp = await client.patch(
        f"/api/v1/organizations/{org_id}/roles/{role_id}",
        json={"title": "مدیر فروش ارشد", "permission_codes": ["property:read", "customer:read"]},
        headers=auth_header(token),
    )
    assert resp.status_code == 200
    assert resp.json()["data"]["title"] == "مدیر فروش ارشد"
    assert "property:create" not in resp.json()["data"]["permissions"]

    # Try create duplicate code → 409
    resp = await client.post(
        f"/api/v1/organizations/{org_id}/roles",
        json={"code": "sales_manager", "title": "تکراری", "permission_codes": []},
        headers=auth_header(token),
    )
    assert resp.status_code == 409

    # Try create system code → 409
    resp = await client.post(
        f"/api/v1/organizations/{org_id}/roles",
        json={"code": "agent", "title": "تکراری سیستمی", "permission_codes": []},
        headers=auth_header(token),
    )
    assert resp.status_code == 409

    # Delete custom role
    resp = await client.delete(f"/api/v1/organizations/{org_id}/roles/{role_id}", headers=auth_header(token))
    assert resp.status_code == 200

    # Get after delete → 404
    resp = await client.get(f"/api/v1/organizations/{org_id}/roles/{role_id}", headers=auth_header(token))
    assert resp.status_code == 404

    # Try delete system role → 403
    # Find org_admin role id
    resp = await client.get(f"/api/v1/organizations/{org_id}/roles", headers=auth_header(token))
    sys_role = next((r for r in resp.json()["data"] if r["code"] == "organization_admin"), None)
    if sys_role:
        resp = await client.delete(f"/api/v1/organizations/{org_id}/roles/{sys_role['id']}", headers=auth_header(token))
        assert resp.status_code == 403


@pytest.mark.asyncio
async def test_admin_dashboard(client, login, auth_header, engine):
    # Create normal user and org
    sess_user = await login(telegram_id=13301)
    token_user = sess_user["access_token"]
    resp = await client.post(
        "/api/v1/organizations",
        json={"name": "Org Normal", "slug": "org-normal-admin"},
        headers={**auth_header(token_user), "Idempotency-Key": "org-normal-admin"},
    )
    org_normal = resp.json()["data"]["id"]

    resp = await client.post(
        "/api/v1/auth/select-organization", json={"organization_id": org_normal}, headers=auth_header(token_user)
    )
    token_user_org = resp.json()["data"]["access_token"]

    resp = await client.get("/api/v1/admin/organizations", headers=auth_header(token_user_org))
    assert resp.status_code == 403, resp.text

    # Create super admin: login as 13302 and set is_super_admin via engine fixture
    sess_super = await login(telegram_id=13302)
    token_super = sess_super["access_token"]

    resp = await client.get("/api/v1/me", headers=auth_header(token_super))
    user_id = resp.json()["data"]["user"]["id"]

    from sqlalchemy import text

    async with engine.begin() as conn:
        await conn.execute(text(f"UPDATE users SET is_super_admin=1 WHERE id={user_id}"))

    # Re-login to get token with is_super_admin claim
    sess_super2 = await login(telegram_id=13302)
    token_super2 = sess_super2["access_token"]

    # Now admin list should work
    resp = await client.get("/api/v1/admin/organizations", headers=auth_header(token_super2))
    assert resp.status_code == 200, resp.text
    assert resp.json()["meta"]["pagination"]["total"] >= 1

    # Global stats
    resp = await client.get("/api/v1/admin/stats", headers=auth_header(token_super2))
    assert resp.status_code == 200
    assert "organizations" in resp.json()["data"]

    # Org stats
    resp = await client.get(f"/api/v1/admin/organizations/{org_normal}/stats", headers=auth_header(token_super2))
    assert resp.status_code == 200
    assert resp.json()["data"]["organization_id"] == org_normal

    # List users
    resp = await client.get("/api/v1/admin/users", headers=auth_header(token_super2))
    assert resp.status_code == 200
    assert resp.json()["meta"]["pagination"]["total"] >= 2

    # Toggle super admin off for normal user (should fail if trying to toggle self? but we toggle other)
    # Get normal user id
    resp_me = await client.get("/api/v1/me", headers=auth_header(token_user))
    normal_user_id = resp_me.json()["data"]["user"]["id"]

    resp = await client.patch(
        f"/api/v1/admin/users/{normal_user_id}/super-admin",
        json={"is_super_admin": True},
        headers=auth_header(token_super2),
    )
    assert resp.status_code == 200
    assert resp.json()["data"]["is_super_admin"] is True
