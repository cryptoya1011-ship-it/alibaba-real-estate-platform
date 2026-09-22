# API CONTRACT — AREP

## 1. اصول کلی (بند 49, 50)

- **API-first:** تمام Business Logic از API قابل دسترسی است؛ Frontend فقط Consumer
- **Versioning:** `/api/v1` فعلا, `/api/v2` در آینده (Breaking Change)
- **Response Envelope واحد:**
```json
{
  "success": true,
  "data": {},
  "meta": {"pagination": {"total": 100, "limit": 20, "offset": 0}},
  "error": null
}
```
- **Error:**
```json
{
  "success": false,
  "data": null,
  "meta": {},
  "error": {"code": "NOT_FOUND", "message": "یافت نشد", "details": []}
}
```
- **Health استثنا:** `GET /` و `GET /api/v1/health` می‌تواند ساده باشد

## 2. Standards

- **Pagination:** Query `?limit=20&offset=0` (فعلا offset, آماده cursor با `cursor` param)
- **Optimistic Locking:** PATCH باید `version` بفرستد؛ اگر mismatch → `409 VERSION_CONFLICT`
- **Idempotency-Key:** Header `Idempotency-Key` روی POSTهای حساس (سازمان‌سازی, ملک‌سازی). تکرار همان Key + همان Body → همان Response. Key تکراری + Body متفاوت → `409 IDEMPOTENCY_KEY_REUSED`
- **Request ID:** Header `X-Request-ID` تولید و در Response برگردانده می‌شود؛ در Logging و Audit استفاده
- **Error Codes استاندارد:** `UNAUTHORIZED, FORBIDDEN, NOT_FOUND, VALIDATION_ERROR, VERSION_CONFLICT, CONFLICT, IDEMPOTENCY_KEY_REUSED, RATE_LIMITED`
- **Security:** Tenant دیگر → 404 نه 403

## 3. Authentication

### 3.1 Telegram Login

`POST /api/v1/auth/telegram`

Request:
```json
{
  "init_data": "query_id=...&user=...&auth_date=...&hash=...",
  "organization_id": 1 // optional
}
```

Server:
- Validate HMAC-SHA256 با BOT_TOKEN
- Check auth_date (max 86400s)
- Find or create User by telegram_id
- Resolve memberships, roles, permissions
- Issue JWT

Response data: Session
```json
{
  "access_token": "eyJ...",
  "expires_at": "2026-09-22T...",
  "user": {"id": 1, "telegram_id": 123, "display_name": "Ali", "is_super_admin": false},
  "organization_id": 1,
  "branch_id": 2,
  "roles": ["organization_admin"],
  "permissions": ["property:create", ...],
  "organizations": [{"id": 1, "name": "املاک علی‌بابا", "slug": "alibaba", "is_owner": true}]
}
```

### 3.2 Dev Login (فقط local)

`POST /api/v1/auth/dev-login`

Request:
```json
{"telegram_id": 1000001, "first_name": "Dev", "organization_id": null}
```

فقط وقتی `ALLOW_DEV_LOGIN=true` و `ENV != production`

### 3.3 Select Organization

`POST /api/v1/auth/select-organization`
Auth: Bearer Token required

Request:
```json
{"organization_id": 2, "branch_id": null}
```

Response: Session جدید با org جدید

## 4. Organizations

`POST /api/v1/organizations`
- Auth + permission `organization:read`? (ساخت سازمان برای همه لاگین کرده مجاز است فعلا)
- Idempotency-Key recommended
- Body: `{"name": "املاک تست", "slug": "test-org", "city_code": "ISF", "phone": "..."}`
- Response: `{"id": 2, "name": "...", "slug": "..."}`

`GET /api/v1/organizations`
- List memberships من
- Response: list orgs

`GET /api/v1/organizations/{id}`
- فقط اگر عضو باشی وگرنه 404
- Permission `organization:read`

`PATCH /api/v1/organizations/{id}`
- Body: `{"name": "...", "version": 1}`
- Permission `organization:update`

### Branches

`POST /api/v1/organizations/{id}/branches` (آینده, فعلا در service موجود اما endpoint ندارد)
`GET /api/v1/organizations/{id}/branches`

## 5. Me

