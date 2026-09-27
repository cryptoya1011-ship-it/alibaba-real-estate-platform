"""Sprint 0 — business rules: property review, commission guard, invitation expiry,
honest integrations / AI status (docs/BUSINESS_RULES.md §7, §28, §37, §40)."""

from datetime import datetime, timedelta, timezone

import httpx
import pytest
from sqlalchemy import update

from app.modules.integrations import adapter as integ


async def _org_with_agent(client, login, auth_header, slug: str, admin_tg: int, agent_tg: int):
    """Admin creates an org and invites an agent. Returns (admin_token, agent_token, org_id)."""
    admin = (await login(telegram_id=admin_tg))["access_token"]
    resp = await client.post(
        "/api/v1/organizations",
        json={"name": f"Org {slug}", "slug": slug},
        headers={**auth_header(admin), "Idempotency-Key": slug},
    )
    assert resp.status_code == 201, resp.text
    org_id = resp.json()["data"]["id"]
    resp = await client.post("/api/v1/auth/select-organization", json={"organization_id": org_id}, headers=auth_header(admin))
    admin = resp.json()["data"]["access_token"]

    resp = await client.post(
        f"/api/v1/organizations/{org_id}/invitations",
        json={"invited_telegram_id": agent_tg, "role_code": "agent"},
        headers=auth_header(admin),
    )
    assert resp.status_code == 200, resp.text
    raw = resp.json()["data"]["token"]
    agent = (await login(telegram_id=agent_tg))["access_token"]
    resp = await client.post("/api/v1/invitations/accept", json={"token": raw}, headers=auth_header(agent))
    assert resp.status_code == 200, resp.text
    agent = (await login(telegram_id=agent_tg, organization_id=org_id))["access_token"]
    return admin, agent, org_id


def _property(status: str = "draft") -> dict:
    return {
        "title": "آپارتمان تست بررسی",
        "property_type": "apartment",
        "transaction_type": "sale",
        "status": status,
        "built_area": 120,
        "price": 10_000_000_000,
        "usages": [{"usage_type": "residential", "is_primary": True}],
        "location": {"city": "اصفهان", "city_code": "ISF", "district": "مرداویج", "district_code": "MJ"},
    }


@pytest.mark.asyncio
async def test_property_review_flow(client, login, auth_header):
    admin, agent, _ = await _org_with_agent(client, login, auth_header, "org-review", 21001, 21002)

    # Agent cannot create straight into the official inventory
    resp = await client.post(
        "/api/v1/properties", json=_property("published"), headers={**auth_header(agent), "Idempotency-Key": "rv-1"}
    )
    assert resp.status_code == 403, resp.text

    # Agent submits for review
    resp = await client.post(
        "/api/v1/properties", json=_property("pending_review"), headers={**auth_header(agent), "Idempotency-Key": "rv-2"}
    )
    assert resp.status_code == 200, resp.text
    prop = resp.json()["data"]
    pid = prop["id"]

    # Agent cannot approve / publish via status or the review endpoint
    resp = await client.patch(
        f"/api/v1/properties/{pid}", json={"status": "approved", "version": prop["version"]}, headers=auth_header(agent)
    )
    assert resp.status_code == 403, resp.text
    resp = await client.post(f"/api/v1/properties/{pid}/review", json={"action": "approve"}, headers=auth_header(agent))
    assert resp.status_code == 403, resp.text

    # Manager: request changes needs a note
    resp = await client.post(
        f"/api/v1/properties/{pid}/review", json={"action": "request_changes"}, headers=auth_header(admin)
    )
    assert resp.status_code == 422, resp.text
    resp = await client.post(
        f"/api/v1/properties/{pid}/review",
        json={"action": "request_changes", "note": "عکس‌ها ناقص است"},
        headers=auth_header(admin),
    )
    assert resp.status_code == 200, resp.text
    data = resp.json()["data"]
    assert data["status"] == "changes_requested"
    assert data["review_note"] == "عکس‌ها ناقص است"

    # Agent was notified in-app
    resp = await client.get("/api/v1/notifications", headers=auth_header(agent))
    assert any(n.get("entity_type") == "property" and n.get("entity_id") == pid for n in resp.json()["data"])

    # Agent fixes and resubmits (changes_requested -> pending_review is allowed)
    resp = await client.patch(
        f"/api/v1/properties/{pid}",
        json={"status": "pending_review", "version": data["version"]},
        headers=auth_header(agent),
    )
    assert resp.status_code == 200, resp.text

    # Manager approves and publishes in one step
    resp = await client.post(
        f"/api/v1/properties/{pid}/review", json={"action": "approve", "publish": True}, headers=auth_header(admin)
    )
    assert resp.status_code == 200, resp.text
    data = resp.json()["data"]
    assert data["status"] == "published"
    assert data["approved_by"] is not None and data["approved_at"] is not None

    # Approving twice is a conflict
    resp = await client.post(f"/api/v1/properties/{pid}/review", json={"action": "approve"}, headers=auth_header(admin))
    assert resp.status_code == 409, resp.text


