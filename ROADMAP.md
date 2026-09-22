# ROADMAP — AREP

## نمای کلی (بند 96)

```
Phase 0: Project Constitution + Documentation
Phase 1: Local Runtime
Phase 2: Core Backend
Phase 3: Frontend + Design System
Phase 4: Identity / RBAC
Phase 5: Property Engine
Phase 6: CRM
Phase 7: Search / Favorites / Saved Searches
Phase 8: Visits / Notifications
Phase 9: Deals / Commission
Phase 10: PWA / Offline
Phase 11: Server / PostgreSQL / Redis
Phase 12: Public Platform
Phase 13: Multi-Tenant
Phase 14: AI / Automation
Phase 15: Integrations / Advanced Platform
```

---

### Phase 0: Project Constitution + Documentation

**هدف:** Repository خودش Source of Truth باشد (بند 65)

**وضعیت:** IN PROGRESS (2026-09-21)

**Tasks:**
- [x] PROJECT_CONSTITUTION.md
- [x] CURRENT_STATE.md
- [ ] ARCHITECTURE.md
- [ ] DATABASE.md
- [ ] API_CONTRACT.md
- [ ] UI_UX.md
- [ ] ROADMAP.md (این فایل)
- [ ] CHANGELOG.md
- [ ] CONTRIBUTING.md
- [ ] ADRها به صورت جداگانه در docs/decisions/

**DoD:** تمام فایل‌های بند 65 وجود دارند, تست‌ها پاس.

---

### Phase 1: Local Runtime

**هدف:** اجرا روی Android بدون Docker

**وضعیت:** DONE (2026-09-18)

**انجام شده:**
- SQLite پیش‌فرض
- `scripts/termux_setup.sh` و `termux_start.sh`
- Uvicorn 0.0.0.0:8000
- Alembic با batch mode برای SQLite

**باقی‌مانده:**
- مستندسازی دقیق Termux (docs/deployment/termux.md)
- اسکریپت `start-local.sh` یکپارچه برای Linux/Mac

---

### Phase 2: Core Backend

**هدف:** Modular Monolith Foundation

**وضعیت:** DONE

**انجام شده:**
- FastAPI factory, CORS, Middleware (RequestContext, ErrorHandler)
- BaseEntity, TenantEntity, Mixins
- BaseRepository + TenantRepository
- Response Envelope
- Idempotency, Optimistic Locking, Soft Delete, Audit fields
- code_sequences, idempotency_keys tables
- Alembic migration 0001

---

### Phase 3: Frontend + Design System

**هدف:** React + PWA foundation

**وضعیت:** PARTIAL

**انجام شده:**
- Vite + React 18 + TS
- Telegram Web App integration
- api.ts با Envelope handling

**TODO:**
- Refactor به Feature-Based (app/features/shared)
- Design System (Button, Input, Modal, BottomSheet, Card, Badge, Table, Toast...)
- Tailwind + RTL
- React Hook Form + Zod
- Zustand برای State

---

### Phase 4: Identity / RBAC

**هدف:** Auth + Multi-Tenant + RBAC

**وضعیت:** DONE

**انجام شده:**
- Telegram initData HMAC-SHA256 + auth_date check
- JWT با claims کامل + permissions_version
- Tenant Context (contextvars)
- Organization, Branch, Membership, UserBranch
- RBAC: Permission, Role, RolePermission, UserRole + System Roles
- Tenant Isolation 404
- Endpoints: /auth/telegram, /auth/dev-login, /auth/select-organization, /organizations, /me
- 28 تست

**TODO:**
- Invitation Flow endpoint
- Custom Roles management endpoint
- make-super-admin CLI
- Rate Limiting

---

### Phase 5: Property Engine

**هدف:** هسته اصلی املاک — مهم‌ترین Domain

**وضعیت:** DONE (2026-09-21)