`GET /api/v1/me`
- Auth required
- Response: User + current org + roles + permissions

## 6. Properties (طراحی آینده - Phase 5)

`POST /api/v1/properties`
- Auth + `property:create`
- Idempotency-Key
- Body (خلاصه):
```json
{
  "title": "آپارتمان 150 متری مرداویج",
  "property_type": "apartment",
  "transaction_type": "sale",
  "usages": ["residential"],
  "areas": {"built": 150, "land": 200},
  "location": {"city": "Isfahan", "district": "Mardavij", "exact_address": "خیابان ... (private)"},
  "financial": {"price": 20000000000},
  "amenities": {"parking": true, "elevator": true},
  "owner": {"person_id": 5} // یا submitted_by = Intermediary بدون owner
}
```
- Server: تولید code از `code_sequences` → `AB-ISF-MJ-AP-S-2608-00124`

`GET /api/v1/properties?transaction=sale&type=apartment&district=mardavij&min_area=100&max_price=20000000000&limit=20&offset=0`
- Public vs Internal: اگر `property:address:read` نداشته باشد, exact_address حذف می‌شود
- اگر `property:owner:read` نداشته باشد, owner info حذف

`GET /api/v1/properties/{id}` یا `/p/{code}` Deep Link (بند 62)
- Public DTO جدا

`PATCH /api/v1/properties/{id}`
- version required
- `property:update`

`DELETE /api/v1/properties/{id}`
- Soft Delete
- `property:delete`

## 7. CRM (آینده)

`POST /api/v1/persons`, `GET /api/v1/persons`, `GET /api/v1/persons/{id}`
`POST /api/v1/requests`, `GET /api/v1/requests`
`POST /api/v1/favorites`, `DELETE /api/v1/favorites/{property_id}`
`POST /api/v1/saved-searches`

## 8. Visits, Deals, Notifications

### Visits — DONE

`POST /api/v1/visits` — Auth + visit:create, body {property_id, customer_id, visit_date YYYY-MM-DD, visit_time HH:MM, status scheduled, notes}, auto-creates notification for agent
`GET /api/v1/visits?property_id=&customer_id=&agent_id=&status=&date_from=&date_to=&limit=&offset=`
`GET /api/v1/visits/{id}` — Auth + visit:read
`PATCH /api/v1/visits/{id}` — Auth + visit:update, body {status, notes, version}
`DELETE /api/v1/visits/{id}` — Auth + visit:delete, soft delete

### Deals — DONE (Phase 9)

`POST /api/v1/deals` — Auth + deal:create, body {title, customer_id required, property_id optional nullable (independent per بند39), agent_id optional default current user, amount, commission_total, commission_agent_share, commission_office_share, commission_referral_share, status lead default, notes}, generates code DL-YYMM-00001, creates history entry, creates notification important "معامله جدید: {title}"
`GET /api/v1/deals?status=&customer_id=&property_id=&agent_id=&q=&limit=&offset=` — Auth + deal:read, q LIKE title/code
`GET /api/v1/deals/by-code/{code}` — Deep Link, Auth + deal:read, code like DL-2609-00001
`GET /api/v1/deals/{id}` — Auth + deal:read
`GET /api/v1/deals/{id}/history` — Auth + deal:read, list DealStatusHistory ordered asc
`PATCH /api/v1/deals/{id}` — Auth + deal:update, body {title, status, amount, commission_*, notes, loss_reason, version required}, validates pipeline transition, creates history, notification on status change (critical if closed)
`DELETE /api/v1/deals/{id}` — Auth + deal:delete, soft delete

Pipeline: lead → qualification → property_match → visit → negotiation → agreement → closed_won/closed_lost → archived, closed_lost → lead reopen allowed

### Notifications — DONE

`GET /api/v1/notifications?is_read=&priority=&limit=&offset=` — Auth + notification:read, per user_id
`GET /api/v1/notifications/unread-count` — Auth + notification:read
`POST /api/v1/notifications/{id}/read` — mark single read
`POST /api/v1/notifications/read-all` — mark all read
`DELETE /api/v1/notifications/{id}` — Auth + notification:manage, soft delete
`POST /api/v1/notifications` — Admin create, Auth + notification:manage

## 9. Public Platform — DONE (Phase 10-12)

