"""Tests for Phase 15 Integrations / Advanced Platform

Telegram, SMS, Listings (Divar/Sheypoor), Payment, Maps, Logs
All mock deterministic, no external API required
"""

import pytest


@pytest.mark.asyncio
async def test_integration_providers_list(client, login, auth_header):
    sess = await login(telegram_id=15001)
    token = sess["access_token"]
    resp = await client.post(
        "/api/v1/organizations",
        json={"name": "Org Int", "slug": "org-int"},
        headers={**auth_header(token), "Idempotency-Key": "org-int"},
    )
    org_id = resp.json()["data"]["id"]
    resp = await client.post(
        "/api/v1/auth/select-organization", json={"organization_id": org_id}, headers=auth_header(token)
    )
    token = resp.json()["data"]["access_token"]

    resp = await client.get("/api/v1/integrations/providers", headers=auth_header(token))
    assert resp.status_code == 200, resp.text
    data = resp.json()["data"]
    assert "current" in data
    assert "available" in data
    assert "telegram" in data["available"]
    assert "sms" in data["available"]
    assert "listings" in data["available"]
    assert "payment" in data["available"]
    assert "maps" in data["available"]
    assert "details" in data


@pytest.mark.asyncio
async def test_telegram_send_mock(client, login, auth_header):
    sess = await login(telegram_id=15002)
    token = sess["access_token"]
    resp = await client.post(
        "/api/v1/organizations",
        json={"name": "Org TG", "slug": "org-tg"},
        headers={**auth_header(token), "Idempotency-Key": "org-tg"},
    )
    org_id = resp.json()["data"]["id"]
    resp = await client.post(
        "/api/v1/auth/select-organization", json={"organization_id": org_id}, headers=auth_header(token)
    )
    token = resp.json()["data"]["access_token"]

    resp = await client.post(
        "/api/v1/integrations/telegram/send",
        json={"chat_id": "123456", "text": "سلام تست"},
        headers=auth_header(token),
    )
    assert resp.status_code == 200, resp.text
    data = resp.json()["data"]
    assert data["success"] is True
    assert "mock" in str(data.get("provider", "")).lower() or data.get("mock") is True or "telegram" in data.get("provider", "")

    # Deep link
    resp = await client.get(
        "/api/v1/integrations/telegram/deep-link?payload=test_payload",
        headers=auth_header(token),
    )
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert "deep_link" in data
    assert "t.me" in data["deep_link"]


@pytest.mark.asyncio
async def test_sms_send_mock(client, login, auth_header):
    sess = await login(telegram_id=15003)
    token = sess["access_token"]
    resp = await client.post(
        "/api/v1/organizations",
        json={"name": "Org SMS", "slug": "org-sms"},
        headers={**auth_header(token), "Idempotency-Key": "org-sms"},
    )
    org_id = resp.json()["data"]["id"]
    resp = await client.post(
        "/api/v1/auth/select-organization", json={"organization_id": org_id}, headers=auth_header(token)
    )
    token = resp.json()["data"]["access_token"]

    resp = await client.post(
        "/api/v1/integrations/sms/send",
        json={"phone": "09130000000", "message": "کد تایید شما 1234"},
        headers=auth_header(token),
    )
    assert resp.status_code == 200, resp.text
    data = resp.json()["data"]
    assert data["success"] is True
    assert data["to"] == "09130000000"

    # OTP
    resp = await client.post(
        "/api/v1/integrations/sms/otp",
        json={"phone": "09130000000"},
        headers=auth_header(token),
    )
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert "code" in data
    assert len(data["code"]) == 6


@pytest.mark.asyncio
async def test_listings_publish_mock(client, login, auth_header):
    sess = await login(telegram_id=15004)
    token = sess["access_token"]
    resp = await client.post(
        "/api/v1/organizations",
        json={"name": "Org List", "slug": "org-list"},
        headers={**auth_header(token), "Idempotency-Key": "org-list"},
    )
    org_id = resp.json()["data"]["id"]
    resp = await client.post(
        "/api/v1/auth/select-organization", json={"organization_id": org_id}, headers=auth_header(token)
    )
    token = resp.json()["data"]["access_token"]

    # Create property
    payload = {
        "title": "آپارتمان تست لیستینگ",
        "property_type": "apartment",
        "transaction_type": "sale",
        "built_area": 120,
        "price": 15000000000,
        "owner_name": "مالک",
        "owner_phone": "09130000000",
        "location": {"city": "اصفهان", "city_code": "ISF", "district": "مرداویج", "district_code": "MJ"},
        "usages": [{"usage_type": "residential", "is_primary": True}],
    }
    resp = await client.post(
        "/api/v1/properties", json=payload, headers={**auth_header(token), "Idempotency-Key": "prop-list"},
    )
    assert resp.status_code == 200, resp.text
    prop_id = resp.json()["data"]["id"]

    # Publish to divar
    resp = await client.post(
        "/api/v1/integrations/listings/publish",
        json={"platform": "divar", "property_id": prop_id},
        headers=auth_header(token),
    )
    assert resp.status_code == 200, resp.text
    data = resp.json()["data"]
    assert data["success"] is True
    assert "external_id" in data
    assert "divar" in data["platform"]

    # Publish to sheypoor
    resp = await client.post(
        "/api/v1/integrations/listings/publish",
        json={"platform": "sheypoor", "property_id": prop_id},
        headers=auth_header(token),
    )
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert data["success"] is True
    assert data["platform"] == "sheypoor"

    # Unpublish
    resp = await client.post(
        "/api/v1/integrations/listings/unpublish",
        json={"platform": "divar", "external_id": "divar-test-123"},
        headers=auth_header(token),
    )
    assert resp.status_code == 200
    assert resp.json()["data"]["success"] is True


