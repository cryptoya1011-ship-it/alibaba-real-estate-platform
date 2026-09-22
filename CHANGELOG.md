# CHANGELOG — AREP

تمام تغییرات مهم پروژه اینجا ثبت می‌شود (بند 67).

---

## [Unreleased] — 2026-09-21 — Integrations / Advanced Platform

### Added — Phase 15 Integrations / Advanced Platform (Sprint 11)
- **Integration Adapters:** app/modules/integrations/adapter.py — abstract per type: TelegramProvider (send_message, send_property_card, create_deep_link t.me), SmsProvider (send_sms, send_otp), ListingProvider (publish, unpublish, get_status), PaymentProvider (create_payment, verify_payment), MapsProvider (geocode, reverse_geocode, get_static_map_url, calculate_distance haversine). Providers: Mock deterministic (hash-based lat/lng 32.65+/51.66+, random message_id, external_id platform-code-time), TelegramBotProvider (uses TELEGRAM_BOT_TOKEN if set else fallback mock with telegram_bot_mock_fallback tag), KavenegarSmsProvider (KAVENEGAR_API_KEY/SMS_API_KEY fallback), DivarListingProvider (DIVAR_API_KEY), SheypoorListingProvider (SHEYPOOR_API_KEY), ZarinpalPaymentProvider (ZARINPAL_API_KEY/PAYMENT_API_KEY), OsmMapsProvider (OpenStreetMap Nominatim free no key, OSM url https://www.openstreetmap.org/?mlat={lat}&mlon={lng}). Factories get_telegram_provider(), get_sms_provider(), get_listing_provider(platform), get_payment_provider(), get_maps_provider() via env, get_all_providers_status() current/available/details has_key.
- **Integration Service:** app/modules/integrations/service.py — tenant-aware, uses factories, logs every external call via IntegrationLogRepository (provider, action, entity_type/id, request_payload, response_payload, status success/failed, external_id/url, error_message). Methods: send_telegram (validates text), send_property_via_telegram (property card with code /p/{code}), create_deep_link, send_sms (phone validation), send_otp (random 6-digit if no code), publish_listing (divar/sheypoor, property_data with location codes city_code/district_code), unpublish_listing, create_payment (IRR amount>0, payment_id md5 hash, payment_url), verify_payment, geocode (address min 2, deterministic mock md5 → lat/lng, city detection اصفهان/تهران), reverse_geocode, get_static_map (OSM), calculate_distance (haversine Isfahan-Tehran ~400km), list_logs (filters provider/status, pagination).
- **Model & Migration:** IntegrationLog model provider/action/entity_type/entity_id/request_payload/response_payload/status/error_message/external_id/external_url + BaseEntity, indexes org_provider, org_created, provider_status. Migration b2c3d4e5f6a7_add_integrations_phase_15.py creates table + RLS ENABLE + POLICY tenant_isolation (bypass=1 OR org_id match). Added to models_registry.py.
- **API:** app/api/v1/integrations.py — GET /integrations/providers, POST /integrations/telegram/send {chat_id, text}, POST /integrations/telegram/send-property/{property_id} {chat_id}, GET /integrations/telegram/deep-link?payload, POST /integrations/sms/send {phone, message}, POST /integrations/sms/otp {phone, code?}, POST /integrations/listings/publish {platform divar/sheypoor, property_id}, POST /integrations/listings/unpublish {platform, external_id}, POST /integrations/payment/create {amount, description, callback_url?, metadata?}, GET /integrations/payment/verify/{payment_id}, POST /integrations/maps/geocode {address}, POST /integrations/maps/reverse-geocode {lat,lng}, GET /integrations/maps/static-map?lat=&lng=&zoom=, POST /integrations/maps/distance {lat1,lng1,lat2,lng2}, GET /integrations/logs?limit&offset&provider&status. Added to router.py. Permissions integration:*.
- **Permissions:** integration:telegram, integration:sms, integration:listings, integration:payment, integration:maps, integration:logs, integration:manage added to ALL_PERMISSIONS, ORG_ADMIN all, BRANCH_ADMIN telegram/sms/listings/maps/logs, AGENT telegram/maps.
- **Tests:** tests/test_integrations.py 7 new — test_integration_providers_list, test_telegram_send_mock (send + deep_link t.me), test_sms_send_mock (send + otp 6-digit), test_listings_publish_mock (create property + publish divar/sheypoor + unpublish), test_payment_mock (create 500k + verify), test_maps_mock (geocode اصفهان مرداویج → lat 30-40 lng 45-60 + reverse + static OSM + distance >300km), test_integration_logs (telegram send → log list) — total 58 passed (1 deselected alembic).
- **Frontend:** frontend/src/api.ts adds intListProviders, intTelegramSend, intTelegramSendProperty, intTelegramDeepLink, intSmsSend, intSmsOtp, intPublishListing, intUnpublishListing, intCreatePayment, intVerifyPayment, intGeocode, intReverseGeocode, intStaticMap, intDistance, intListLogs. frontend/src/App.tsx tab 🔌 یکپارچه blue #1565C0/#E3F2FD with provider status chips current+has_key, 2x2 grid Telegram (chat_id+text+send+deep-link+property cards) / SMS (phone+message+send+OTP) / Listings (Divar/Sheypoor publish per property) / Payment (amount+desc+create), Maps section geocode + OSM link + distance Isfahan-Tehran, Results list mock deterministic, Logs list audit. Tab count 12.
- **Config:** backend/app/core/config.py adds TELEGRAM_PROVIDER, TELEGRAM_BOT_USERNAME, SMS_PROVIDER, SMS_API_KEY, KAVENEGAR_API_KEY, DIVAR_PROVIDER, DIVAR_API_KEY, SHEYPOOR_PROVIDER, SHEYPOOR_API_KEY, PAYMENT_PROVIDER, PAYMENT_API_KEY, ZARINPAL_API_KEY, MAPS_PROVIDER, OSM_NOMINATIM_URL. backend/.env.example adds same with mock defaults.
- **Docs:** API_CONTRACT.md 9.4 Integrations, ROADMAP.md Phase 15 DONE, CHANGELOG.md Phase 15, CURRENT_STATE.md updated, ADR-0017 planned.

## [0.1.9] — 2026-09-21 — AI / Automation

### Added — Phase 14 AI / Automation (Sprint 10)
- **AI Adapter:** app/modules/ai/adapter.py — AIProvider abstract parse_search_query/suggest_description/match_score, MockProvider rule-based Persian (digits normalization, property_type, transaction_type, city ISF/THR/SHZ/MSH/TBZ, district MJ/SHG/SAD/VAL/JOR/ZAF, area X متری/متر/از/تا, rooms X خوابه/اتاق, amenities پارکینگ/آسانسور/انباری/بالکن, price تا/از/حداکثر/میلیارد/میلیون), confidence 0.5+0.08*filled, OpenAIProvider/GeminiProvider/ClaudeProvider/LocalProvider with fallback to mock if no key, get_provider() factory via AI_PROVIDER env. Settings AI_PROVIDER, OPENAI_API_KEY, GEMINI_API_KEY, CLAUDE_API_KEY, ANTHROPIC_API_KEY.
- **AI Service:** app/modules/ai/service.py — tenant-aware, parse_search_query validates + builds filters without q, match_request_to_properties searches 50 properties via repo with type/city filters, scores via provider, returns matched or >=0.4 sorted desc, match_property_to_requests reverse via CustomerRequestRepository.list, suggest_description via provider.
- **API:** app/api/v1/ai.py — GET /ai/providers, POST /ai/search/parse {text, use_provider?}, POST /ai/search/execute parse+search {parsed, properties}+meta, POST /ai/match/request/{id} {limit} → [{property, score, reasons, matched, provider}], POST /ai/match/property/{id} → [{request, score, reasons, matched, provider}], POST /ai/suggest/description/{property_id} → {suggested_description, provider}. Added to router.py.
- **Permissions:** ai:search, ai:match, ai:suggest, ai:manage added to ALL_PERMISSIONS, ORG_ADMIN all, BRANCH_ADMIN and AGENT search/match/suggest.
- **Tests:** tests/test_ai.py 5 new — test_ai_providers_list, test_ai_parse_search_query, test_ai_search_execute, test_ai_matching (fixed schema person_id, area_min/max, budget_min/max, rooms), test_ai_suggest_description — total 51 passed (1 deselected alembic).
- **Frontend:** frontend/src/api.ts adds aiListProviders, aiParseSearch, aiSearchExecute, aiMatchRequest, aiMatchProperty, aiSuggestDescription. frontend/src/App.tsx tab 🤖 AI with provider badges, natural search input Parse + Search+Execute, parsed JSON + filters, results with match/description buttons, auto matching buttons, matches list with score badge green/orange/gray + reasons, suggested description card. Tab count 11.
- **Config:** backend/app/core/config.py adds AI_PROVIDER + keys, backend/.env.example adds AI_PROVIDER mock + commented keys.
- **Docs:** API_CONTRACT.md 9.3 AI, ROADMAP.md Phase 14 DONE, CHANGELOG.md Phase 14, CURRENT_STATE.md updated, ADR-0016 planned.

## [0.1.8] — 2026-09-21 — Multi-Tenant

### Added — Phase 13 Multi-Tenant (Sprint 9)
- **Tenant Isolation 4 layers:** Context → TenantRepository → RLS (PostgreSQL policies) → Cache perms:{user}:{org}:{version} TTL 300s, access other tenant → 404, verified Org A,B,C real isolation in test_multi_tenant_isolation_abc
- **Invitation Flow:** OrganizationInvitation model token_hash indexed, invited_telegram_id/phone, role_code, status pending/accepted/expired/revoked, accepted_by_user_id. InvitationRepository list_for_org + get_by_token_hash, InvitationService create (validates role exists system or custom, branch exists, generates raw token_urlsafe 32 sha256 hash, returns raw once), list, accept (bypass tenant filter via select, validates identity telegram_id match, creates UserOrganization if not exists, assigns role via RbacService.assign_role + UserBranch if branch_id, marks accepted, bumps permissions_version + invalidates cache delete_pattern perms:*, refresh), revoke (pending only). API: POST/GET/DELETE /organizations/{id}/invitations, POST /invitations/accept
- **Custom Roles:** Role model organization_id NULL system vs org_id custom is_system=False, CustomRoleService list system+custom, get_role, create_role (code [a-z0-9_]+ not system, duplicate check, permission_codes in ALL_PERMISSIONS, ensures catalogue, creates Role + RolePermissions), update_role (title/permissions delete+recreate), delete_role soft, forbids system. API: GET/POST/GET/{id}/PATCH/{id}/DELETE /organizations/{id}/roles, _role_to_dict with permissions list via permissions_for_role
- **Super Admin Dashboard:** AdminService uses BaseRepository bypass RLS via get_db_public, requires is_super_admin else 403, list_organizations with q filter + total, get_organization, get_organization_stats counts members/branches/properties/persons/visits/deals via SELECT COUNT, list_users, toggle_super_admin + bump version, global_stats counts. API: GET /admin/organizations, GET /admin/organizations/{id}, GET /admin/organizations/{id}/stats, GET /admin/users, PATCH /admin/users/{id}/super-admin, GET /admin/stats
- **Tests:** 4 new — test_multi_tenant_isolation_abc, test_invitation_flow (re-login after version bump), test_custom_roles, test_admin_dashboard (engine fixture direct UPDATE users SET is_super_admin=1 + re-login) — total 46 passed
- **Frontend:** api.ts adds invitation/roles/admin endpoints, App.tsx new tabs team (invitations CRUD + token display once + accept UI), roles (custom roles CRUD with permissions comma), admin (super admin only, global stats, org list with stats button, users toggle super admin), org isolation note, cache note
- **Docs:** API_CONTRACT.md 9.2 Multi-Tenant, ROADMAP.md Phase 13 DONE, CURRENT_STATE.md updated

## [0.1.7] — 2026-09-21 — Server / PostgreSQL / Redis / RLS

### Added — Phase 11 Server / PostgreSQL / Redis / RLS / Rate Limit / Nginx (Sprint 8)
- **Cache:** app/core/cache.py — CacheBackend abstract, MemoryCache (dict + TTL + lock + incr + delete_pattern), RedisCache (redis.asyncio, JSON, setex, scan_iter, pipeline), Singleton get_cache(), REDIS_URL → Redis else Memory fallback, perm_cache_key perms:{user}:{org}:{version} TTL 300s
- **Rate Limit:** app/middleware/rate_limit.py — RateLimitMiddleware, limits DEFAULT 100/60, AUTH 20/60, PUBLIC 200/60, client_id user:{id} or ip:{ip} via X-Forwarded-For, key rl:{client_id}:{path}, 429 fail RATE_LIMITED فارسی + Retry-After + X-RateLimit headers, skip health/docs and ENV=test, fail open
- **RLS:** app/db/session.py — _set_rls_context SET LOCAL app.current_org_id and app.bypass_rls for PostgreSQL, get_db sets from TenantContext, get_db_public bypass=1 for public published read; public.py changed to get_db_public for all 4 endpoints
- **Migration a1b2c3d4e5f6_add_rls_policies_phase_11.py:** TENANT_TABLES 19 tables, PUBLIC_TABLES properties, _is_postgres check no-op on SQLite, upgrade ENABLE RLS + CREATE POLICY tenant_isolation_select for properties SELECT USING (published OR org match OR NULL/'' OR bypass=1) + WRITE FOR ALL USING org match OR bypass, other tables FOR ALL USING org match OR bypass; downgrade DISABLE RLS
- **Permissions Cache:** app/api/deps.py get_context — try cache get perms:{user}:{org}:{version}, if hit use, else resolve via RbacService and set TTL 300s
- **Nginx:** nginx/arep.conf verified — security headers X-Content-Type-Options, X-Frame-Options, X-XSS-Protection, Referrer-Policy, Permissions-Policy, CSP for Telegram+PWA, gzip on, /api/ proxy to backend with timeouts + RateLimit headers, docs/health, PWA assets 1y immutable, manifest 1h, sw.js no-cache, workbox 1y, Deep Links /p/{code} bot detection → /api/v1/public/og/$1 else SPA, /d/{code} SPA, / → index.html no-cache, deny hidden
- **Docker Compose:** docker-compose.yml verified — db postgres:16-alpine healthcheck pg_isready, redis redis:7-alpine maxmemory 256mb allkeys-lru healthcheck redis-cli ping, backend build Dockerfile depends_on db+redis healthy env production healthcheck curl /api/v1/health, nginx nginx:1.27-alpine depends_on backend healthy volumes arep.conf + frontend/dist ports 80:80 healthcheck curl /health, networks arep_net, volumes db_data redis_data backend_logs, usage comments
- **Dockerfile:** python:3.12-slim, requirements-postgres.txt asyncpg+redis, HEALTHCHECK curl /api/v1/health, CMD alembic upgrade head && uvicorn
- **Tests:** conftest override get_db_public + clear _memory_store before/after engine, alembic upgrade head OK on SQLite RLS no-op, pytest 42 passed
- **Docs:** ADR-0014-server-redis-rls, CURRENT_STATE.md, ROADMAP Phase 11 DONE

---

## [0.1.6] — 2026-09-21 — PWA & Public Platform

### Added — Phase 10 PWA / Offline + Phase 12 Public Platform (Sprint 7)
- **PWA:**
  - vite-plugin-pwa@0.21.1 generateSW, Manifest name املاک علی‌بابا — AREP, short_name علی‌بابا, theme #1B3A5C, background #F5F5F5, display standalone, scope /, start_url /, dir rtl, lang fa
  - Icons: 72,96,144,192,512 + maskable 512 + apple-touch-icon 180 + favicon.ico — base 512 generated (navy+gold house)
  - Workbox: glob **/*.{js,css,html,ico,png,svg,woff2}, runtimeCaching telegram CacheFirst 7d, /api/* NetworkFirst 10s 5min, /api/v1/public/* StaleWhileRevalidate 1h
  - index.html: theme-color, background-color, description fa, apple-mobile-web-app-capable, apple-touch-icon, favicon, OG defaults, twitter card, noscript
  - src/pwa.ts: registerPWA, setupInstallPrompt (beforeinstallprompt), isStandalone, isOnline, online/offline events
  - src/main.tsx: registerPWA call
  - Offline: App Shell precache 36 entries ~1.7MB, API cache, offline.html fallback, detection via navigator.onLine, banners offline/update/install/outbox, Outbox pattern localStorage arep_outbox type create_property, sync button
  - Build: vite build success with sw.js, workbox-*.js, manifest.webmanifest, registerSW.js
- **Public Platform:**
  - Backend app/api/v1/public.py: router /public no auth, Public DTO only (no owner, no exact_address), _base_public_query status published is_deleted false no tenant filter, GET /public/properties with filters type/transaction/city/district/price/area/parking/elevator/rooms/q, GET /by-code/{code}, GET /{id}, GET /og/{code} HTMLResponse OG + JSON-LD RealEstateListing + redirect to SPA if not crawler
  - SEO: OG title/description/image/url, Twitter card, JSON-LD @type RealEstateListing, dynamic meta update in SPA public detail, Deep Links /p/{code} /d/{code} per بند 62
  - Frontend: api.ts publicListProperties/publicGetByCode/publicGetById + outbox helpers getOutbox/addToOutbox/removeFromOutbox/clearOutbox, App.tsx parsePublicPath /p/CODE /d/CODE, isPublicView public page without auth, loadPublic list 20, loadPublicDetail with dynamic OG meta, Public UI detail card + list published + /p/{code} link, authenticated tabs include public tab with OG HTML link, properties list shows /p/{code} link, deals shows /d/{code} link, PWA banners offline/update/install/outbox sync
  - Tests: 2 new — test_public_properties (published vs draft, list only published, by-code OK/draft 404, by-id OK, OG HTML og:title+ld+json, OG draft 404), test_public_search_filters (filter villa, q شمال) — total 42 passed
  - Docs: ADR-0013-pwa-public-platform, CURRENT_STATE.md, ROADMAP Phase 10+12 DONE

---

## [0.1.5] — 2026-09-21 — Deals & Commission

### Added — Phase 9 Deals & Commission (Sprint 6)
- **Models:** deals (code DL-YYMM-00001, code_period, code_sequence, title, status lead/qualification/property_match/visit/negotiation/agreement/closed_won/closed_lost/archived, customer_id FK persons RESTRICT required, property_id FK properties SET NULL nullable independent per بند39, agent_id FK users, amount, commission_total/agent/office/referral, commission_status pending/partially_paid/paid/cancelled, notes/loss_reason, TenantEntity + indexes), deal_status_history (deal_id FK CASCADE, from_status/to_status, changed_by, notes)
- **Code Generator:** DL-YYMM-00001 atomic via code_sequences scope deal, period YYMM UTC, sequence 5 digits — e.g. DL-2609-00001
- **Pipeline:** VALID_TRANSITIONS enforces Lead→Qualification→PropertyMatch→Visit→Negotiation→Agreement→Closed, closed_lost→lead reopen, archived terminal, History tracking 7 entries for full pipeline
- **Permissions:** deal:create/read/update/delete, commission:read/manage — added to ALL_PERMISSIONS and System Roles (ORG_ADMIN all, BRANCH_ADMIN all, AGENT create/read/update deal + read commission)
- **Services:** DealService (create with customer/property existence check, property optional per بند39, agent default current user, code gen, history on create, notification in_app important on create and status change critical for closed), list filters status/customer_id/property_id/agent_id/q, update with version optimistic locking + history, delete soft, get_history
- **API:** POST /deals, GET /deals (filters status/customer/property/agent/q), GET /deals/by-code/{code} Deep Link, GET /{id}, GET /{id}/history, PATCH /{id}, DELETE /{id}
- **Tests:** 3 new — test_deal_crud_and_pipeline (CRUD + pipeline + 7 history + notification + commission), test_deal_without_property (independent), test_deal_tenant_isolation (404) — total 40 passed
- **Migration:** 30be32e888f7_add_deals_and_commission (chain 5 migrations, upgrade head OK)
- **Frontend:** api.ts deals endpoints (listDeals, getDeal, getDealByCode, createDeal, updateDeal, getDealHistory), App.tsx 6 tabs (Properties/CRM/Visits/Deals/Favorites/Notifications), Deal Create Form, Pipeline badge, Next Stage button, History viewer, Commission display
- **Docs:** ADR-0012-deals-commission, CURRENT_STATE.md, ROADMAP Phase 9 DONE

---

## [0.1.4] — 2026-09-21 — Visits & Notifications

### Added — Phase 7-8 Visits & Notifications (Sprint 5)
- **Models:** visits (property_id, customer_id, agent_id, visit_date, visit_time, status scheduled/done/cancelled/no_show/rescheduled, notes, result), notifications (user_id, channel in_app/telegram/sms/push/email, priority critical/important/normal/informational, title, body, entity_type, entity_id, data_json, is_read, read_at)
- **Permissions:** visit:create/read/update/delete, notification:read/manage — added to ALL_PERMISSIONS and System Roles (ORG_ADMIN all, BRANCH_ADMIN all visits+notifs, AGENT create/read/update visits + read notifs)
- **Services:** VisitService (create with property+customer existence check, agent default current user, auto-create notification for agent in_app important per بند 41), NotificationService (create with priority/channel normalization, list per user with filters is_read/priority, mark_read, mark_all_read, unread_count, delete soft)
- **API:** /visits (POST, GET with filters property_id/customer_id/agent_id/status/date_from/to, GET/{id}, PATCH, DELETE), /notifications (GET with filters is_read/priority, GET/unread-count, POST/{id}/read, POST/read-all, DELETE/{id}, POST create admin)
- **Tests:** 3 new — test_visit_crud_and_notification (CRUD + auto notification + unread count + mark read), test_visit_tenant_isolation (404 per بند 48), test_notifications_priority_and_channels (critical/important/normal/informational per بند 82) — total 37 passed
- **Migration:** 84455b931380_add_visits_and_notifications (upgrade head OK)
- **Frontend:** api.ts updated with visits/notifications endpoints (listVisits, createVisit, listNotifications, getUnreadCount, markNotificationRead, markAllNotificationsRead), App.tsx updated with Tabs Properties/CRM/Visits/Favorites/Notifications, Visit Create Form (property_id, customer_id, date, time), Notification list with priority badges (critical red, important orange, normal blue, info gray), unread highlight, mark all read, unread count in header
- **Docs:** ADR-0011-visits-notifications, CURRENT_STATE.md updated, ROADMAP Phase 7-8 DONE

### Changed
- permissions.py: added visit and notification permissions, updated SYSTEM_ROLE_PERMISSIONS
- App.tsx: added 2 more tabs (visits, notifications), loadAll with Promise.all for all domains

---

## [0.1.3] — 2026-09-21 — CRM

### Added — Phase 6 CRM (Sprint 4)
- **Models:** persons (unique phone per org), person_roles (Mixed Roles per بند 34), customer_requests (بند 35), favorites (بند 36), saved_searches (بند 37 + matching)
- **Permissions:** customer:create/read/update/delete, customer_request:create/read/update, favorite:manage, saved_search:manage
- **Services:** PersonService (duplicate phone CUSTOMER_PHONE_TAKEN), CustomerRequestService, FavoriteService (idempotent), SavedSearchService (find_matches via PropertyService)
- **API:** /persons (CRUD + roles), /customer-requests (CRUD), /favorites (CRUD idempotent), /saved-searches (CRUD + /{id}/matches)
- **Tests:** 4 new — total 34 passed
- **Migration:** 0e898a633ce7_add_crm_domain
- **Frontend:** CRM tabs
- **Docs:** ADR-0010

### Changed
- permissions.py: added CRM permissions
- PersonRole soft-delete filtering in Service

### Fixed
- PersonRole remove_role filtering

---

## [0.1.2] — 2026-09-21 — Property Engine

### Added — Phase 5 Property Engine (Sprint 3)
- **Models:** properties, property_usages (Mixed Use), property_locations (Public vs Private), property_media
- **Code Generator:** AB-ISF-MJ-AP-S-2608-00124, period YYMM (2609), sequence 5 digits, atomic
- **Privacy:** Public DTO vs Internal DTO
- **Lifecycle:** draft, pending_review, approved, published, reserved, sold, rented, archived
- **Transaction:** sale, rent, exchange (flexible), partnership
- **Area:** land_area, built_area, useful_area, floor_area + rooms, bedrooms, etc.
- **Amenities:** has_parking, has_elevator, has_warehouse, has_balcony + amenities_json
- **API:** POST/GET/PATCH/DELETE /properties, GET by-code (Deep Link), structured search
- **Tests:** 3 new — total 30 passed
- **Migration:** 8d453b823210_add_property_domain
- **Frontend:** Property List + Create Form
- **Docs:** ADR-0009

---

## [0.1.1] — 2026-09-21 — Phase 0 Documentation

### Added — Phase 0 Documentation Debt
- PROJECT_CONSTITUTION.md, CURRENT_STATE.md, ARCHITECTURE.md, DATABASE.md, API_CONTRACT.md, UI_UX.md, ROADMAP.md, CHANGELOG.md, CONTRIBUTING.md
- docs/decisions/ADR-0001 تا ADR-0008 + README
- docs/architecture, docs/api, docs/database, docs/deployment, docs/security, docs/development skeletons
- 24 فایل مستندات

---

## [0.1.0] — 2026-09-18 — Sprint 1 Platform Core

### Added
- Config, Envelope, Telegram HMAC, JWT, Tenant Context, TenantRepository 404, RBAC, Org/Branch/Membership, Optimistic Locking, Soft Delete, Idempotency, Pagination, Migration 0001, CLI, Frontend Telegram Web App, Docker Compose UNVERIFIED, 28 tests, docs/DECISIONS.md