`GET /api/v1/public/properties` — No auth, only status published, Public DTO only (no owner, no exact_address), filters property_type, transaction_type, city_code, district_code, min_price, max_price, min_area, max_area, has_parking, has_elevator, rooms, q LIKE title/description/code, pagination limit/offset, order id desc
`GET /api/v1/public/properties/by-code/{code}` — No auth, Deep Link /p/{code} per بند 62, returns Public DTO, 404 if not published
`GET /api/v1/public/properties/{id}` — No auth, by id, 404 if not published
`GET /api/v1/public/og/{code}` — No auth, returns HTMLResponse with OG tags + JSON-LD RealEstateListing + Twitter card + redirect to SPA if not crawler, 404 HTML if not found — for SEO crawlers (Telegram, WhatsApp, Google)

Public DTO: id, code, title, description, property_type, transaction_type, status, price, rent_price, deposit, land_area, built_area, useful_area, rooms, bedrooms, bathrooms, floor_number, total_floors, has_parking, has_elevator, has_warehouse, has_balcony, city, district, city_code, district_code, neighborhood, public_lat, public_lng, usages, primary_image, images[:10], created_at, updated_at — NO owner_name, owner_phone, exact_address, legal_info

SEO: og:type website, site_name املاک علی‌بابا, title, description price+city, image primary_image, url /p/{code}, twitter card summary_large_image, JSON-LD @context schema.org @type RealEstateListing name/description/url/image/offers price IRR/address, dynamic meta update in SPA public detail via JS

Deep Links: /p/{code} for property (public view without auth), /d/{code} for deal (future) — frontend parsePublicPath regex, backend /public/og/{code} for crawler OG

PWA: Manifest /manifest.webmanifest generated by vite-plugin-pwa, theme #1B3A5C, icons 72-512, Service Worker /sw.js + /workbox-*.js, offline.html fallback, install prompt via beforeinstallprompt, offline detection navigator.onLine

## 9.1 Server / PostgreSQL / Redis / RLS / Rate Limit — DONE (Phase 11)

**Cache:** `app/core/cache.py` — get_cache() returns RedisCache if REDIS_URL else MemoryCache, perms cached perms:{user}:{org}:{version} TTL 300s, used in get_context

**Rate Limit:** Middleware `RateLimitMiddleware` — limits DEFAULT 100/60, AUTH 20/60, PUBLIC 200/60, key rl:{client_id}:{path}, client_id user:{id} or ip:{ip} via X-Forwarded-For, 429 fail RATE_LIMITED فارسی + Retry-After + X-RateLimit headers, skip health/docs/openapi and ENV=test, fail open

**RLS:** PostgreSQL Row Level Security as second layer — `_set_rls_context` SET LOCAL app.current_org_id and app.bypass_rls, get_db sets from TenantContext, get_db_public sets bypass=1 for public; Migration a1b2c3d4e5f6 enables RLS on 19 tenant tables + policies tenant_isolation_select for properties (published OR org match OR NULL/'' OR bypass=1) + WRITE FOR ALL org match OR bypass, other tables FOR ALL org match OR bypass; SQLite no-op

**Headers:** X-RateLimit-Limit, X-RateLimit-Remaining added to all responses, Retry-After on 429

**Error Code:** RATE_LIMITED added to standard codes

## 9.2 Multi-Tenant — DONE (Phase 13)

**Tenant Isolation 4 layers:** Context (contextvars frozen dataclass) → Repository (TenantRepository _base_select filters org_id) → RLS (PostgreSQL policies) → Cache (perms:{user}:{org}:{version}). Access to other tenant → 404 not 403. Org A,B,C real verified in test_multi_tenant.

**Invitation Flow:** `POST /organizations/{id}/invitations` — Auth + org:member:invite, body {invited_telegram_id?, invited_phone?, role_code required, branch_id?}, validates role exists (system or custom), generates token raw token_urlsafe(32), stores sha256 hash, status pending, returns raw token once. `GET /organizations/{id}/invitations` — list. `DELETE /organizations/{id}/invitations/{inv_id}` — revoke pending only. `POST /invitations/accept` — body {token}, hashes token, searches invitation pending via bypass (not tenant filtered because user may not be member yet), validates identity telegram_id match if set, creates UserOrganization if not exists, assigns role via RbacService.assign_role + UserBranch if branch_id, marks accepted, bumps permissions_version + invalidates cache perms:{user}:{org}:*, returns invitation. Token single-use — second accept 404.

