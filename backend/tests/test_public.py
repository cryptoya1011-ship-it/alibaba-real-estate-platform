"""Tests for Public Platform — Phase 10-12 (بند 62)

- Public endpoints without auth
- Only published properties visible
- OG page
"""

import pytest


@pytest.mark.asyncio
async def test_public_properties(client, login, auth_header):
    # Create org and property with published status
    sess = await login(telegram_id=7000001)
    token = sess["access_token"]
    resp = await client.post(
        "/api/v1/organizations",
        json={"name": "Public Org", "slug": "public-org"},
        headers={**auth_header(token), "Idempotency-Key": "org-pub"},
    )
    assert resp.status_code == 201, resp.text
    org_id = resp.json()["data"]["id"]
    resp = await client.post(
        "/api/v1/auth/select-organization",
        json={"organization_id": org_id},
        headers=auth_header(token),
    )
    assert resp.status_code == 200, resp.text
    token_pub = resp.json()["data"]["access_token"]
    auth_h = auth_header(token_pub)

    # Create published property
    payload_pub = {
        "title": "آپارتمان لوکس برای فروش عمومی",
        "property_type": "apartment",
        "transaction_type": "sale",
        "status": "published",
        "built_area": 120,
        "price": 50000000000,
        "has_parking": True,
        "has_elevator": True,
        "owner_name": "مالک تست",
        "owner_phone": "09130000001",
        "location": {"city": "اصفهان", "city_code": "ISF", "district": "مرداویج", "district_code": "MJ"},
        "usages": [{"usage_type": "residential", "is_primary": True}],
    }
    r_pub = await client.post(
        "/api/v1/properties", json=payload_pub, headers={**auth_h, "Idempotency-Key": "pub-1"}
    )
    assert r_pub.status_code == 200, r_pub.text
    code_pub = r_pub.json()["data"]["code"]
    prop_id = r_pub.json()["data"]["id"]

    # Create draft property (should NOT be visible publicly)
    payload_draft = {
        "title": "ملک پیش‌نویس",
        "property_type": "villa",
        "transaction_type": "sale",
        "status": "draft",
        "built_area": 200,
        "price": 10000000000,
        "has_parking": False,
        "has_elevator": False,
        "owner_name": "مالک",
        "owner_phone": "09130000002",
        "location": {"city": "اصفهان", "city_code": "ISF", "district": "سپاهان", "district_code": "SP"},
        "usages": [{"usage_type": "residential", "is_primary": True}],
    }
    r_draft = await client.post(
        "/api/v1/properties", json=payload_draft, headers={**auth_h, "Idempotency-Key": "draft-1"}
    )
    assert r_draft.status_code == 200
    code_draft = r_draft.json()["data"]["code"]

    # Public list — no auth — should include published, not draft
    r_list = await client.get("/api/v1/public/properties")
    assert r_list.status_code == 200, r_list.text
    items = r_list.json()["data"]
    codes = [p["code"] for p in items]
    assert code_pub in codes
    assert code_draft not in codes

    # Public by-code — published OK
    r_by_code = await client.get(f"/api/v1/public/properties/by-code/{code_pub}")
    assert r_by_code.status_code == 200, r_by_code.text
    data = r_by_code.json()["data"]
    assert data["code"] == code_pub
    # Public DTO should NOT have owner_name / exact_address
    assert data.get("owner_name") is None
    assert data["title"] == payload_pub["title"]

    # Public by-code — draft should 404
    r_by_code_draft = await client.get(f"/api/v1/public/properties/by-code/{code_draft}")
    assert r_by_code_draft.status_code == 404

    # Public by id
    r_by_id = await client.get(f"/api/v1/public/properties/{prop_id}")
    assert r_by_id.status_code == 200

    # OG page — HTML with OG tags
    r_og = await client.get(f"/api/v1/public/og/{code_pub}")
    assert r_og.status_code == 200
    assert "og:title" in r_og.text
    assert "application/ld+json" in r_og.text

    # OG for draft → 404
    r_og_draft = await client.get(f"/api/v1/public/og/{code_draft}")
    assert r_og_draft.status_code == 404


@pytest.mark.asyncio
async def test_public_search_filters(client, login, auth_header):
    sess = await login(telegram_id=7000002)
    token = sess["access_token"]
    resp = await client.post(
        "/api/v1/organizations",
        json={"name": "Public Filter Org", "slug": "public-filter-org"},
        headers={**auth_header(token), "Idempotency-Key": "org-pub-filter"},
    )
    assert resp.status_code == 201, resp.text
    org_id = resp.json()["data"]["id"]
    resp = await client.post(
        "/api/v1/auth/select-organization",
        json={"organization_id": org_id},
        headers=auth_header(token),
    )
    token2 = resp.json()["data"]["access_token"]
    auth_h = auth_header(token2)

    payload = {
        "title": "ویلا شمال عمومی",
        "property_type": "villa",
        "transaction_type": "sale",
        "status": "published",
        "built_area": 300,
        "price": 80000000000,
        "has_parking": True,
        "has_elevator": False,
        "owner_name": "مالک",
        "owner_phone": "09130000003",
        "location": {"city": "شمال", "city_code": "SHM", "district": "جنگل", "district_code": "JG"},
        "usages": [{"usage_type": "residential", "is_primary": True}],
    }
    r = await client.post(
        "/api/v1/properties", json=payload, headers={**auth_h, "Idempotency-Key": "filter-1"}
    )
    assert r.status_code == 200, r.text

    # Public filter by property_type
    r_f = await client.get("/api/v1/public/properties?property_type=villa")
    assert r_f.status_code == 200
    assert any(p["property_type"] == "villa" for p in r_f.json()["data"])

    # Public filter by q
    r_q = await client.get("/api/v1/public/properties?q=شمال")
    assert r_q.status_code == 200