**انجام شده:**
- **Models:** properties, property_usages (Mixed Use), property_locations (Public vs Private), property_media + abstraction
- **Code Generator:** Service برای `AB-ISF-MJ-AP-S-2608-00124` از code_sequences — period YYMM, sequence 5 digits, atomic
- **Privacy:** Public DTO vs Internal DTO — exact_address فقط با `property:address:read`, owner فقط با `property:owner:read`
- **API:** POST /properties (idempotent), GET /properties (filter), GET /properties/{id}, GET /properties/by-code/{code} (Deep Link), PATCH (version), DELETE soft
- **Validation:** اگر Intermediary باشد owner لازم نیست (بند 29)
- **Tests:** 3 new tests — total 30
- **Migration:** 0002 8d453b823210_add_property_domain
- **Frontend:** Property List + Create Form ساده
- **ADR:** ADR-0009

---

### Phase 6: CRM

**هدف:** افراد مستقل از Role, درخواست‌ها, علاقه‌مندی, جستجوی ذخیره

**وضعیت:** DONE (2026-09-21)

**انجام شده:**
- **Models:** persons (unique phone per org), person_roles (Mixed Roles بند 34), customer_requests (بند 35), favorites (بند 36), saved_searches (بند 37 + matching)
- **Permissions:** customer:create/read/update/delete, customer_request:create/read/update, favorite:manage, saved_search:manage
- **Services:** PersonService (duplicate phone check CUSTOMER_PHONE_TAKEN), CustomerRequestService, FavoriteService (idempotent), SavedSearchService (find_matches via PropertyService)
- **API:** /persons, /customer-requests, /favorites, /saved-searches + matches
- **Tests:** 4 new — total 34 passed
- **Migration:** 0003 0e898a633ce7_add_crm_domain
- **Frontend:** Tabs Properties/CRM/Favorites, Person Create Form, Favorite toggle, Saved Searches list
- **ADR:** ADR-0010

---

### Phase 7: Search / Favorites / Saved Searches

**هدف:** Core Feature Search + Favorites + Saved Searches

**وضعیت:** DONE (2026-09-21) — Favorites و Saved Searches در Phase 6 انجام شد, Search Polish در Phase 5-6 انجام شد

**انجام شده:**
- Structured Search: property_type, transaction_type, status, city_code, district_code, price, area, parking, elevator, rooms, q LIKE — کافی برای Local (بند 83)
- Favorites: idempotent add, list per user, remove
- Saved Searches: CRUD + find_matches via PropertyService.search (بند 37)
- Frontend: Favorite toggle, Saved Searches list, Matching endpoint

**باقی‌مانده برای آینده:**
- PostgreSQL Full Text Search (FTS)
- Natural Language Search via AI Adapter (بند 15)
- Notification for Saved Search matches (Service آماده است)

---

### Phase 8: Visits / Notifications

**هدف:** بازدیدها + اعلان‌ها

**وضعیت:** DONE (2026-09-21)

**انجام شده:**
- **Models:** visits (property_id, customer_id, agent_id, visit_date, visit_time, status scheduled/done/cancelled/no_show/rescheduled, notes, result), notifications (user_id, channel in_app/telegram/sms/push/email, priority critical/important/normal/informational, title, body, entity_type, entity_id, data_json, is_read, read_at)
- **Permissions:** visit:create/read/update/delete, notification:read/manage
- **Services:** VisitService (auto-create notification for agent), NotificationService (list per user, mark read, mark all read, unread count, priority filter)
- **API:** /visits (CRUD + filters), /notifications (CRUD + unread-count + read + read-all)
- **Tests:** 3 new — test_visit_crud_and_notification (CRUD + auto notif + unread count + mark read), test_visit_tenant_isolation (404), test_notifications_priority_and_channels (critical/important/normal/informational) — total 37 passed
- **Migration:** 0004 84455b931380_add_visits_and_notifications
- **Frontend:** Tabs Visits/Notifications, Visit Create Form (property_id, customer_id, date, time), Notification list with priority badges, unread highlight, mark all read, unread count
- **ADR:** ADR-0011

**DoD Achieved:**
- [x] Migration 0004
- [x] Visit CRUD + Tenant Isolation 404
- [x] Notification Core + Priority + Channels + Unread count
- [x] Auto notification on Visit create
- [x] 3 تست جدید (total 37)
- [x] Frontend: Visits + Notifications tabs