**Custom Roles:** `GET /organizations/{id}/roles` — Auth + role:manage, list system (org_id NULL) + custom (org_id = org). `POST /organizations/{id}/roles` — body {code [a-z0-9_]+, title, permission_codes []}, code not in SYSTEM_ROLE_PERMISSIONS, duplicate check, permission_codes must be in ALL_PERMISSIONS, ensures catalogue, creates Role is_system=False + RolePermissions. `GET /organizations/{id}/roles/{role_id}` — detail with permissions list. `PATCH /organizations/{id}/roles/{role_id}` — title?, permission_codes? (deletes existing + re-creates), forbids system roles. `DELETE /organizations/{id}/roles/{role_id}` — soft delete, forbids system. Permissions enforced via permission cache — after role change version bump? Role assignment bumps version via assign_role, custom role CRUD invalidates via cache TTL (5min) but new permissions visible after re-login or cache expiry.

**Super Admin Dashboard:** All `/admin/*` endpoints require is_super_admin (ForbiddenError otherwise) + use get_db_public bypass RLS. `GET /admin/organizations` — list all orgs via BaseRepository no tenant filter, q filter name/slug, pagination. `GET /admin/organizations/{id}` — detail. `GET /admin/organizations/{id}/stats` — counts members/branches/properties/persons/visits/deals via SELECT COUNT. `GET /admin/users` — list all users. `PATCH /admin/users/{id}/super-admin` — toggle is_super_admin + bump permissions_version. `GET /admin/stats` — global counts organizations/users/branches/properties/persons/visits/deals. Super admin check 403 otherwise.

**Frontend:** api.ts adds listInvitations/createInvitation/revokeInvitation/acceptInvitation, listRoles/createRole/getRole/updateRole/deleteRole, adminListOrgs/adminGetOrgStats/adminGlobalStats/adminListUsers/adminToggleSuperAdmin. App.tsx tabs team (invitations + accept UI), roles (custom roles CRUD), admin (super admin only, global stats, org list with stats, users with toggle).

## 9.3 AI / Automation — DONE (Phase 14)

**Core جدا از AI:** `app/modules/ai/adapter.py` — `AIProvider` abstract with `parse_search_query`, `suggest_description`, `match_score`. Providers: `MockProvider` (rule-based Persian deterministic, no external API), `OpenAIProvider` (fallback to mock if no key), `GeminiProvider`, `ClaudeProvider`, `LocalProvider` (Termux offline). Factory `get_provider()` via `AI_PROVIDER` env (mock, openai, gemini, claude, local). Settings `AI_PROVIDER`, `OPENAI_API_KEY`, etc.

**MockProvider Persian NLP:** Normalizes Persian digits, extracts property_type (آپارتمان→apartment, ویلا→villa, زمین→land, تجاری→commercial, اداری→office), transaction_type (فروش→sale, اجاره→rent, معاوضه→exchange), city (اصفهان→ISF, تهران→THR, شیراز→SHZ, مشهد→MSH, تبریز→TBZ), district (مرداویج→MJ, شهرک غرب→SHG, سعادت آباد→SAD, ولیعصر→VAL, جردن→JOR, زعفرانیه→ZAF), area (120 متری, 100 متر, از X متر, تا X متر), rooms/bedrooms (2 خوابه, 3 خواب, 2 اتاق), amenities (پارکینگ→has_parking, آسانسور→has_elevator, انباری→has_warehouse, بالکن→has_balcony), price (تا 20 میلیارد→max_price 20e9, از 10 میلیارد→min_price, میلیون handling). Confidence 0.5 + 0.08*filled fields capped 0.95.

