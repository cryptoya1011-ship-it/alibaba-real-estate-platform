"""Visits & Notifications Tests — بند 38, 41, 82"""
from __future__ import annotations

import pytest


@pytest.mark.asyncio
async def test_visit_crud_and_notification(client, login, auth_header):
    sess = await login(telegram_id=601)
    token = sess["access_token"]
    resp = await client.post(
        "/api/v1/organizations",
        json={"name": "Org Visit", "slug": "org-visit"},
        headers={**auth_header(token), "Idempotency-Key": "org-visit"},
    )
    assert resp.status_code == 201, resp.text
    org_id = resp.json()["data"]["id"]
    resp = await client.post(
        "/api/v1/auth/select-organization",
        json={"organization_id": org_id},
        headers=auth_header(token),
    )
    token = resp.json()["data"]["access_token"]

    # Create person (customer)
    resp = await client.post(
        "/api/v1/persons",
        json={"first_name": "مشتری بازدید", "phone": "09130000005"},
        headers=auth_header(token),
    )
    assert resp.status_code == 200, resp.text
    person_id = resp.json()["data"]["id"]

    # Create property
    resp = await client.post(
        "/api/v1/properties",
        json={
            "title": "ملک برای بازدید",
            "property_type": "apartment",
            "transaction_type": "sale",
            "built_area": 100,
            "price": 10000000000,
        },
        headers={**auth_header(token), "Idempotency-Key": "prop-visit"},
    )
    assert resp.status_code == 200, resp.text
    prop_id = resp.json()["data"]["id"]

    # Create visit (بند 38)
    resp = await client.post(
        "/api/v1/visits",
        json={
            "property_id": prop_id,
            "customer_id": person_id,
            "visit_date": "2026-09-25",
            "visit_time": "10:00:00",
            "status": "scheduled",
            "notes": "بازدید اول",
        },
        headers=auth_header(token),
    )
    assert resp.status_code == 200, resp.text
    visit = resp.json()["data"]
    assert visit["property_id"] == prop_id
    assert visit["customer_id"] == person_id
    visit_id = visit["id"]
    version = 1
    # Get
    resp = await client.get(f"/api/v1/visits/{visit_id}", headers=auth_header(token))
    assert resp.status_code == 200, resp.text
    assert resp.json()["data"]["status"] == "scheduled"
    version = resp.json()["data"]["version"]

    # List visits
    resp = await client.get("/api/v1/visits", headers=auth_header(token))
    assert resp.status_code == 200, resp.text
    assert resp.json()["meta"]["pagination"]["total"] >= 1

    # List with filter
    resp = await client.get(
        f"/api/v1/visits?property_id={prop_id}", headers=auth_header(token)
    )
    assert resp.status_code == 200, resp.text
    assert resp.json()["meta"]["pagination"]["total"] >= 1

    # Update status to done
    resp = await client.patch(
        f"/api/v1/visits/{visit_id}",
        json={"status": "done", "result": "interested", "version": version},
        headers=auth_header(token),
    )
    assert resp.status_code == 200, resp.text
    assert resp.json()["data"]["status"] == "done"

    # Check notification created for agent (in_app, important) — بند 41
    resp = await client.get("/api/v1/notifications", headers=auth_header(token))
    assert resp.status_code == 200, resp.text
    notifs = resp.json()["data"]
    # Should have at least 1 notification for visit
    assert len(notifs) >= 1
    assert any(n["entity_type"] == "visit" for n in notifs)

    # Unread count
    resp = await client.get("/api/v1/notifications/unread-count", headers=auth_header(token))
    assert resp.status_code == 200, resp.text
    assert resp.json()["data"]["unread_count"] >= 1

    # Mark read
    notif_id = notifs[0]["id"]
    resp = await client.post(
        f"/api/v1/notifications/{notif_id}/read", headers=auth_header(token)
    )
    assert resp.status_code == 200, resp.text
    assert resp.json()["data"]["is_read"] is True

    # Mark all read
    resp = await client.post("/api/v1/notifications/read-all", headers=auth_header(token))
    assert resp.status_code == 200, resp.text

    # Delete visit
    resp = await client.get(f"/api/v1/visits/{visit_id}", headers=auth_header(token))
    version = resp.json()["data"]["version"]
    resp = await client.delete(
        f"/api/v1/visits/{visit_id}?version={version}", headers=auth_header(token)
    )
    assert resp.status_code == 200, resp.text