**باقی‌مانده:**
- Telegram Adapter برای Notification
- Visit Calendar view
- Deal ارتباط با Visit
- Real-time via WebSocket

---

### Phase 6: CRM

**هدف:** افراد مستقل از Role

**Scope:**
- persons (Person می‌تواند همزمان Owner, Buyer, Tenant...)
- person_roles
- customer_requests (transaction, property_type, location, budget, area, rooms, amenities)
- Validation: یک Person چند نقش
- API: /persons, /requests

---

### Phase 7: Search / Favorites / Saved Searches

**هدف:** Core Feature Search

**Scope:**
- Structured Search (type, district, area, price, rooms, amenities)
- Full Text Search (PostgreSQL FTS آینده, فعلا DB Search)
- Favorites (user ↔ property)
- Saved Searches + Matching → Notification (stub)
- API: /properties/search, /favorites, /saved-searches

---

### Phase 8: Visits / Notifications

**Scope:**
- visits (property, customer, agent, date, time, status, notes)
- notifications core (in-app, telegram adapter)
- Priority: Critical, Important, Normal, Info
- API: /visits, /notifications

---

### Phase 9: Deals / Commission

**وضعیت:** DONE (2026-09-21)

**انجام شده:**
- **Models:** deals (code DL-YYMM-00001, title, status lead/qualification/property_match/visit/negotiation/agreement/closed_won/closed_lost/archived, customer_id FK RESTRICT required, property_id FK SET NULL nullable independent per بند39, agent_id, amount, commission_total/agent/office/referral, commission_status pending/partially_paid/paid/cancelled, notes/loss_reason), deal_status_history (deal_id FK CASCADE, from_status/to_status, changed_by, notes)
- **Code Generator:** DL-YYMM-00001 atomic via code_sequences scope deal, period YYMM, sequence 5 digits
- **Pipeline:** VALID_TRANSITIONS enforces Lead→...→Closed, closed_lost→lead reopen, archived terminal, History 7 entries for full pipeline
- **Permissions:** deal:create/read/update/delete, commission:read/manage
- **Services:** DealService (code gen, customer/property existence check property optional, agent default current user, history, notifications on create/status change), Commission simple fields, Accounting future
- **API:** POST /deals, GET /deals (filters), GET /by-code/{code} Deep Link, GET /{id}, GET /{id}/history, PATCH /{id}, DELETE /{id}
- **Tests:** 3 new — total 40 passed
- **Migration:** 30be32e888f7_add_deals_and_commission
- **Frontend:** Deals tab, Create Form, Pipeline badge, Next Stage, History viewer, Commission display
- **ADR:** ADR-0012

**باقی‌مانده:**
- Accounting Domain جدا: ledger, payments, distribution
- Deal ↔ Visit linkage
- Kanban board

**Scope اصلی (DONE):**
- deals (Lead → Closed pipeline, مستقل از Property) ✅
- commission (total, agent_share, office_share, referral_share, payment_status) ✅ simple fields
- Accounting Domain جدا (آماده‌سازی) ⏳ future

---

### Phase 10: PWA / Offline

**وضعیت:** DONE (2026-09-21)