@pytest.mark.asyncio
async def test_payment_mock(client, login, auth_header):
    sess = await login(telegram_id=15005)
    token = sess["access_token"]
    resp = await client.post(
        "/api/v1/organizations",
        json={"name": "Org Pay", "slug": "org-pay"},
        headers={**auth_header(token), "Idempotency-Key": "org-pay"},
    )
    org_id = resp.json()["data"]["id"]
    resp = await client.post(
        "/api/v1/auth/select-organization", json={"organization_id": org_id}, headers=auth_header(token)
    )
    token = resp.json()["data"]["access_token"]

    resp = await client.post(
        "/api/v1/integrations/payment/create",
        json={"amount": 500000, "description": "کمیسیون معامله", "callback_url": "https://example.com/cb"},
        headers=auth_header(token),
    )
    assert resp.status_code == 200, resp.text
    data = resp.json()["data"]
    assert data["success"] is True
    assert "payment_id" in data
    assert "payment_url" in data
    assert data["amount"] == 500000

    payment_id = data["payment_id"]

    resp = await client.get(
        f"/api/v1/integrations/payment/verify/{payment_id}",
        headers=auth_header(token),
    )
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert data["success"] is True
    assert data["payment_id"] == payment_id


@pytest.mark.asyncio
async def test_maps_mock(client, login, auth_header):
    sess = await login(telegram_id=15006)
    token = sess["access_token"]
    resp = await client.post(
        "/api/v1/organizations",
        json={"name": "Org Maps", "slug": "org-maps"},
        headers={**auth_header(token), "Idempotency-Key": "org-maps"},
    )
    org_id = resp.json()["data"]["id"]
    resp = await client.post(
        "/api/v1/auth/select-organization", json={"organization_id": org_id}, headers=auth_header(token)
    )
    token = resp.json()["data"]["access_token"]

    # Geocode
    resp = await client.post(
        "/api/v1/integrations/maps/geocode",
        json={"address": "اصفهان، مرداویج، خیابان آزادی"},
        headers=auth_header(token),
    )
    assert resp.status_code == 200, resp.text
    data = resp.json()["data"]
    assert data["success"] is True
    assert "lat" in data
    assert "lng" in data
    assert 30 < data["lat"] < 40
    assert 45 < data["lng"] < 60

    lat = data["lat"]
    lng = data["lng"]

    # Reverse geocode
    resp = await client.post(
        "/api/v1/integrations/maps/reverse-geocode",
        json={"lat": lat, "lng": lng},
        headers=auth_header(token),
    )
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert data["success"] is True
    assert "address" in data

    # Static map
    resp = await client.get(
        f"/api/v1/integrations/maps/static-map?lat={lat}&lng={lng}&zoom=15",
        headers=auth_header(token),
    )
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert "url" in data
    assert "openstreetmap" in data["url"]

    # Distance
    resp = await client.post(
        "/api/v1/integrations/maps/distance",
        json={"lat1": 32.65, "lng1": 51.66, "lat2": 35.68, "lng2": 51.41},
        headers=auth_header(token),
    )
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert "distance_km" in data
    assert data["distance_km"] > 300  # Isfahan to Tehran ~400km


@pytest.mark.asyncio
async def test_integration_logs(client, login, auth_header):
    sess = await login(telegram_id=15007)
    token = sess["access_token"]
    resp = await client.post(
        "/api/v1/organizations",
        json={"name": "Org Logs", "slug": "org-logs"},
        headers={**auth_header(token), "Idempotency-Key": "org-logs"},
    )
    org_id = resp.json()["data"]["id"]
    resp = await client.post(
        "/api/v1/auth/select-organization", json={"organization_id": org_id}, headers=auth_header(token)
    )
    token = resp.json()["data"]["access_token"]

    # Send telegram to create log
    await client.post(
        "/api/v1/integrations/telegram/send",
        json={"chat_id": "123", "text": "test log"},
        headers=auth_header(token),
    )

    # List logs
    resp = await client.get("/api/v1/integrations/logs", headers=auth_header(token))
    assert resp.status_code == 200, resp.text
    data = resp.json()["data"]
    assert len(data) >= 1
    assert data[0]["provider"].startswith("telegram")

    # Filter by provider
    resp = await client.get("/api/v1/integrations/logs?provider=telegram_mock", headers=auth_header(token))
    assert resp.status_code == 200
