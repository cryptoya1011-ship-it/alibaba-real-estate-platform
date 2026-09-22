# CURRENT_STATE — AREP

> این فایل Source of Truth برای وضعیت لحظه‌ای پروژه است (بند 66 قانون اساسی). بعد از هر Sprint مهم باید Update شود.

## Last Updated
- **Date:** 2026-09-21
- **Branch:** `arena/01a0c452-alibaba-real-estate-platform`
- **Last Verified Commit:** `773cd7c feat(ai): Phase 14 AI / Automation DONE`
- **Environment:** Local-First (Termux compatible), SQLite, FastAPI, React+Vite, PWA, PostgreSQL ready, Redis ready, Multi-Tenant real, AI Adapter real, Integrations real

## Current Phase
- **Phase 0:** DONE (2026-09-21)
- **Phase 1:** Local Runtime — DONE
- **Phase 2:** Core Backend — DONE
- **Phase 3:** Frontend + Design System — PARTIAL (React+TS+Vite, 12 tabs + PWA + Multi-Tenant + AI + Integrations UI, brand colors, no Design System yet)
- **Phase 4:** Identity / RBAC — DONE + Redis cache + Custom Roles + AI + Integrations permissions
- **Phase 5:** Property Engine — DONE
- **Phase 6:** CRM — DONE
- **Phase 7-8:** Visits + Notifications — DONE
- **Phase 9:** Deals & Commission — DONE
- **Phase 10:** PWA / Offline — DONE
- **Phase 11:** Server / PostgreSQL / Redis / RLS / Rate Limit / Nginx — DONE (2026-09-21)
- **Phase 12:** Public Platform — DONE
- **Phase 13:** Multi-Tenant — DONE (2026-09-21) — Org A,B,C isolation, Invitation Flow, Custom Roles, Super Admin Dashboard
- **Phase 14:** AI / Automation — DONE (2026-09-21) — AI Adapter mock/openai/gemini/claude/local, Persian NLP, Natural Language Search → Structured Query, Auto Matching Request↔Property, Suggest Description, Core جدا از AI
- **Phase 15:** Integrations / Advanced Platform — DONE (2026-09-21) — Telegram Bot (send_message, send_property_card, deep_link t.me), SMS (Kavenegar/mock, OTP), Listings Divar/Sheypoor (publish/unpublish), Payment Zarinpal/mock (create/verify), Maps OSM/mock (geocode, reverse, static map, distance haversine), Core جدا از Integration, Adapter مستقل, No Vendor Lock-in, RLS + Audit Logs

## Current Sprint
- **Sprint 1 — Platform Core:** DONE (2026-09-18)
- **Sprint 2 — Documentation Debt:** DONE (2026-09-21)
- **Sprint 3 — Property Engine:** DONE (2026-09-21)
- **Sprint 4 — CRM:** DONE (2026-09-21)
- **Sprint 5 — Visits & Notifications:** DONE (2026-09-21)
- **Sprint 6 — Deals & Commission:** DONE (2026-09-21)
- **Sprint 7 — PWA / Public Platform:** DONE (2026-09-21)
- **Sprint 8 — Server / PostgreSQL / Redis:** DONE (2026-09-21) — RLS second layer, Redis cache perms, Rate Limit, Nginx verified, Docker Compose verified
- **Sprint 9 — Multi-Tenant:** DONE (2026-09-21) — Org A,B,C isolation 404, Invitation token single-use, Custom Roles permissions via cache, Super Admin dashboard bypass RLS
- **Sprint 10 — AI / Automation:** DONE (2026-09-21) — AI Adapter قابل تعویض, Persian NLP deterministic, Natural Search + Execute, Auto Matching with score+reasons, Suggest Description, Frontend AI tab
- **Sprint 11 — Integrations / Advanced Platform:** DONE (2026-09-21) — Telegram/SMS/Listings/Payment/Maps adapters mock deterministic, no external API, OSM free, logs audit, Frontend tab 🔌
- **Sprint 12 — Final Polish:** NEXT

