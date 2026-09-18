async def test_health_returns_envelope(client):
    response = await client.get("/api/v1/health")
    body = response.json()
    assert response.status_code == 200
    assert body["success"] is True
    assert body["data"]["status"] == "ok"
    assert body["error"] is None
    assert "X-Request-ID" in response.headers


async def test_health_db(client):
    response = await client.get("/api/v1/health/db")
    assert response.status_code == 200
    assert response.json()["data"]["database"] == "ok"


async def test_unknown_route_uses_error_envelope(client):
    response = await client.get("/api/v1/does-not-exist")
    body = response.json()
    assert response.status_code == 404
    assert body["success"] is False
    assert body["error"]["code"] == "NOT_FOUND"
    assert body["data"] is None