**AI Service:** `app/modules/ai/service.py` — `AIService` tenant-aware, uses adapter. `parse_search_query(text)` validates length, calls provider, builds `filters` dict (property_type, transaction_type, city_code, district_code, min_price, max_price, min_area, max_area, rooms, has_parking, has_elevator) — q NOT included to avoid restrictive LIKE. `match_request_to_properties(request_id, limit)` gets request, builds request_data (property_type, transaction_type, city_code, district_code, area_min→min_area, area_max→max_area, budget_min→min_budget, budget_max→max_budget, rooms→min_rooms), searches properties via `PropertyRepository.search` with same type/city filters (50 limit), scores each via provider.match_score, returns matched or score>=0.4 sorted desc. `match_property_to_requests(property_id, limit)` reverse: gets property with location codes, lists requests via `CustomerRequestRepository.list`, scores, returns >=0.4 sorted. `suggest_description(property_id)` builds prop_data and calls provider.suggest_description.

**Endpoints:** `GET /ai/providers` — list current + available + details has_key. `POST /ai/search/parse` — body {text, use_provider?}, returns parsed + filters. `POST /ai/search/execute` — parse + immediately search properties via repo, returns {parsed, properties} + pagination meta. `POST /ai/match/request/{id}` — body {limit}, returns list {property, score, reasons, matched, provider}. `POST /ai/match/property/{id}` — returns {request, score, reasons, matched, provider}. `POST /ai/suggest/description/{property_id}` — returns {property_id, code, title, suggested_description, provider}.

**Permissions:** `ai:search`, `ai:match`, `ai:suggest`, `ai:manage` added to ALL_PERMISSIONS, ORG_ADMIN all, BRANCH_ADMIN search/match/suggest, AGENT search/match/suggest.

**Frontend:** api.ts adds aiListProviders, aiParseSearch, aiSearchExecute, aiMatchRequest, aiMatchProperty, aiSuggestDescription. App.tsx tab 🤖 AI with provider badges (current highlighted, has_key indicator), natural language search input with Parse + Search+Execute buttons, parsed JSON display + filters, results list with match + description buttons, auto matching buttons for persons/requests and properties, matches list with score badge (green >=0.7, orange >=0.5, gray else) + reasons, suggested description card.

## 9.4 Integrations / Advanced Platform — DONE (Phase 15)

**Core جدا از Integration:** `app/modules/integrations/adapter.py` — abstract providers per type: `TelegramProvider` (send_message, send_property_card, create_deep_link), `SmsProvider` (send_sms, send_otp), `ListingProvider` (publish, unpublish, get_status), `PaymentProvider` (create_payment, verify_payment), `MapsProvider` (geocode, reverse_geocode, get_static_map_url, calculate_distance). Providers: Mock (deterministic, no external API), TelegramBotProvider (fallback mock if no TELEGRAM_BOT_TOKEN), KavenegarSmsProvider (fallback mock), DivarListingProvider/SheypoorListingProvider (fallback mock), ZarinpalPaymentProvider (fallback mock), OsmMapsProvider (OpenStreetMap Nominatim free, no key, self-hosted friendly). Factory `get_telegram_provider()`, `get_sms_provider()`, `get_listing_provider(platform)`, `get_payment_provider()`, `get_maps_provider()` via env vars TELEGRAM_PROVIDER, SMS_PROVIDER, DIVAR_PROVIDER, SHEYPOOR_PROVIDER, PAYMENT_PROVIDER, MAPS_PROVIDER (mock/osm/telegram_bot/kavenegar/divar/sheypoor/zarinpal). `get_all_providers_status()` returns current/available/details has_key.

**Integration Service:** `app/modules/integrations/service.py` — tenant-aware, uses adapter factories, logs every external call via `IntegrationLogRepository` (provider, action, entity_type/id, request_payload, response_payload, status success/failed, external_id/url, error_message). Methods: `send_telegram`, `send_property_via_telegram`, `create_deep_link` (t.me/{bot}?start={payload}), `send_sms`, `send_otp` (random 6-digit if no code), `publish_listing` (platform divar/sheypoor, property_data with location codes), `unpublish_listing`, `create_payment` (amount IRR, description, callback_url), `verify_payment`, `geocode` (deterministic mock based on address md5 hash → lat 32.65+ + lng 51.66+, city detection), `reverse_geocode`, `get_static_map` (OSM url), `calculate_distance` (haversine), `list_logs` (filters provider/status, pagination).

**Model:** `IntegrationLog` — id, organization_id, branch_id, provider, action, entity_type, entity_id, request_payload, response_payload, status, error_message, external_id, external_url, BaseEntity fields, RLS enabled in migration b2c3d4e5f6a7.

