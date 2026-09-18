"""Cross-tenant access must return 404, not 403 — no resource disclosure."""
from tests.conftest import auth


async def _org_with_token(client, login, telegram_id, slug):
    data = await login(telegram_id)
    org = (
        await client.post(
            "/api/v1/organizations",
            json={"name": slug, "slug": slug},
            headers=auth(data["access_token"]),
        )
    ).json()["data"]
    token = (
        await client.post(
            "/api/v1/auth/select-organization",
            json={"organization_id": org["id"]},
            headers=auth(data["access_token"]),
        )
    ).json()["data"]["access_token"]
    return org, token, data["access_token"]


async def test_other_tenant_organization_returns_404(client, login):
    org_a, _, _ = await _org_with_token(client, login, 701, "tenant-a")
    _, token_b, _ = await _org_with_token(client, login, 702, "tenant-b")

    response = await client.get(f"/api/v1/organizations/{org_a['id']}", headers=auth(token_b))
    assert response.status_code == 404
    assert response.json()["error"]["code"] == "NOT_FOUND"


async def test_other_tenant_patch_returns_404(client, login):
    org_a, _, _ = await _org_with_token(client, login, 703, "tenant-c")
    _, token_b, _ = await _org_with_token(client, login, 704, "tenant-d")

    response = await client.patch(
        f"/api/v1/organizations/{org_a['id']}", json={"version": 1, "name": "hack"}, headers=auth(token_b)
    )
    assert response.status_code == 404


async def test_branch_list_never_leaks_other_tenant_rows(client, login):
    _, token_a, _ = await _org_with_token(client, login, 705, "tenant-e")
    _, token_b, _ = await _org_with_token(client, login, 706, "tenant-f")

    await client.post(
        "/api/v1/organizations/current/branches",
        json={"name": "شعبه الف", "code": "AAA"},
        headers=auth(token_a),
    )
    listed_b = await client.get("/api/v1/organizations/current/branches", headers=auth(token_b))
    codes = {row["code"] for row in listed_b.json()["data"]}
    assert codes == {"MAIN"}


async def test_selecting_foreign_organization_returns_404(client, login):
    org_a, _, _ = await _org_with_token(client, login, 707, "tenant-g")
    outsider = await login(708)
    response = await client.post(
        "/api/v1/auth/select-organization",
        json={"organization_id": org_a["id"]},
        headers=auth(outsider["access_token"]),
    )
    assert response.status_code == 404


async def test_tenant_scoped_endpoint_requires_active_organization(client, login):
    data = await login(709)  # user with no organization selected
    response = await client.get("/api/v1/organizations/current/branches", headers=auth(data["access_token"]))
    assert response.status_code == 400
    assert response.json()["error"]["code"] == "TENANT_CONTEXT_REQUIRED"