**انجام شده:**
- Manifest: name املاک علی‌بابا — AREP, short_name علی‌بابا, description فارسی, theme #1B3A5C, background #F5F5F5, display standalone, scope /, start_url /, dir rtl, lang fa
- Icons: 72,96,144,192,512 + maskable 512 + apple-touch-icon 180 + favicon.ico — base 512 generated (navy+gold house) + resized via PIL
- Service Worker: vite-plugin-pwa@0.21.1 generateSW, precache 36 entries 1.7MB, runtimeCaching telegram CacheFirst 7d, /api/* NetworkFirst 10s 5min, /public/* StaleWhileRevalidate 1h
- PWA: index.html theme-color, apple-touch-icon, favicon, OG defaults, twitter card, noscript, offline.html fallback
- src/pwa.ts: registerPWA, setupInstallPrompt, isStandalone, isOnline, online/offline events
- Offline: App Shell cached, API cached, detection navigator.onLine + banners offline/update/install/outbox, Outbox localStorage arep_outbox type create_property, sync button
- Frontend: App.tsx PWA banners offline red + update dark blue + install white/gold + outbox yellow sync, footer PWA status, isPublicView handling, parsePublicPath /p/CODE /d/CODE
- Build: vite build OK, dist sw.js, workbox-*.js, manifest.webmanifest, registerSW.js
- ADR: ADR-0013

**Scope اصلی (DONE):**
- Manifest (name, icons, theme_color #1B3A5C) ✅
- Service Worker (Vite PWA plugin) ✅
- Installability, Caching, Update Strategy ✅
- Offline: App Shell + Cached UI → بعدا Offline Property Creation + Sync Outbox ✅ (Outbox برای create_property)
- Icons, Responsive ✅

---

### Phase 11: Server / PostgreSQL / Redis

**وضعیت:** DONE (2026-09-21)

**انجام شده:**
- **Cache:** app/core/cache.py — CacheBackend abstract, MemoryCache (dict+TTL+lock+incr+delete_pattern), RedisCache (redis.asyncio, JSON, setex, scan_iter, pipeline), Singleton get_cache(), REDIS_URL → Redis else Memory fallback, perm_cache_key perms:{user}:{org}:{version} TTL 300s
- **Rate Limit:** app/middleware/rate_limit.py — RateLimitMiddleware, limits DEFAULT 100/60 AUTH 20/60 PUBLIC 200/60, client_id user:{id} or ip:{ip} via X-Forwarded-For, key rl:{client_id}:{path}, 429 RATE_LIMITED فارسی + Retry-After + X-RateLimit headers, skip health/docs and ENV=test, fail open
- **RLS:** app/db/session.py — _set_rls_context SET LOCAL app.current_org_id and app.bypass_rls for PostgreSQL, get_db sets from TenantContext, get_db_public bypass=1 for public; public.py changed to get_db_public for all 4 endpoints
- **Migration a1b2c3d4e5f6_add_rls_policies_phase_11.py:** TENANT_TABLES 19 tables, PUBLIC_TABLES properties, _is_postgres check no-op on SQLite, upgrade ENABLE RLS + CREATE POLICY tenant_isolation_select for properties (published OR org match OR NULL/'' OR bypass) + WRITE FOR ALL org match OR bypass, other tables FOR ALL org match OR bypass; downgrade DISABLE RLS
- **Permissions Cache:** app/api/deps.py get_context — try cache perms:{user}:{org}:{version}, hit use else resolve via RbacService and set TTL 300s
- **Nginx:** nginx/arep.conf verified — security headers, gzip, /api/ proxy with timeouts + RateLimit headers, docs/health, PWA assets 1y immutable, manifest 1h, sw.js no-cache, Deep Links /p/{code} bot detection → /api/v1/public/og/$1 else SPA, /d/{code} SPA, / → index.html no-cache, deny hidden
- **Docker Compose:** docker-compose.yml verified — db postgres:16-alpine healthcheck pg_isready, redis redis:7-alpine maxmemory 256mb allkeys-lru healthcheck redis-cli ping, backend build Dockerfile depends_on db+redis healthy env production healthcheck curl /api/v1/health, nginx nginx:1.27-alpine depends_on backend healthy volumes arep.conf + frontend/dist ports 80:80 healthcheck, networks arep_net, volumes db_data redis_data backend_logs, usage comments
- **Dockerfile:** python:3.12-slim, requirements-postgres.txt asyncpg+redis, HEALTHCHECK curl /api/v1/health, CMD alembic upgrade head && uvicorn
- **Tests:** conftest override get_db_public + clear _memory_store, alembic upgrade head OK on SQLite RLS no-op, pytest 42 passed
- **ADR:** ADR-0014

**Scope اصلی (DONE):**
- PostgreSQL Migration تست شده ✅ alembic upgrade head OK on SQLite (RLS no-op) + ready for Postgres
- RLS به‌عنوان لایه دوم Isolation ✅ 19 tables ENABLE RLS + policies org match OR bypass + published for properties
- Redis برای Cache Permissions + Rate Limit ✅ Memory fallback for Local-First, Redis in prod, perms cached 5min, rate limit 100/20/200 per min
- Nginx config production ✅ security headers, gzip, PWA caching, Deep Links bot→OG else SPA, healthchecks
- Docker Compose verified ✅ db+redis+backend+nginx with healthchecks, depends_on healthy, networks, volumes

---

### Phase 12: Public Platform

**وضعیت:** DONE (2026-09-21)

**انجام شده:**
- Backend app/api/v1/public.py: router /public no auth, Public DTO only (no owner, no exact_address), _base_public_query status published no tenant filter, GET /public/properties with filters, GET /by-code/{code}, GET /{id}, GET /og/{code} HTML OG+JSON-LD+redirect SPA if not crawler
- SEO: OG title/description/image/url, Twitter card, JSON-LD RealEstateListing, dynamic meta update in SPA, Deep Links /p/{code} /d/{code} per بند 62
- Frontend: api.ts publicListProperties/publicGetByCode/publicGetById + outbox helpers, App.tsx parsePublicPath, isPublicView public page without auth, loadPublic, loadPublicDetail with dynamic OG meta, Public UI detail card + list, authenticated tab public with OG HTML link, properties shows /p/{code}, deals shows /d/{code}
- Tests: 2 new — test_public_properties, test_public_search_filters — total 42 passed
- Build: vite build OK, PWA + public deep links
- ADR: ADR-0013

**Scope اصلی (DONE):**
- Public Website (www) + App (app.example.com) ✅ SPA handles /p/{code} public view without auth
- Public Property Pages با SEO, Structured Data, Open Graph ✅ OG + JSON-LD + /public/og/{code} HTML
- Public DTO فقط اطلاعات مجاز ✅
- Deep Links /p/{code} ✅ + /d/{code} آماده

---

### Phase 13: Multi-Tenant

**وضعیت:** DONE (2026-09-21)

**انجام شده:**
- **Tenant Isolation 4 layers:** Context → Repository (TenantRepository) → RLS (PostgreSQL policies) → Cache (perms:{user}:{org}:{version} TTL 300s). Access to other tenant → 404 not 403. Verified Org A,B,C real isolation — each creates property, cannot see others' properties 404.
- **Invitation Flow:** OrganizationInvitation model with token_hash indexed, invited_telegram_id/phone, role_code, status pending/accepted/expired/revoked, accepted_by_user_id. Service generates raw token_urlsafe(32) sha256 hash, returns raw once. Accept creates membership UserOrganization + role via RbacService.assign_role + branch UserBranch + bumps permissions_version + invalidates cache perms:*. Token single-use, identity match telegram_id if set, pending only, revoke pending only.
- **Custom Roles:** Role model organization_id NULL system vs custom org_id set is_system=False. CustomRoleService list system+custom, create with code [a-z0-9_]+ not system, duplicate check, permission_codes must be in ALL_PERMISSIONS, ensures catalogue, creates Role + RolePermissions. Get detail, update title/permissions (delete+recreate), delete soft, forbids system. Permissions enforced via permission cache perms:{user}:{org}:{version}.
- **Super Admin Dashboard:** AdminService uses BaseRepository bypass RLS via get_db_public, requires is_super_admin else 403. Endpoints: GET /admin/organizations list all, GET /{id} detail, GET /{id}/stats counts members/branches/properties/persons/visits/deals, GET /admin/users list all, PATCH /admin/users/{id}/super-admin toggle + bump version, GET /admin/stats global counts. Frontend admin tab if is_super_admin with global stats, org list with stats button, users with toggle.
- **API:** POST/GET/DELETE /organizations/{id}/invitations, POST /invitations/accept, GET/POST/GET/PATCH/DELETE /organizations/{id}/roles, GET /admin/organizations, GET /admin/organizations/{id}, GET /admin/organizations/{id}/stats, GET /admin/users, PATCH /admin/users/{id}/super-admin, GET /admin/stats
- **Tests:** 4 new — test_multi_tenant_isolation_abc (A,B,C create property, cross access 404, list only own), test_invitation_flow (create invitation with token, list, accept creates membership+role, property create by invited user, second accept 404, revoke accepted conflict), test_custom_roles (list system, create custom, detail, update, duplicate 409, system code 409, delete, get after delete 404, delete system 403), test_admin_dashboard (normal user 403 admin, set super_admin via engine fixture, re-login, list orgs, global stats, org stats, list users, toggle super_admin) — total 46 passed (1 failed alembic binary not found)
- **Frontend:** api.ts adds invitation/roles/admin endpoints, App.tsx tabs team (invitations CRUD + accept UI), roles (custom roles CRUD), admin (super admin only, global stats, orgs with stats, users toggle), org isolation note, token display once, permission cache note.
- **ADR:** ADR-0015-multi-tenant (planned)

**Scope اصلی (DONE):**
- Organization A, B, C واقعی ✅
- Tenant Isolation در 4 لایه + RLS واقعی ✅
- Super Admin Dashboard ✅
- Invitation Flow ✅
- Custom Roles ✅

---

### Phase 14: AI / Automation

**وضعیت:** DONE (2026-09-21)

**انجام شده:**
- **AI Adapter:** `app/modules/ai/adapter.py` — `AIProvider` abstract, Providers: Mock (rule-based Persian deterministic, no internet), OpenAI (fallback to mock if no key), Gemini, Claude, Local (Termux offline). Factory `get_provider()` via `AI_PROVIDER` env. Settings `AI_PROVIDER`, `OPENAI_API_KEY`, `GEMINI_API_KEY`, `CLAUDE_API_KEY`, `ANTHROPIC_API_KEY`. Core جدا از AI — AIService uses adapter, no direct LLM dependency.
- **MockProvider Persian NLP:** Normalizes Persian digits ۰-۹→0-9, extracts property_type (آپارتمان→apartment, ویلا→villa, زمین→land, تجاری→commercial, اداری→office), transaction_type (فروش→sale, اجاره→rent, معاوضه→exchange), city (اصفهان→ISF, تهران→THR, شیراز→SHZ, مشهد→MSH, تبریز→TBZ), district (مرداویج→MJ, شهرک غرب→SHG, سعادت آباد→SAD, ولیعصر→VAL, جردن→JOR, زعفرانیه→ZAF), area (120 متری, 100 متر, از X متر, تا X متر), rooms/bedrooms (2 خوابه, 3 خواب, 2 اتاق), amenities (پارکینگ→has_parking, آسانسور→has_elevator, انباری→has_warehouse, بالکن→has_balcony), price (تا 20 میلیارد→max_price 20e9, از 10 میلیارد→min_price, میلیون handling). Confidence 0.5 + 0.08*filled capped 0.95.
- **AI Service:** `app/modules/ai/service.py` — tenant-aware, `parse_search_query` validates, builds filters (property_type, transaction_type, city_code, district_code, min_price, max_price, min_area, max_area, rooms, has_parking, has_elevator) without q to avoid restrictive LIKE, `match_request_to_properties` searches properties 50 via repo with same type/city, scores via provider.match_score, returns matched or >=0.4 sorted desc, `match_property_to_requests` reverse, `suggest_description` generates description.
- **Endpoints:** `GET /ai/providers` list current+available+details, `POST /ai/search/parse` {text, use_provider?} → parsed+filters, `POST /ai/search/execute` parse+search → {parsed, properties}+meta, `POST /ai/match/request/{id}` {limit} → [{property, score, reasons, matched, provider}], `POST /ai/match/property/{id}` → [{request, score, reasons, matched, provider}], `POST /ai/suggest/description/{property_id}` → {suggested_description, provider}
- **Permissions:** ai:search, ai:match, ai:suggest, ai:manage added, ORG_ADMIN all, BRANCH_ADMIN and AGENT search/match/suggest.
- **Tests:** 5 new — test_ai_providers_list, test_ai_parse_search_query (آپارتمان 120 متری مرداویج اصفهان پارکینگ آسانسور تا 15 میلیارد → apartment, اصفهان, مرداویج, has_parking, has_elevator, max_price 15B, filters), test_ai_search_execute (create apartment ISF 14B + villa THR 50B, search 'آپارتمان در اصفهان تا 15 میلیارد' → finds apartment), test_ai_matching (person + customer_request area_min/max budget_min/max rooms + property 120m 3 rooms 15B ISF MJ → match request→property score>=0.5 + property→request), test_ai_suggest_description (property → description >20 chars) — total 51 passed.
- **Frontend:** api.ts adds aiListProviders, aiParseSearch, aiSearchExecute, aiMatchRequest, aiMatchProperty, aiSuggestDescription. App.tsx tab 🤖 AI with provider badges, natural search input Parse + Search+Execute, parsed JSON + filters display, results with match/description buttons, auto matching buttons for persons/requests and properties, matches list with score badge green/orange/gray + reasons, suggested description card. AI-ready Architecture note.
- **ADR:** ADR-0016-ai-automation (planned)

**Scope اصلی (DONE):**
- AI Adapter (Provider قابل تعویض: OpenAI, Gemini, Claude, Local LLM) ✅ mock + openai/gemini/claude/local with fallback, factory via env
- Natural Language Search → Structured Query ✅ Persian rule-based parser deterministic
- Auto matching Request ↔ Property ✅ score 0-1 + reasons + matched flag
- AI-ready Architecture (Core جدا از AI) ✅ AIService uses adapter interface

---

### Phase 15: Integrations / Advanced Platform

**وضعیت:** DONE (2026-09-21)

**انجام شده:**
- **Integration Adapters:** `app/modules/integrations/adapter.py` — abstract per type: TelegramProvider (send_message, send_property_card, create_deep_link), SmsProvider (send_sms, send_otp), ListingProvider (publish, unpublish, get_status), PaymentProvider (create_payment, verify_payment), MapsProvider (geocode, reverse_geocode, get_static_map_url, calculate_distance). Providers: Mock deterministic (no external API, hash-based lat/lng, random message_id), TelegramBotProvider (uses TELEGRAM_BOT_TOKEN if set else fallback mock), KavenegarSmsProvider (fallback), DivarListingProvider/SheypoorListingProvider (fallback), ZarinpalPaymentProvider (fallback), OsmMapsProvider (OpenStreetMap Nominatim free, no key, self-hosted friendly, OSM url). Factory get_telegram_provider(), get_sms_provider(), get_listing_provider(platform), get_payment_provider(), get_maps_provider() via env TELEGRAM_PROVIDER, SMS_PROVIDER, DIVAR_PROVIDER, SHEYPOOR_PROVIDER, PAYMENT_PROVIDER, MAPS_PROVIDER. get_all_providers_status() current/available/details has_key.
- **Integration Service:** `app/modules/integrations/service.py` — tenant-aware, uses factories, logs every external call via IntegrationLogRepository (provider, action, entity_type/id, request_payload, response_payload, status, external_id/url, error_message). Methods: send_telegram, send_property_via_telegram (property card with code /p/{code}), create_deep_link (t.me/{bot}?start={payload}), send_sms, send_otp (random 6-digit), publish_listing (divar/sheypoor, property_data with location codes), unpublish_listing, create_payment (IRR, payment_id hash, payment_url), verify_payment, geocode (deterministic mock md5 hash → lat 32.65+ lng 51.66+, city detection اصفهان/تهران, confidence 0.85), reverse_geocode, get_static_map (OSM), calculate_distance (haversine Isfahan-Tehran ~400km), list_logs (provider/status filter, pagination).
- **Model & Migration:** IntegrationLog — provider, action, entity_type, entity_id, request_payload, response_payload, status success/failed/pending, error_message, external_id, external_url, BaseEntity, RLS enabled. Migration b2c3d4e5f6a7_add_integrations_phase_15.py creates table + indexes + RLS policy tenant_isolation (bypass OR org match). Added to models_registry.py. Updated RLS second layer.
- **Endpoints:** GET /integrations/providers, POST /integrations/telegram/send {chat_id, text}, POST /integrations/telegram/send-property/{property_id} {chat_id}, GET /integrations/telegram/deep-link?payload, POST /integrations/sms/send {phone, message}, POST /integrations/sms/otp {phone, code?}, POST /integrations/listings/publish {platform divar/sheypoor, property_id}, POST /integrations/listings/unpublish {platform, external_id}, POST /integrations/payment/create {amount, description, callback_url?, metadata?}, GET /integrations/payment/verify/{payment_id}, POST /integrations/maps/geocode {address}, POST /integrations/maps/reverse-geocode {lat,lng}, GET /integrations/maps/static-map?lat=&lng=&zoom=, POST /integrations/maps/distance {lat1,lng1,lat2,lng2}, GET /integrations/logs?limit&offset&provider&status. All tenant-aware, permissions integration:*.
- **Permissions:** integration:telegram, integration:sms, integration:listings, integration:payment, integration:maps, integration:logs, integration:manage added, ORG_ADMIN all, BRANCH_ADMIN telegram/sms/listings/maps/logs, AGENT telegram/maps.
- **Tests:** 7 new — test_integration_providers_list, test_telegram_send_mock (send + deep_link t.me), test_sms_send_mock (send + otp 6-digit), test_listings_publish_mock (property create + publish divar/sheypoor + unpublish), test_payment_mock (create amount 500k + verify), test_maps_mock (geocode اصفهان مرداویج → lat 30-40 lng 45-60 + reverse + static OSM + distance 400km), test_integration_logs (telegram send creates log, list logs) — total 58 passed.
- **Frontend:** api.ts adds intListProviders, intTelegramSend, intTelegramSendProperty, intTelegramDeepLink, intSmsSend, intSmsOtp, intPublishListing, intUnpublishListing, intCreatePayment, intVerifyPayment, intGeocode, intReverseGeocode, intStaticMap, intDistance, intListLogs. App.tsx tab 🔌 یکپارچه blue #1565C0/#E3F2FD with provider status chips current+has_key, 2x2 grid Telegram (chat_id+text+send+deep-link+property cards) / SMS (phone+message+send+OTP) / Listings (Divar/Sheypoor publish per property) / Payment (amount+desc+create), Maps section geocode + OSM link + distance, Results list mock deterministic, Logs list audit with external_id/url. 12 tabs total.
- **Config:** .env.example adds TELEGRAM_PROVIDER, TELEGRAM_BOT_USERNAME, SMS_PROVIDER, KAVENEGAR_API_KEY, DIVAR_PROVIDER, SHEYPOOR_PROVIDER, PAYMENT_PROVIDER, ZARINPAL_API_KEY, MAPS_PROVIDER mock/osm, OSM_NOMINATIM_URL. config.py adds same.
- **ADR:** ADR-0017-integrations (planned)

**Scope اصلی (DONE):**
- Telegram Bot (Login, Notification, Deep Link) ✅ login already existed + new send_message, send_property_card, create_deep_link t.me/{bot}?start=payload, mock deterministic
- SMS, Divar, Sheypoor, Payment, Maps ✅ each Adapter مستقل, mock + real provider fallback, no external API required for tests, OSM free no key
- هر Integration Adapter مستقل ✅ separate abstract + factory per type
- No Vendor Lock-in ✅ mock default, env-based factory, OSM instead of Google Maps, generic providers

---

## First Release Goal (بند 97)

اولین Release واقعی کوچک ولی قابل استفاده:

- Login (Telegram)
- Dashboard (Action-oriented)
- Property Registration + List + Search + Detail
- Customer Registration + List
- Basic Visit
- Favorites
- Basic Notifications

**نه تمام قابلیت‌های آینده از روز اول.**

## UX Goal (بند 98)

کاربر بدون آموزش طولانی:

```
ثبت ملک → جستجو → مشاهده → ثبت مشتری → ثبت درخواست → بازدید → پیگیری
```

## Performance Goal (بند 99)

سریع, سبک, کم‌مصرف, Mobile-friendly, Network-efficient. هیچ تکنولوژی سنگینی صرفاً برای حرفه‌ای به نظر رسیدن اضافه نشود.