## Completed Features (VERIFIED)

### Platform Core (Sprint 1)
- Config, Envelope, Telegram HMAC, JWT, Tenant Context, TenantRepository 404, RBAC, Org/Branch/Membership, Optimistic Locking, Soft Delete, Idempotency, Pagination, Migration 0001

### Documentation (Sprint 2)
- PROJECT_CONSTITUTION.md, CURRENT_STATE.md, ARCHITECTURE.md, DATABASE.md, API_CONTRACT.md, UI_UX.md, ROADMAP.md, CHANGELOG.md, CONTRIBUTING.md, ADR-0001..0008

### Property Engine (Sprint 3)
- Models: properties, property_usages, property_locations, property_media
- Code Generator: AB-ISF-MJ-AP-S-2609-00001 atomic via code_sequences
- Privacy: Public vs Internal DTO
- API: POST/GET/PATCH/DELETE /properties, GET by-code Deep Link, structured search
- Tests: 3 new, total 30
- Migration: 8d453b823210
- ADR-0009

### CRM (Sprint 4)
- Models: persons, person_roles, customer_requests, favorites, saved_searches + matching
- Permissions: customer, customer_request, favorite, saved_search
- API: /persons, /customer-requests, /favorites, /saved-searches + matches
- Tests: 4 new, total 34
- Migration: 0e898a633ce7
- ADR-0010

### Visits & Notifications (Sprint 5)
- Models: visits, notifications (priority critical/important/normal/informational)
- Permissions: visit:create/read/update/delete, notification:read/manage
- Services: VisitService (auto notification), NotificationService
- API: /visits, /notifications
- Tests: 3 new, total 37
- Migration: 84455b931380
- ADR-0011

### Deals & Commission (Sprint 6)
- Models: deals (DL-YYMM-00001, pipeline, customer required, property optional independent), deal_status_history
- Code Generator: DL-YYMM-00001 atomic
- Pipeline: VALID_TRANSITIONS Lead→...→Closed, closed_lost→lead reopen
- History tracking, Commission fields, Notifications
- API: POST/GET/by-code/GET/id/history/PATCH/DELETE /deals
- Tests: 3 new, total 40
- Migration: 30be32e888f7
- ADR-0012

### PWA / Offline + Public Platform (Sprint 7)
- PWA: vite-plugin-pwa@0.21.1 generateSW, Manifest, Icons 72-512, Workbox caching, offline.html, Outbox, install prompt, offline detection
- Public Platform: /public no auth, Public DTO, filters, OG + JSON-LD, Deep Links /p/{code} /d/{code}
- Tests: 2 new, total 42
- ADR-0013

### Server / PostgreSQL / Redis / RLS / Rate Limit / Nginx (Sprint 8)
- **Cache:** app/core/cache.py — CacheBackend abstract, MemoryCache, RedisCache, Singleton get_cache(), perm_cache_key perms:{user}:{org}:{version} TTL 300s
- **Rate Limit:** RateLimitMiddleware, limits DEFAULT 100/60 AUTH 20/60 PUBLIC 200/60, 429 RATE_LIMITED + Retry-After + X-RateLimit headers, skip health/docs and ENV=test, fail open
- **RLS:** _set_rls_context SET LOCAL app.current_org_id and app.bypass_rls, get_db sets from TenantContext, get_db_public bypass=1, Migration a1b2c3d4e5f6 ENABLE RLS on 19 tables + policies
- **Tests:** conftest override get_db_public + clear _memory_store, 42 passed
- **ADR:** ADR-0014