**Endpoints:** `GET /integrations/providers` — list current+available+details. `POST /integrations/telegram/send` {chat_id, text, parse_mode} → {success, message_id, chat_id, provider}. `POST /integrations/telegram/send-property/{property_id}` {chat_id} → property card. `GET /integrations/telegram/deep-link?payload=xxx` → deep_link t.me. `POST /integrations/sms/send` {phone, message} → {success, to, message_id}. `POST /integrations/sms/otp` {phone, code?} → {success, code (mock only)}. `POST /integrations/listings/publish` {platform divar/sheypoor, property_id} → {success, external_id, url, status published}. `POST /integrations/listings/unpublish` {platform, external_id} → unpublished. `POST /integrations/payment/create` {amount, description, callback_url?, metadata?} → {payment_id, payment_url, amount, status pending}. `GET /integrations/payment/verify/{payment_id}` → verified. `POST /integrations/maps/geocode` {address} → {lat, lng, city, confidence}. `POST /integrations/maps/reverse-geocode` {lat, lng} → address. `GET /integrations/maps/static-map?lat=&lng=&zoom=` → url OSM. `POST /integrations/maps/distance` {lat1,lng1,lat2,lng2} → distance_km/m. `GET /integrations/logs?limit=&offset=&provider=&status=` → logs list + pagination meta.

**Permissions:** `integration:telegram`, `integration:sms`, `integration:listings`, `integration:payment`, `integration:maps`, `integration:logs`, `integration:manage` added to ALL_PERMISSIONS, ORG_ADMIN all, BRANCH_ADMIN telegram/sms/listings/maps/logs, AGENT telegram/maps.

**Frontend:** api.ts adds intListProviders, intTelegramSend, intTelegramSendProperty, intTelegramDeepLink, intSmsSend, intSmsOtp, intPublishListing, intUnpublishListing, intCreatePayment, intVerifyPayment, intGeocode, intReverseGeocode, intStaticMap, intDistance, intListLogs. App.tsx tab 🔌 یکپارچه (blue #1565C0/#E3F2FD) with provider status chips current+has_key, 2x2 grid: Telegram (chat_id+text+send+deep-link+property cards), SMS (phone+message+send+OTP), Listings (Divar/Sheypoor publish per property), Payment (amount+desc+create link), Maps (geocode address → lat/lng + OSM link + distance Isfahan-Tehran), Results list mock deterministic, Logs list audit with external_id/url.

**Config:** .env.example adds TELEGRAM_PROVIDER, TELEGRAM_BOT_USERNAME, SMS_PROVIDER, KAVENEGAR_API_KEY, DIVAR_PROVIDER, SHEYPOOR_PROVIDER, PAYMENT_PROVIDER, ZARINPAL_API_KEY, MAPS_PROVIDER (mock/osm), OSM_NOMINATIM_URL. config.py adds same fields.

## 10. Error Handling

تمام خطاها از `app/core/errors.py` و `middleware/error_handler.py`:

- `AppError` → تبدیل به Envelope با `success=false`
- DB خطای خام هرگز به Client نمی‌رود
- Validation: Pydantic → `VALIDATION_ERROR` با details

## 11. Security Checklist per Endpoint

- [ ] Auth required? (public endpoints exception — no auth for /public/*)
- [ ] Tenant context required? (`get_tenant_context`) — public uses BaseRepository no tenant filter
- [ ] Permission guard? (`require_permission("property:create")`)
- [ ] organization_id از Context نه از Body
- [ ] Public DTO vs Internal DTO جدا؟
- [ ] 404 برای Tenant دیگر؟ (TenantRepository خودکار) — public returns 404 if not published
- [ ] Optimistic Locking برای PATCH?
- [ ] Idempotency برای POST?

## 12. OpenAPI

- `GET /docs` Swagger UI
- `GET /redoc` ReDoc
- `GET /openapi.json` JSON

تمام endpointها باید summary, description فارسی داشته باشند.

## 13. Future: Cursor Pagination

فعلا offset, اما `meta.pagination` شامل `next_cursor` در آینده. `Pagination` dataclass از حالا `cursor` را دارد (reserved).
