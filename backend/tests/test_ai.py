"""Tests for Phase 14 AI / Automation — Adapter + Natural Language Search + Matching"""

import pytest


@pytest.mark.asyncio
async def test_ai_providers_list(client, login, auth_header):
    sess = await login(telegram_id=14001)
    token = sess["access_token"]
    resp = await client.post(
        "/api/v1/organizations",
        json={"name": "Org AI", "slug": "org-ai"},
        headers={**auth_header(token), "Idempotency-Key": "org-ai"},
    )
    org_id = resp.json()["data"]["id"]
    resp = await client.post(
        "/api/v1/auth/select-organization", json={"organization_id": org_id}, headers=auth_header(token)
    )
    token = resp.json()["data"]["access_token"]

    resp = await client.get("/api/v1/ai/providers", headers=auth_header(token))
    assert resp.status_code == 200, resp.text
    data = resp.json()["data"]
    assert "current" in data
    assert "available" in data
    assert "mock" in data["available"]


@pytest.mark.asyncio
async def test_ai_parse_search_query(client, login, auth_header):
    sess = await login(telegram_id=14002)
    token = sess["access_token"]
    resp = await client.post(
        "/api/v1/organizations",
        json={"name": "Org AI Parse", "slug": "org-ai-parse"},
        headers={**auth_header(token), "Idempotency-Key": "org-ai-parse"},
    )
    org_id = resp.json()["data"]["id"]
    resp = await client.post(
        "/api/v1/auth/select-organization", json={"organization_id": org_id}, headers=auth_header(token)
    )
    token = resp.json()["data"]["access_token"]

    # Persian natural language search
    resp = await client.post(
        "/api/v1/ai/search/parse",
        json={"text": "آپارتمان 120 متری در مرداویج اصفهان با پارکینگ و آسانسور تا 15 میلیارد"},
        headers=auth_header(token),
    )
    assert resp.status_code == 200, resp.text
    data = resp.json()["data"]
    assert data["property_type"] == "apartment"
    assert data["city"] == "اصفهان"
    assert data["district"] == "مرداویج"
    assert data["has_parking"] is True
    assert data["has_elevator"] is True
    assert data["max_price"] == 15000000000
    assert data["parsed_by"] in ("mock", "openai", "gemini", "claude", "local", "openai_mock_fallback", "gemini_mock_fallback", "claude_mock_fallback")
    assert "filters" in data
    assert data["filters"]["property_type"] == "apartment"
    assert data["filters"]["max_price"] == 15000000000

    # Test 2: ویلا
    resp = await client.post(
        "/api/v1/ai/search/parse",
        json={"text": "ویلا 3 خوابه در شمال"},
        headers=auth_header(token),
    )
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert data["property_type"] == "villa"
    assert data["bedrooms"] == 3

    # Test 3: short text should 422
    resp = await client.post(
        "/api/v1/ai/search/parse",
        json={"text": "ا"},
        headers=auth_header(token),
    )
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_ai_search_execute(client, login, auth_header):
    sess = await login(telegram_id=14003)
    token = sess["access_token"]
    resp = await client.post(
        "/api/v1/organizations",
        json={"name": "Org AI Exec", "slug": "org-ai-exec"},
        headers={**auth_header(token), "Idempotency-Key": "org-ai-exec"},
    )
    org_id = resp.json()["data"]["id"]
    resp = await client.post(
        "/api/v1/auth/select-organization", json={"organization_id": org_id}, headers=auth_header(token)
    )
    token = resp.json()["data"]["access_token"]

    # Create properties
    payload = {
        "title": "آپارتمان مرداویج 120 متری",
        "property_type": "apartment",
        "transaction_type": "sale",
        "built_area": 120,
        "price": 14000000000,
        "has_parking": True,
        "has_elevator": True,
        "owner_name": "مالک تست",
        "owner_phone": "09130000000",
        "location": {"city": "اصفهان", "city_code": "ISF", "district": "مرداویج", "district_code": "MJ"},
        "usages": [{"usage_type": "residential", "is_primary": True}],
    }
    resp = await client.post(
        "/api/v1/properties", json=payload, headers={**auth_header(token), "Idempotency-Key": "prop-ai-1"}
    )
    assert resp.status_code == 200, resp.text

    payload2 = {
        "title": "ویلا شمال 300 متری",
        "property_type": "villa",
        "transaction_type": "sale",
        "built_area": 300,
        "price": 50000000000,
        "owner_name": "مالک تست",
        "owner_phone": "09130000001",
        "location": {"city": "تهران", "city_code": "THR", "district": "زعفرانیه", "district_code": "ZAF"},
        "usages": [{"usage_type": "residential", "is_primary": True}],
    }
    resp = await client.post(
        "/api/v1/properties", json=payload2, headers={**auth_header(token), "Idempotency-Key": "prop-ai-2"}
    )
    assert resp.status_code == 200

    # Now parse and execute search
    resp = await client.post(
        "/api/v1/ai/search/execute",
        json={"text": "آپارتمان در اصفهان تا 15 میلیارد"},
        headers=auth_header(token),
    )
    assert resp.status_code == 200, resp.text
    data = resp.json()["data"]
    assert "parsed" in data
    assert "properties" in data
    # Should find at least 1 (the apartment)
    assert len(data["properties"]) >= 1
    assert data["properties"][0]["property_type"] == "apartment"