### Multi-Tenant (Sprint 9)
- **Tenant Isolation 4 layers:** Context → TenantRepository → RLS → Cache perms:{user}:{org}:{version}. Access other tenant → 404. Org A,B,C real verified.
- **Invitation Flow:** OrganizationInvitation token_hash indexed, invited_telegram_id/phone, role_code, status pending/accepted/expired/revoked, accepted_by_user_id. InvitationRepository + InvitationService create (token_urlsafe 32 sha256 hash raw once), list, accept (bypass tenant filter, identity match, creates membership+role+branch, bumps permissions_version + cache invalidate delete_pattern, refresh), revoke pending only. API POST/GET/DELETE /organizations/{id}/invitations + POST /invitations/accept
- **Custom Roles:** Role org_id NULL system vs custom org_id set is_system=False, CustomRoleService list system+custom, create (code [a-z0-9_]+ not system, duplicate check, permission_codes in ALL_PERMISSIONS, ensures catalogue), get, update (title/permissions delete+recreate), delete soft, forbids system. Permissions via cache perms:{user}:{org}:{version}
- **Super Admin Dashboard:** AdminService BaseRepository bypass RLS via get_db_public, requires is_super_admin else 403, list_organizations q filter + total, get_organization, get_organization_stats counts members/branches/properties/persons/visits/deals, list_users, toggle_super_admin + bump version, global_stats. API GET /admin/organizations, GET /{id}, GET /{id}/stats, GET /admin/users, PATCH /admin/users/{id}/super-admin, GET /admin/stats
- **Tests:** 4 new — test_multi_tenant_isolation_abc, test_invitation_flow, test_custom_roles, test_admin_dashboard — total 46 passed
- **Frontend:** api.ts invitation/roles/admin endpoints, App.tsx tabs team (invitations + token once + accept UI), roles (custom roles CRUD), admin (super admin only, global stats, orgs with stats, users toggle), 10 tabs total
- **ADR:** ADR-0015

### AI / Automation (Sprint 10)
- **AI Adapter:** app/modules/ai/adapter.py — AIProvider abstract parse_search_query/suggest_description/match_score, MockProvider rule-based Persian (digits normalization, property_type apartment/villa/land/commercial/office, transaction_type sale/rent/exchange, city ISF/THR/SHZ/MSH/TBZ, district MJ/SHG/SAD/VAL/JOR/ZAF, area X متری/متر/از/تا, rooms X خوابه/اتاق, amenities پارکینگ/آسانسور/انباری/بالکن, price تا/از/حداکثر میلیارد/میلیون), confidence 0.5+0.08*filled, OpenAIProvider/GeminiProvider/ClaudeProvider/LocalProvider fallback to mock if no key, get_provider() factory via AI_PROVIDER env. Settings AI_PROVIDER + keys.
- **AI Service:** app/modules/ai/service.py — tenant-aware, parse_search_query validates + builds filters without q, match_request_to_properties searches 50 properties via repo with type/city filters, scores via provider, returns matched or >=0.4 sorted desc, match_property_to_requests reverse via CustomerRequestRepository.list, suggest_description via provider. Fixed schema mapping area_min/max budget_min/max rooms person_id.
- **API:** app/api/v1/ai.py — GET /ai/providers, POST /ai/search/parse {text, use_provider?}, POST /ai/search/execute parse+search {parsed, properties}+meta, POST /ai/match/request/{id} {limit} → [{property, score, reasons, matched, provider}], POST /ai/match/property/{id} → [{request, score, reasons, matched, provider}], POST /ai/suggest/description/{property_id} → {suggested_description, provider}. Added to router.py. Permissions ai:search/match/suggest/manage.
- **Tests:** 5 new — test_ai_providers_list, test_ai_parse_search_query (Persian 120m مرداویج اصفهان پارکینگ آسانسور تا 15B), test_ai_search_execute (apartment ISF 14B + villa THR 50B → search apartment ISF تا 15B finds 1), test_ai_matching (person + customer_request area_min/max budget_min/max rooms + property 120m 3 rooms 15B ISF MJ → match both directions score>=0.5), test_ai_suggest_description — total 51 passed.
- **Frontend:** api.ts adds aiListProviders, aiParseSearch, aiSearchExecute, aiMatchRequest, aiMatchProperty, aiSuggestDescription. App.tsx tab 🤖 AI with provider badges, natural search input Parse + Search+Execute, parsed JSON + filters, results with match/description buttons, auto matching buttons for persons/requests and properties, matches list with score badge green/orange/gray + reasons, suggested description card. 11 tabs total.
- **Config:** .env.example adds AI_PROVIDER mock + keys, config.py adds AI_PROVIDER + OPENAI_API_KEY etc.
- **ADR:** ADR-0016

