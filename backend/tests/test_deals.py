"""Deals & Commission Tests — بند 39, 40"""
from __future__ import annotations

import pytest


@pytest.mark.asyncio
async def test_deal_crud_and_pipeline(client, login, auth_header):
    sess = await login(telegram_id=901)
    token = sess["access_token"]
    resp = await client.post(
        "/api/v1/organizations",
        json={"name": "Org Deal", "slug": "org-deal"},
        headers={**auth_header(token), "Idempotency-Key": "org-deal"},
    )
    assert resp.status_code == 201, resp.text
    org_id = resp.json()["data"]["id"]
    resp = await client.post(
        "/api/v1/auth/select-organization",
        json={"organization_id": org_id},
        headers=auth_header(token),
    )
    token = resp.json()["data"]["access_token"]

    # Create person
    resp = await client.post(
        "/api/v1/persons",
        json={"first_name": "مشتری معامله", "phone": "09130000007"},
        headers=auth_header(token),
    )
    assert resp.status_code == 200, resp.text
    person_id = resp.json()["data"]["id"]

    # Create property (optional for deal)
    resp = await client.post(
        "/api/v1/properties",
        json={
            "title": "ملک برای معامله",
            "property_type": "apartment",
            "transaction_type": "sale",
            "built_area": 100,
            "price": 20000000000,
        },
        headers={**auth_header(token), "Idempotency-Key": "prop-deal"},
    )
    assert resp.status_code == 200, resp.text
    prop_id = resp.json()["data"]["id"]

    # Create deal — بند 39: Deal مستقل از Property ولی می‌تواند داشته باشد
    resp = await client.post(
        "/api/v1/deals",
        json={
            "title": "معامله آپارتمان مرداویج",
            "customer_id": person_id,
            "property_id": prop_id,
            "amount": 20000000000,
            "commission_total": 1000000000,
            "commission_agent_share": 500000000,
            "commission_office_share": 500000000,
            "status": "lead",
        },
        headers=auth_header(token),
    )
    assert resp.status_code == 200, resp.text
    deal = resp.json()["data"]
    assert deal["code"].startswith("DL-")
    assert deal["status"] == "lead"
    deal_id = deal["id"]
    code = deal["code"]

    # Get by id
    resp = await client.get(f"/api/v1/deals/{deal_id}", headers=auth_header(token))
    assert resp.status_code == 200, resp.text
    assert resp.json()["data"]["code"] == code
    version = resp.json()["data"]["version"]

    # Get by code
    resp = await client.get(f"/api/v1/deals/by-code/{code}", headers=auth_header(token))
    assert resp.status_code == 200, resp.text
    assert resp.json()["data"]["id"] == deal_id

    # List
    resp = await client.get("/api/v1/deals", headers=auth_header(token))
    assert resp.status_code == 200, resp.text
    assert resp.json()["meta"]["pagination"]["total"] >= 1

    # Pipeline: Lead → Qualification → Property Match → Visit → Negotiation → Agreement → Closed (بند 39)
    pipeline = ["qualification", "property_match", "visit", "negotiation", "agreement", "closed_won"]
    current_version = version
    for next_status in pipeline:
        resp = await client.patch(
            f"/api/v1/deals/{deal_id}",
            json={"status": next_status, "version": current_version},
            headers=auth_header(token),
        )
        assert resp.status_code == 200, resp.text
        assert resp.json()["data"]["status"] == next_status
        current_version = resp.json()["data"]["version"]

    # History
    resp = await client.get(f"/api/v1/deals/{deal_id}/history", headers=auth_header(token))
    assert resp.status_code == 200, resp.text
    history = resp.json()["data"]
    # Should have at least 7 entries (create + 6 transitions)
    assert len(history) >= 7
    assert history[0]["from_status"] is None
    assert history[0]["to_status"] == "lead"
    assert history[-1]["to_status"] == "closed_won"

    # Check notification created for closed_won
    resp = await client.get("/api/v1/notifications", headers=auth_header(token))
    assert resp.status_code == 200, resp.text
    notifs = resp.json()["data"]
    assert any(n["entity_type"] == "deal" for n in notifs)

    # Commission fields
    resp = await client.get(f"/api/v1/deals/{deal_id}", headers=auth_header(token))
    assert resp.status_code == 200, resp.text
    data = resp.json()["data"]
    assert data["commission_total"] == 1000000000
    assert data["commission_agent_share"] == 500000000

    # Delete
    resp = await client.delete(
        f"/api/v1/deals/{deal_id}?version={current_version}", headers=auth_header(token)
    )
    assert resp.status_code == 200, resp.text


@pytest.mark.asyncio
async def test_deal_without_property(client, login, auth_header):
    """Deal مستقل از Property باشد (بند 39)"""
    sess = await login(telegram_id=902)
    token = sess["access_token"]
    resp = await client.post(
        "/api/v1/organizations",
        json={"name": "Org Deal NoProp", "slug": "org-deal-noprop"},
        headers={**auth_header(token), "Idempotency-Key": "org-deal-noprop"},
    )
    org_id = resp.json()["data"]["id"]
    resp = await client.post(
        "/api/v1/auth/select-organization",
        json={"organization_id": org_id},
        headers=auth_header(token),
    )
    token = resp.json()["data"]["access_token"]

    resp = await client.post(
        "/api/v1/persons",
        json={"first_name": "مشتری بدون ملک", "phone": "09130000008"},
        headers=auth_header(token),
    )
    person_id = resp.json()["data"]["id"]

    # Create deal without property
    resp = await client.post(
        "/api/v1/deals",
        json={"title": "معامله بدون ملک", "customer_id": person_id, "status": "lead"},
        headers=auth_header(token),
    )
    assert resp.status_code == 200, resp.text
    assert resp.json()["data"]["property_id"] is None


@pytest.mark.asyncio
async def test_deal_tenant_isolation(client, login, auth_header):
    sess_a = await login(telegram_id=903)
    token_a = sess_a["access_token"]
    resp = await client.post(
        "/api/v1/organizations",
        json={"name": "Org Deal A", "slug": "org-deal-a"},
        headers={**auth_header(token_a), "Idempotency-Key": "org-deal-a"},
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
        json={"first_name": "A", "phone": "09130000009"},
        headers=auth_header(token_a),
    )
    person_a = resp.json()["data"]["id"]
    resp = await client.post(
        "/api/v1/deals",
        json={"title": "معامله A", "customer_id": person_a},
        headers=auth_header(token_a),
    )
    deal_a_id = resp.json()["data"]["id"]

    sess_b = await login(telegram_id=904)
    token_b = sess_b["access_token"]
    resp = await client.post(
        "/api/v1/organizations",
        json={"name": "Org Deal B", "slug": "org-deal-b"},
        headers={**auth_header(token_b), "Idempotency-Key": "org-deal-b"},
    )
    org_b = resp.json()["data"]["id"]
    resp = await client.post(
        "/api/v1/auth/select-organization",
        json={"organization_id": org_b},
        headers=auth_header(token_b),
    )
    token_b = resp.json()["data"]["access_token"]

    resp = await client.get(f"/api/v1/deals/{deal_a_id}", headers=auth_header(token_b))
    assert resp.status_code == 404, resp.text