@pytest.mark.asyncio
async def test_commission_is_manager_only(client, login, auth_header):
    admin, agent, _ = await _org_with_agent(client, login, auth_header, "org-comm", 22001, 22002)
    resp = await client.post("/api/v1/persons", json={"first_name": "مشتری", "phone": "09130000071"}, headers=auth_header(agent))
    person = resp.json()["data"]["id"]

    # Agent may create a deal but not set commission
    resp = await client.post(
        "/api/v1/deals",
        json={"title": "معامله", "customer_id": person, "commission_total": 1000},
        headers=auth_header(agent),
    )
    assert resp.status_code == 403, resp.text
    resp = await client.post("/api/v1/deals", json={"title": "معامله", "customer_id": person}, headers=auth_header(agent))
    assert resp.status_code == 200, resp.text
    deal = resp.json()["data"]

    # Agent cannot change (or clear) commission on update, but can edit other fields
    resp = await client.patch(
        f"/api/v1/deals/{deal['id']}", json={"commission_agent_share": 1, "version": deal["version"]}, headers=auth_header(agent)
    )
    assert resp.status_code == 403, resp.text
    resp = await client.patch(
        f"/api/v1/deals/{deal['id']}", json={"commission_total": None, "version": deal["version"]}, headers=auth_header(agent)
    )
    assert resp.status_code == 403, resp.text
    resp = await client.patch(
        f"/api/v1/deals/{deal['id']}", json={"notes": "پیگیری شد", "version": deal["version"]}, headers=auth_header(agent)
    )
    assert resp.status_code == 200, resp.text
    version = resp.json()["data"]["version"]

    # Manager sets commission; the agent can read the result (commission:read)
    resp = await client.patch(
        f"/api/v1/deals/{deal['id']}", json={"commission_total": 5000, "version": version}, headers=auth_header(admin)
    )
    assert resp.status_code == 200, resp.text
    resp = await client.get(f"/api/v1/deals/{deal['id']}", headers=auth_header(agent))
    assert resp.json()["data"]["commission_total"] == 5000


@pytest.mark.asyncio
async def test_invitation_expiry(client, login, auth_header, engine):
    admin = (await login(telegram_id=23001))["access_token"]
    resp = await client.post(
        "/api/v1/organizations",
        json={"name": "Org Exp", "slug": "org-exp"},
        headers={**auth_header(admin), "Idempotency-Key": "org-exp"},
    )
    org_id = resp.json()["data"]["id"]
    admin = (
        await client.post("/api/v1/auth/select-organization", json={"organization_id": org_id}, headers=auth_header(admin))
    ).json()["data"]["access_token"]

    resp = await client.post(
        f"/api/v1/organizations/{org_id}/invitations",
        json={"invited_telegram_id": 23002, "role_code": "agent", "expires_in_days": 3},
        headers=auth_header(admin),
    )
    assert resp.status_code == 200, resp.text
    inv = resp.json()["data"]
    assert inv["status"] == "pending" and inv["expires_at"]
    expires = datetime.fromisoformat(inv["expires_at"].replace("Z", "+00:00"))
    if expires.tzinfo is None:
        expires = expires.replace(tzinfo=timezone.utc)
    assert timedelta(days=2) < expires - datetime.now(timezone.utc) <= timedelta(days=3)

    # Out-of-range lifetime is rejected
    resp = await client.post(
        f"/api/v1/organizations/{org_id}/invitations",
        json={"invited_telegram_id": 23003, "role_code": "agent", "expires_in_days": 90},
        headers=auth_header(admin),
    )
    assert resp.status_code == 422

    # Force expiry in the DB → listed as expired and cannot be accepted
    from app.modules.organizations.models import OrganizationInvitation

    async with engine.begin() as conn:
        await conn.execute(
            update(OrganizationInvitation)
            .where(OrganizationInvitation.id == inv["id"])
            .values(expires_at=datetime.now(timezone.utc) - timedelta(minutes=1))
        )
    resp = await client.get(f"/api/v1/organizations/{org_id}/invitations", headers=auth_header(admin))
    assert next(i for i in resp.json()["data"] if i["id"] == inv["id"])["status"] == "expired"

    invitee = (await login(telegram_id=23002))["access_token"]
    resp = await client.post("/api/v1/invitations/accept", json={"token": inv["token"]}, headers=auth_header(invitee))
    assert resp.status_code == 422, resp.text
    assert "منقضی" in resp.json()["error"]["message"]


# --- Honest integrations -----------------------------------------------------


