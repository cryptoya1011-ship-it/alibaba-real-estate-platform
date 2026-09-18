import time

from tests.conftest import auth, make_init_data


async def test_telegram_login_happy_path(client):
    response = await client.post("/api/v1/auth/telegram", json={"init_data": make_init_data(555, "Reza")})
    body = response.json()
    assert response.status_code == 200, response.text
    assert body["data"]["access_token"]
    assert body["data"]["user"]["telegram_id"] == 555
    assert body["data"]["organization_id"] is None  # no membership yet
    assert body["data"]["organizations"] == []


async def test_login_is_idempotent_for_same_telegram_user(client):
    first = await client.post("/api/v1/auth/telegram", json={"init_data": make_init_data(556)})
    second = await client.post("/api/v1/auth/telegram", json={"init_data": make_init_data(556)})
    assert first.json()["data"]["user"]["id"] == second.json()["data"]["user"]["id"]


async def test_tampered_init_data_is_rejected(client):
    tampered = make_init_data(557).replace("hash=", "hash=0")
    response = await client.post("/api/v1/auth/telegram", json={"init_data": tampered})
    assert response.status_code == 401
    assert response.json()["error"]["code"] == "UNAUTHORIZED"


async def test_replaced_user_payload_is_rejected(client):
    """Changing the user id without re-signing must fail the HMAC check."""
    init_data = make_init_data(558)
    forged = init_data.replace("558", "559")
    response = await client.post("/api/v1/auth/telegram", json={"init_data": forged})
    assert response.status_code == 401


async def test_expired_init_data_is_rejected(client):
    old = make_init_data(560, auth_date=int(time.time()) - 90000)
    response = await client.post("/api/v1/auth/telegram", json={"init_data": old})
    assert response.status_code == 401


async def test_empty_init_data_is_validation_error(client):
    response = await client.post("/api/v1/auth/telegram", json={"init_data": ""})
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "VALIDATION_ERROR"


async def test_me_requires_token(client):
    assert (await client.get("/api/v1/me")).status_code == 401


async def test_me_rejects_garbage_token(client):
    response = await client.get("/api/v1/me", headers=auth("not-a-jwt"))
    assert response.status_code == 401


async def test_me_happy_path(client, login):
    data = await login(561)
    response = await client.get("/api/v1/me", headers=auth(data["access_token"]))
    assert response.status_code == 200
    assert response.json()["data"]["user"]["telegram_id"] == 561
