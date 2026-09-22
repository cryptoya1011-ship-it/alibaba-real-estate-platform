"""CRM Tests — بند 34-37"""
from __future__ import annotations

import pytest


@pytest.mark.asyncio
async def test_person_crud_and_roles(client, login, auth_header):
    sess = await login(telegram_id=401)
    token = sess["access_token"]
    # Create org
    resp = await client.post(
        "/api/v1/organizations",
        json={"name": "Org CRM", "slug": "org-crm"},
        headers={**auth_header(token), "Idempotency-Key": "org-crm"},
    )
    assert resp.status_code == 201, resp.text
    org_id = resp.json()["data"]["id"]
    resp = await client.post(
        "/api/v1/auth/select-organization",
        json={"organization_id": org_id},
        headers=auth_header(token),
    )
    token = resp.json()["data"]["access_token"]

    # Create person with roles
    resp = await client.post(
        "/api/v1/persons",
        json={
            "first_name": "علی",
            "last_name": "کریمی",
            "phone": "09130000002",
            "email": "ali@example.com",
            "roles": ["buyer", "investor"],
        },
        headers=auth_header(token),
    )
    assert resp.status_code == 200, resp.text
    person = resp.json()["data"]
    assert person["phone"] == "09130000002"
    assert len(person["roles"]) == 2
    person_id = person["id"]
    version = 1  # need to get version via get
    # Get
    resp = await client.get(f"/api/v1/persons/{person_id}", headers=auth_header(token))
    assert resp.status_code == 200, resp.text
    data = resp.json()["data"]
    assert data["first_name"] == "علی"
    assert len(data["roles"]) == 2
    version = data["version"]

    # Add role — mixed use person can have many roles (بند 34)
    resp = await client.post(
        f"/api/v1/persons/{person_id}/roles",
        json={"role": "owner"},
        headers=auth_header(token),
    )
    assert resp.status_code == 200, resp.text
    assert len(resp.json()["data"]["roles"]) == 3

    # Remove role
    resp = await client.delete(
        f"/api/v1/persons/{person_id}/roles/buyer", headers=auth_header(token)
    )
    assert resp.status_code == 200, resp.text
    assert len(resp.json()["data"]["roles"]) == 2

    # Duplicate phone per org should fail (بند fix(crm))
    resp = await client.post(
        "/api/v1/persons",
        json={"first_name": "تکراری", "phone": "09130000002"},
        headers=auth_header(token),
    )
    assert resp.status_code == 409, resp.text

    # List with q
    resp = await client.get("/api/v1/persons?q=علی", headers=auth_header(token))
    assert resp.status_code == 200, resp.text
    assert resp.json()["meta"]["pagination"]["total"] >= 1

    # List with role filter
    resp = await client.get("/api/v1/persons?role=owner", headers=auth_header(token))
    assert resp.status_code == 200, resp.text
    assert resp.json()["meta"]["pagination"]["total"] >= 1

    # Update
    resp = await client.patch(
        f"/api/v1/persons/{person_id}",
        json={"first_name": "علیرضا", "version": version},
        headers=auth_header(token),
    )
    assert resp.status_code == 200, resp.text

    # Delete
    resp = await client.get(f"/api/v1/persons/{person_id}", headers=auth_header(token))
    version = resp.json()["data"]["version"]
    resp = await client.delete(
        f"/api/v1/persons/{person_id}?version={version}", headers=auth_header(token)
    )
    assert resp.status_code == 200, resp.text


@pytest.mark.asyncio
async def test_customer_requests(client, login, auth_header):
    sess = await login(telegram_id=402)
    token = sess["access_token"]
    resp = await client.post(
        "/api/v1/organizations",
        json={"name": "Org Req", "slug": "org-req"},
        headers={**auth_header(token), "Idempotency-Key": "org-req"},
    )
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
        json={"first_name": "مشتری", "phone": "09130000003"},
        headers=auth_header(token),
    )
    person_id = resp.json()["data"]["id"]

    # Create request (بند 35)
    resp = await client.post(
        "/api/v1/customer-requests",
        json={
            "person_id": person_id,
            "transaction_type": "sale",
            "property_type": "apartment",
            "city_code": "ISF",
            "district_code": "MJ",
            "budget_min": 10000000000,
            "budget_max": 20000000000,
            "area_min": 100,
            "area_max": 200,
            "rooms": 3,
            "has_parking": True,
            "special_requirements": "نورگیر خوب",
        },
        headers=auth_header(token),
    )
    assert resp.status_code == 200, resp.text
    req_id = resp.json()["data"]["id"]

    # List
    resp = await client.get("/api/v1/customer-requests", headers=auth_header(token))
    assert resp.status_code == 200, resp.text
    assert resp.json()["meta"]["pagination"]["total"] >= 1