@pytest.mark.asyncio
async def test_ai_matching(client, login, auth_header):
    sess = await login(telegram_id=14004)
    token = sess["access_token"]
    resp = await client.post(
        "/api/v1/organizations",
        json={"name": "Org AI Match", "slug": "org-ai-match"},
        headers={**auth_header(token), "Idempotency-Key": "org-ai-match"},
    )
    org_id = resp.json()["data"]["id"]
    resp = await client.post(
        "/api/v1/auth/select-organization", json={"organization_id": org_id}, headers=auth_header(token)
    )
    token = resp.json()["data"]["access_token"]

    # Create person
    resp = await client.post(
        "/api/v1/persons",
        json={"first_name": "علی", "last_name": "تست", "phone": "09130000010", "roles": ["buyer"]},
        headers=auth_header(token),
    )
    assert resp.status_code == 200, resp.text
    person_id = resp.json()["data"]["id"]

    # Create customer request — actual schema uses person_id, area_min/max, budget_min/max, rooms
    resp = await client.post(
        "/api/v1/customer-requests",
        json={
            "person_id": person_id,
            "property_type": "apartment",
            "transaction_type": "sale",
            "city_code": "ISF",
            "district_code": "MJ",
            "area_min": 100,
            "area_max": 150,
            "budget_min": 10000000000,
            "budget_max": 20000000000,
            "rooms": 2,
        },
        headers=auth_header(token),
    )
    assert resp.status_code == 200, resp.text
    request_id = resp.json()["data"]["id"]

    # Create matching property
    payload = {
        "title": "آپارتمان 120 متری مرداویج",
        "property_type": "apartment",
        "transaction_type": "sale",
        "built_area": 120,
        "rooms": 3,
        "price": 15000000000,
        "owner_name": "مالک",
        "owner_phone": "09130000000",
        "location": {"city": "اصفهان", "city_code": "ISF", "district": "مرداویج", "district_code": "MJ"},
        "usages": [{"usage_type": "residential", "is_primary": True}],
    }
    resp = await client.post(
        "/api/v1/properties", json=payload, headers={**auth_header(token), "Idempotency-Key": "prop-ai-match"}
    )
    assert resp.status_code == 200
    prop_id = resp.json()["data"]["id"]

    # Match request to properties
    resp = await client.post(
        f"/api/v1/ai/match/request/{request_id}",
        json={"limit": 10},
        headers=auth_header(token),
    )
    assert resp.status_code == 200, resp.text
    matches = resp.json()["data"]
    assert len(matches) >= 1
    assert matches[0]["score"] >= 0.5
    assert matches[0]["property"]["id"] == prop_id

    # Match property to requests
    resp = await client.post(
        f"/api/v1/ai/match/property/{prop_id}",
        json={"limit": 10},
        headers=auth_header(token),
    )
    assert resp.status_code == 200, resp.text
    matches = resp.json()["data"]
    assert len(matches) >= 1
    assert matches[0]["score"] >= 0.5


@pytest.mark.asyncio
async def test_ai_suggest_description(client, login, auth_header):
    sess = await login(telegram_id=14005)
    token = sess["access_token"]
    resp = await client.post(
        "/api/v1/organizations",
        json={"name": "Org AI Desc", "slug": "org-ai-desc"},
        headers={**auth_header(token), "Idempotency-Key": "org-ai-desc"},
    )
    org_id = resp.json()["data"]["id"]
    resp = await client.post(
        "/api/v1/auth/select-organization", json={"organization_id": org_id}, headers=auth_header(token)
    )
    token = resp.json()["data"]["access_token"]

    payload = {
        "title": "آپارتمان لوکس مرداویج",
        "property_type": "apartment",
        "transaction_type": "sale",
        "built_area": 150,
        "rooms": 3,
        "price": 20000000000,
        "owner_name": "مالک",
        "owner_phone": "09130000000",
        "location": {"city": "اصفهان", "city_code": "ISF", "district": "مرداویج", "district_code": "MJ"},
        "usages": [{"usage_type": "residential", "is_primary": True}],
    }
    resp = await client.post(
        "/api/v1/properties", json=payload, headers={**auth_header(token), "Idempotency-Key": "prop-ai-desc"}
    )
    assert resp.status_code == 200
    prop_id = resp.json()["data"]["id"]

    resp = await client.post(
        f"/api/v1/ai/suggest/description/{prop_id}",
        headers=auth_header(token),
    )
    assert resp.status_code == 200, resp.text
    data = resp.json()["data"]
    assert "suggested_description" in data
    assert len(data["suggested_description"]) > 20
