from tests.conftest import auth


async def create_org(client, token, slug="alibaba", name="املاک علی‌بابا", key=None):
    headers = auth(token)
    if key:
        headers["Idempotency-Key"] = key
    return await client.post(
        "/api/v1/organizations", json={"name": name, "slug": slug}, headers=headers
    )


async def test_create_organization_happy_path(client, login):
    data = await login(601)
    response = await create_org(client, data["access_token"])
    body = response.json()
    assert response.status_code == 201, response.text
    assert body["data"]["slug"] == "alibaba"
    assert body["data"]["version"] == 1


async def test_creator_becomes_organization_admin(client, login):
    data = await login(602)
    org = (await create_org(client, data["access_token"], slug="agency-602")).json()["data"]

    # A new token now carries the organization, roles and resolved permissions.
    switched = await client.post(
        "/api/v1/auth/select-organization",
        json={"organization_id": org["id"]},
        headers=auth(data["access_token"]),
    )
    payload = switched.json()["data"]
    assert payload["organization_id"] == org["id"]
    assert "organization_admin" in payload["roles"]
    assert "organization:update" in payload["permissions"]
    assert payload["branch_id"] is not None  # MAIN branch auto-provisioned


async def test_duplicate_slug_conflict(client, login):
    data = await login(603)
    await create_org(client, data["access_token"], slug="dup-603")
    response = await create_org(client, data["access_token"], slug="dup-603")
    assert response.status_code == 409
    assert response.json()["error"]["code"] == "SLUG_TAKEN"


async def test_invalid_slug_is_rejected(client, login):
    data = await login(604)
    response = await client.post(
        "/api/v1/organizations",
        json={"name": "X", "slug": "Bad Slug!"},
        headers=auth(data["access_token"]),
    )
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "VALIDATION_ERROR"


async def test_create_requires_authentication(client):
    response = await client.post("/api/v1/organizations", json={"name": "Test", "slug": "anon"})
    assert response.status_code == 401


async def test_idempotency_key_prevents_double_create(client, login):
    data = await login(605)
    first = await create_org(client, data["access_token"], slug="idem-605", key="abc-123")
    second = await create_org(client, data["access_token"], slug="idem-605", key="abc-123")
    assert first.status_code == 201
    assert second.status_code == 201
    assert first.json()["data"]["id"] == second.json()["data"]["id"]


async def test_idempotency_key_reuse_with_other_body_conflicts(client, login):
    data = await login(606)
    await create_org(client, data["access_token"], slug="idem-606", key="key-606")
    response = await create_org(client, data["access_token"], slug="other-606", key="key-606")
    assert response.status_code == 409
    assert response.json()["error"]["code"] == "IDEMPOTENCY_KEY_REUSED"


async def test_list_is_empty_for_new_user(client, login):
    data = await login(607)
    response = await client.get("/api/v1/organizations", headers=auth(data["access_token"]))
    assert response.status_code == 200
    assert response.json()["data"] == []
    assert response.json()["meta"]["pagination"]["total"] == 0


async def test_optimistic_locking_on_patch(client, login):
    data = await login(608)
    org = (await create_org(client, data["access_token"], slug="lock-608")).json()["data"]
    token = (
        await client.post(
            "/api/v1/auth/select-organization",
            json={"organization_id": org["id"]},
            headers=auth(data["access_token"]),
        )
    ).json()["data"]["access_token"]

    good = await client.patch(
        f"/api/v1/organizations/{org['id']}",
        json={"version": 1, "name": "نام جدید"},
        headers=auth(token),
    )
    assert good.status_code == 200
    assert good.json()["data"]["version"] == 2
    assert good.json()["data"]["name"] == "نام جدید"

    stale = await client.patch(
        f"/api/v1/organizations/{org['id']}",
        json={"version": 1, "name": "نام قدیمی"},
        headers=auth(token),
    )
    assert stale.status_code == 409
    assert stale.json()["error"]["code"] == "VERSION_CONFLICT"


async def test_branch_crud_and_pagination(client, login):
    data = await login(609)
    org = (await create_org(client, data["access_token"], slug="branch-609")).json()["data"]
    token = (
        await client.post(
            "/api/v1/auth/select-organization",
            json={"organization_id": org["id"]},
            headers=auth(data["access_token"]),
        )
    ).json()["data"]["access_token"]

    created = await client.post(
        "/api/v1/organizations/current/branches",
        json={"name": "شعبه جردن", "code": "JRD"},
        headers=auth(token),
    )
    assert created.status_code == 201, created.text

    duplicate = await client.post(
        "/api/v1/organizations/current/branches",
        json={"name": "شعبه جردن ۲", "code": "JRD"},
        headers=auth(token),
    )
    assert duplicate.status_code == 409

    listed = await client.get("/api/v1/organizations/current/branches?limit=1", headers=auth(token))
    body = listed.json()
    assert listed.status_code == 200
    assert len(body["data"]) == 1
    assert body["meta"]["pagination"]["total"] == 2  # MAIN + JRD