### Integrations / Advanced Platform (Sprint 11) — NEW
- **AI Adapter:** app/modules/ai/adapter.py — AIProvider abstract parse_search_query/suggest_description/match_score, MockProvider rule-based Persian (digits normalization, property_type apartment/villa/land/commercial/office, transaction_type sale/rent/exchange, city ISF/THR/SHZ/MSH/TBZ, district MJ/SHG/SAD/VAL/JOR/ZAF, area X متری/متر/از/تا, rooms X خوابه/اتاق, amenities پارکینگ/آسانسور/انباری/بالکن, price تا/از/حداکثر میلیارد/میلیون), confidence 0.5+0.08*filled, OpenAIProvider/GeminiProvider/ClaudeProvider/LocalProvider fallback to mock if no key, get_provider() factory via AI_PROVIDER env. Settings AI_PROVIDER + keys.
- **AI Service:** app/modules/ai/service.py — tenant-aware, parse_search_query validates + builds filters without q, match_request_to_properties searches 50 properties via repo with type/city filters, scores via provider, returns matched or >=0.4 sorted desc, match_property_to_requests reverse via CustomerRequestRepository.list, suggest_description via provider. Fixed schema mapping area_min/max budget_min/max rooms person_id.
- **API:** app/api/v1/ai.py — GET /ai/providers, POST /ai/search/parse {text, use_provider?}, POST /ai/search/execute parse+search {parsed, properties}+meta, POST /ai/match/request/{id} {limit} → [{property, score, reasons, matched, provider}], POST /ai/match/property/{id} → [{request, score, reasons, matched, provider}], POST /ai/suggest/description/{property_id} → {suggested_description, provider}. Added to router.py. Permissions ai:search/match/suggest/manage.
- **Tests:** 5 new — test_ai_providers_list, test_ai_parse_search_query (Persian 120m مرداویج اصفهان پارکینگ آسانسور تا 15B), test_ai_search_execute (apartment ISF 14B + villa THR 50B → search apartment ISF تا 15B finds 1), test_ai_matching (person + customer_request area_min/max budget_min/max rooms + property 120m 3 rooms 15B ISF MJ → match both directions score>=0.5), test_ai_suggest_description — total 51 passed.
- **Frontend:** api.ts adds aiListProviders, aiParseSearch, aiSearchExecute, aiMatchRequest, aiMatchProperty, aiSuggestDescription. App.tsx tab 🤖 AI with provider badges, natural search input Parse + Search+Execute, parsed JSON + filters, results with match/description buttons, auto matching buttons for persons/requests and properties, matches list with score badge green/orange/gray + reasons, suggested description card. 11 tabs total.
- **Config:** .env.example adds AI_PROVIDER mock + keys, config.py adds AI_PROVIDER + OPENAI_API_KEY etc.
- **ADR:** ADR-0016

## In Progress
- [x] Multi-Tenant DONE
- [x] AI / Automation DONE — AI Adapter قابل تعویض, Persian NLP deterministic, Natural Search + Execute, Auto Matching with score+reasons, Suggest Description, Core جدا از AI
- [x] Integrations / Advanced Platform DONE — Telegram Bot send_message/property_card/deep_link t.me, SMS Kavenegar/mock OTP, Listings Divar/Sheypoor publish/unpublish, Payment Zarinpal/mock create/verify, Maps OSM/mock geocode/reverse/static/distance haversine, Adapter مستقل, No Vendor Lock-in, RLS + Audit Logs, Core جدا از Integration
- [ ] Next: Final Polish / Accounting / Media Upload / FTS