@pytest.fixture
def telegram_live(monkeypatch):
    """Real TelegramBotProvider, with the network replaced by an httpx MockTransport."""
    calls: list[httpx.Request] = []
    responses: dict[str, dict] = {}

    def handler(request: httpx.Request) -> httpx.Response:
        calls.append(request)
        method = request.url.path.rsplit("/", 1)[-1]
        return httpx.Response(200, json=responses.get(method, {"ok": False, "description": "Not Found"}))

    monkeypatch.setenv("TELEGRAM_PROVIDER", "telegram")
    monkeypatch.setattr(integ, "HTTP_TRANSPORT", httpx.MockTransport(handler))
    return calls, responses


async def _admin(client, login, auth_header, slug: str, tg: int) -> str:
    token = (await login(telegram_id=tg))["access_token"]
    resp = await client.post(
        "/api/v1/organizations", json={"name": slug, "slug": slug}, headers={**auth_header(token), "Idempotency-Key": slug}
    )
    org_id = resp.json()["data"]["id"]
    return (
        await client.post("/api/v1/auth/select-organization", json={"organization_id": org_id}, headers=auth_header(token))
    ).json()["data"]["access_token"]


@pytest.mark.asyncio
async def test_telegram_real_provider(client, login, auth_header, telegram_live):
    calls, responses = telegram_live
    token = await _admin(client, login, auth_header, "org-tg-live", 24001)

    responses["getMe"] = {"ok": True, "result": {"id": 1, "is_bot": True, "username": "Test_bot", "first_name": "T"}}
    resp = await client.post("/api/v1/integrations/telegram/validate", headers=auth_header(token))
    assert resp.status_code == 200, resp.text
    data = resp.json()["data"]
    assert data["mode"] == "live" and data["bot_username"] == "Test_bot"

    responses["sendMessage"] = {"ok": True, "result": {"message_id": 42}}
    resp = await client.post(
        "/api/v1/integrations/telegram/send", json={"chat_id": "123", "text": "سلام"}, headers=auth_header(token)
    )
    assert resp.status_code == 200, resp.text
    assert resp.json()["data"]["message_id"] == 42
    assert resp.json()["data"]["mock"] is False
    assert calls[-1].url.path.endswith("/sendMessage")

    # Telegram says no → honest error, token never echoed back
    responses["sendMessage"] = {"ok": False, "description": "Bad Request: chat not found"}
    resp = await client.post(
        "/api/v1/integrations/telegram/send", json={"chat_id": "999", "text": "x"}, headers=auth_header(token)
    )
    assert resp.status_code == 502, resp.text
    assert "TEST-BOT-TOKEN" not in resp.text

    status = (await client.get("/api/v1/integrations/providers", headers=auth_header(token))).json()["data"]
    assert status["details"]["telegram"]["mode"] == "live"
    assert status["details"]["telegram"]["implemented"] is True


@pytest.mark.asyncio
async def test_telegram_without_token_is_unavailable(client, login, auth_header, telegram_live, monkeypatch):
    token = await _admin(client, login, auth_header, "org-tg-none", 24101)
    monkeypatch.setenv("TELEGRAM_BOT_TOKEN", "")
    monkeypatch.setattr(integ.settings, "TELEGRAM_BOT_TOKEN", "", raising=False)
    resp = await client.post(
        "/api/v1/integrations/telegram/send", json={"chat_id": "1", "text": "x"}, headers=auth_header(token)
    )
    assert resp.status_code == 503, resp.text
    assert resp.json()["error"]["code"] == "INTEGRATION_UNAVAILABLE"


@pytest.mark.asyncio
async def test_unimplemented_provider_is_not_faked(client, login, auth_header, monkeypatch):
    token = await _admin(client, login, auth_header, "org-sms-real", 24201)
    monkeypatch.setenv("SMS_PROVIDER", "kavenegar")
    resp = await client.post(
        "/api/v1/integrations/sms/send", json={"phone": "09130000000", "message": "x"}, headers=auth_header(token)
    )
    assert resp.status_code == 503, resp.text

    status = (await client.get("/api/v1/integrations/providers", headers=auth_header(token))).json()["data"]
    sms = status["details"]["sms"]
    assert sms["implemented"] is False and sms["mode"] == "unavailable" and sms["connected"] is False
    assert status["details"]["divar"]["mode"] == "test"


@pytest.mark.asyncio
async def test_ai_providers_report_honestly(client, login, auth_header, monkeypatch):
    token = await _admin(client, login, auth_header, "org-ai-status", 24301)
    monkeypatch.setenv("AI_PROVIDER", "openai")
    data = (await client.get("/api/v1/ai/providers", headers=auth_header(token))).json()["data"]
    assert data["requested"] == "openai"
    assert data["current"] == "mock"
    assert data["details"]["openai"]["implemented"] is False
    assert data["details"]["mock"]["implemented"] is True
    assert data["note"]

    resp = await client.post("/api/v1/ai/search/parse", json={"text": "آپارتمان ۳ خوابه"}, headers=auth_header(token))
    assert resp.status_code == 200, resp.text
    assert resp.json()["data"]["parsed_by"] == "mock"