@pytest.mark.asyncio
async def test_favorites_and_saved_searches(client, login, auth_header):
    sess = await login(telegram_id=403)
    token = sess["access_token"]
    resp = await client.post(
        "/api/v1/organizations",
        json={"name": "Org Fav", "slug": "org-fav"},
        headers={**auth_header(token), "Idempotency-Key": "org-fav"},
    )
    org_id = resp.json()["data"]["id"]
    resp = await client.post(
        "/api/v1/auth/select-organization",
        json={"organization_id": org_id},
        headers=auth_header(token),
    )
    token = resp.json()["data"]["access_token"]

    # Create property
    resp = await client.post(
        "/api/v1/properties",
        json={
            "title": "ملک برای Favorite",
            "property_type": "apartment",
            "transaction_type": "sale",
            "built_area": 120,
            "price": 15000000000,
            "has_parking": True,
        },
        headers={**auth_header(token), "Idempotency-Key": "prop-fav"},
    )
    assert resp.status_code == 200, resp.text
    prop_id = resp.json()["data"]["id"]

    # Add favorite (بند 36)
    resp = await client.post(
        "/api/v1/favorites",
        json={"property_id": prop_id},
        headers=auth_header(token),
    )
    assert resp.status_code == 200, resp.text

    # List favorites
    resp = await client.get("/api/v1/favorites", headers=auth_header(token))
    assert resp.status_code == 200, resp.text
    assert resp.json()["meta"]["pagination"]["total"] == 1

    # Duplicate favorite should return existing (idempotent)
    resp = await client.post(
        "/api/v1/favorites",
        json={"property_id": prop_id},
        headers=auth_header(token),
    )
    assert resp.status_code == 200, resp.text

    # Remove favorite
    resp = await client.delete(f"/api/v1/favorites/{prop_id}", headers=auth_header(token))
    assert resp.status_code == 200, resp.text

    # Saved search (بند 37)
    resp = await client.post(
        "/api/v1/saved-searches",
        json={
            "name": "جستجوی آپارتمان مرداویج",
            "query": {
                "property_type": "apartment",
                "city_code": "ISF",
                "district_code": "MJ",
                "min_price": 10000000000,
                "has_parking": True,
            },
        },
        headers=auth_header(token),
    )
    assert resp.status_code == 200, resp.text
    search_id = resp.json()["data"]["id"]

    # List saved searches
    resp = await client.get("/api/v1/saved-searches", headers=auth_header(token))
    assert resp.status_code == 200, resp.text
    assert resp.json()["meta"]["pagination"]["total"] == 1

    # Matches — should find the property we created
    # Recreate property because we still have it (not deleted)
    # Create another property that matches
    resp = await client.post(
        "/api/v1/properties",
        json={
            "title": "آپارتمان مرداویج 2",
            "property_type": "apartment",
            "transaction_type": "sale",
            "built_area": 130,
            "price": 16000000000,
            "has_parking": True,
            "location": {"city_code": "ISF", "district_code": "MJ"},
        },
        headers={**auth_header(token), "Idempotency-Key": "prop-fav-2"},
    )
    assert resp.status_code == 200, resp.text

    resp = await client.get(
        f"/api/v1/saved-searches/{search_id}/matches", headers=auth_header(token)
    )
    assert resp.status_code == 200, resp.text
    # Should have at least 1 match
    assert resp.json()["meta"]["pagination"]["total"] >= 1


@pytest.mark.asyncio
async def test_crm_tenant_isolation(client, login, auth_header):
    # Org A person
    sess_a = await login(telegram_id=501)
    token_a = sess_a["access_token"]
    resp = await client.post(
        "/api/v1/organizations",
        json={"name": "Org CRM A", "slug": "org-crm-a"},
        headers={**auth_header(token_a), "Idempotency-Key": "org-crm-a"},
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
        json={"first_name": "مشتری A", "phone": "09130000004"},
        headers=auth_header(token_a),
    )
    person_a_id = resp.json()["data"]["id"]

    # Org B user
    sess_b = await login(telegram_id=502)
    token_b = sess_b["access_token"]
    resp = await client.post(
        "/api/v1/organizations",
        json={"name": "Org CRM B", "slug": "org-crm-b"},
        headers={**auth_header(token_b), "Idempotency-Key": "org-crm-b"},
    )
    org_b = resp.json()["data"]["id"]
    resp = await client.post(
        "/api/v1/auth/select-organization",
        json={"organization_id": org_b},
        headers=auth_header(token_b),
    )
    token_b = resp.json()["data"]["access_token"]

    # B tries to get A's person → 404
    resp = await client.get(f"/api/v1/persons/{person_a_id}", headers=auth_header(token_b))
    assert resp.status_code == 404, resp.text