@pytest.mark.asyncio
async def test_visit_tenant_isolation(client, login, auth_header):
    # Org A visit
    sess_a = await login(telegram_id=701)
    token_a = sess_a["access_token"]
    resp = await client.post(
        "/api/v1/organizations",
        json={"name": "Org Visit A", "slug": "org-visit-a"},
        headers={**auth_header(token_a), "Idempotency-Key": "org-visit-a"},
    )
    org_a = resp.json()["data"]["id"]
    resp = await client.post(
        "/api/v1/auth/select-organization",
        json={"organization_id": org_a},
        headers=auth_header(token_a),
    )
    token_a = resp.json()["data"]["access_token"]

    resp = await client.post(
        "/api/v1/persons",
        json={"first_name": "A", "phone": "09130000006"},
        headers=auth_header(token_a),
    )
    person_a = resp.json()["data"]["id"]
    resp = await client.post(
        "/api/v1/properties",
        json={
            "title": "ملک A",
            "property_type": "apartment",
            "transaction_type": "sale",
            "built_area": 100,
            "price": 1000000000,
        },
        headers={**auth_header(token_a), "Idempotency-Key": "prop-visit-a"},
    )
    prop_a = resp.json()["data"]["id"]
    resp = await client.post(
        "/api/v1/visits",
        json={"property_id": prop_a, "customer_id": person_a, "visit_date": "2026-09-26"},
        headers=auth_header(token_a),
    )
    visit_a_id = resp.json()["data"]["id"]

    # Org B user
    sess_b = await login(telegram_id=702)
    token_b = sess_b["access_token"]
    resp = await client.post(
        "/api/v1/organizations",
        json={"name": "Org Visit B", "slug": "org-visit-b"},
        headers={**auth_header(token_b), "Idempotency-Key": "org-visit-b"},
    )
    org_b = resp.json()["data"]["id"]
    resp = await client.post(
        "/api/v1/auth/select-organization",
        json={"organization_id": org_b},
        headers=auth_header(token_b),
    )
    token_b = resp.json()["data"]["access_token"]

    # B tries to get A's visit → 404
    resp = await client.get(f"/api/v1/visits/{visit_a_id}", headers=auth_header(token_b))
    assert resp.status_code == 404, resp.text


@pytest.mark.asyncio
async def test_notifications_priority_and_channels(client, login, auth_header):
    sess = await login(telegram_id=801)
    token = sess["access_token"]
    resp = await client.post(
        "/api/v1/organizations",
        json={"name": "Org Notif", "slug": "org-notif"},
        headers={**auth_header(token), "Idempotency-Key": "org-notif"},
    )
    org_id = resp.json()["data"]["id"]
    resp = await client.post(
        "/api/v1/auth/select-organization",
        json={"organization_id": org_id},
        headers=auth_header(token),
    )
    token = resp.json()["data"]["access_token"]
    user_id = resp.json()["data"]["user"]["id"]

    # Create notifications with different priorities (بند 82)
    for priority in ["critical", "important", "normal", "informational"]:
        resp = await client.post(
            "/api/v1/notifications",
            json={
                "user_id": user_id,
                "channel": "in_app",
                "priority": priority,
                "title": f"تست {priority}",
                "body": f"این یک اعلان {priority} است",
            },
            headers=auth_header(token),
        )
        assert resp.status_code == 200, resp.text

    # List with priority filter
    resp = await client.get(
        "/api/v1/notifications?priority=critical", headers=auth_header(token)
    )
    assert resp.status_code == 200, resp.text
    assert resp.json()["meta"]["pagination"]["total"] >= 1
    assert all(n["priority"] == "critical" for n in resp.json()["data"])