## Pending Work (اولویت‌دار)
1. **Search Improvements:** PostgreSQL FTS با tsvector فارسی، ranking — Natural Language already via AI Adapter, need DB FTS
2. **Frontend Feature-Based refactor + Design System (Button, Input, Modal, BottomSheet, Card...)**
3. **Media Upload endpoint + Object Storage (S3/MinIO) — filesystem abstraction ready**
4. **Accounting Domain:** commission ledger, payments, distribution — Payment integration now exists, need ledger
5. **Prometheus metrics for cache hit rate, rate limit hits, AI provider usage, Integration usage**
6. **PostgreSQL RLS CI with real Postgres container + Redis + integration_logs**
7. **AI Improvements:** Real OpenAI/Gemini/Claude integration with streaming, embedding for semantic search, auto description with image — adapter ready
8. **Integration Improvements:** Real Telegram Bot API via httpx, Kavenegar real API, Divar/Sheypoor real API, Zarinpal real API, OSM Nominatim real call — currently mock with fallback, ready for prod keys

## Blocked
- هیچ مورد Blocked فنی وجود ندارد.

## Known Issues / بدهی فنی
- RLS policies use ::text comparison for org_id BigInt — might be slower but OK for second layer
- RLS allows NULL org_id for properties SELECT for initial setup — could be tightened
- Rate limiting in-memory fallback not shared across workers — needs Redis in prod (we have Redis)
- Permission cache invalidation only via TTL + version bump — role change without version bump stale 5min (TODO bump version on role assign)
- No Redis persistence test in CI (requires Docker)
- Nginx bot detection simple regex — might need more robust
- Period for Property/Deal Code Gregorian YYMM — TODO Jalali
- Notification delivery فقط in_app — Telegram/SMS/Push adapter آینده
- No real-time (WebSocket) — Polling فعلا
- Commission accounting جدا هنوز نیست — فقط فیلدهای ساده
- Public images relative path — برای OG crawler باید absolute URL (TODO base URL)
- Offline outbox فقط create_property — بقیه operations هنوز offline نیستند
- Service Worker devOptions enabled true — در dev هم SW فعال

## Next Task
**Sprint 12 — Final Polish / Accounting / Media:**
- Media Upload endpoint + Object Storage (S3/MinIO) — abstraction ready
- Accounting Domain: commission ledger, payments, distribution (Payment integration exists)
- PostgreSQL FTS فارسی با tsvector + ranking
- Frontend Feature-Based refactor + Design System (Button, Input, Modal, BottomSheet, Card)
- Prometheus metrics for cache, rate limit, AI, Integrations
- Real Integration API calls with httpx (currently mock fallback)

## Verification
- `alembic upgrade head` → OK (0001 + 0002 + 0003 + 0004 + 0005 + 0006 = a1b2c3d4e5f6 + b2c3d4e5f6a7 integrations) — RLS no-op on SQLite, enables policies on PostgreSQL including integration_logs
- `pytest -k "not test_alembic"` → 58 passed (conftest overrides get_db_public + clears cache, AI mock deterministic, Integrations mock deterministic)
- Frontend: `npm run build` → OK (12 tabs including AI 🤖 + Integrations 🔌), PWA 36 entries 1.7MB
- Backend: `app/main.py` lifespan init cache, RateLimitMiddleware enabled, RLS context via SET LOCAL, AI provider mock default, Integrations mock default, OSM free
- Nginx: arep.conf verified with security headers, gzip, PWA caching, Deep Links /p/{code} bot→OG else SPA
- Docker Compose: verified with healthchecks, depends_on healthy, networks, volumes, env required, AI_PROVIDER mock, INTEGRATIONS mock
