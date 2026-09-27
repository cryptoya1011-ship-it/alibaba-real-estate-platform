# CURRENT_STATE — AREP

> این فایل Source of Truth برای وضعیت لحظه‌ای پروژه است (بند 66 قانون اساسی). بعد از هر Sprint مهم باید Update شود.

## Last Updated
- **Date:** 2026-09-27
- **Branch:** `arena/01a0d354-alibaba-real-estate-platform`
- **Last Verified Commit:** Sprint 0 (Business Source of Truth) — see `git log`
- **Environment:** Local-First (Termux compatible), SQLite, FastAPI, React+Vite, PWA, PostgreSQL ready, Redis ready, Multi-Tenant real
- **منبع قوانین:** `docs/BUSINESS_RULES.md` · **مشخصات عملکردی:** `docs/FUNCTIONAL_SPECIFICATION.md`

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
- **UI Redesign** (`docs/UI_REDESIGN_NOTES.md`): DONE
- **Sprint 0 (Business Source of Truth) — Brand + Honest Integrations + Approval + Commission + Invitation expiry:** DONE (2026-09-27)
- **Sprint 1 — Request ownership, Follow-ups, Visit statuses, Audit Log:** NEXT

## Completed Features (VERIFIED)

### Sprint 0 — 2026-09-27
- رنگ برند آبی نفتی `#1B3A5C` + طلایی `#C9A84C` (ADR-0018).
- اتصال‌های صادق: حالت `live/test/unavailable` برای هر سرویس؛ تلگرام واقعی (`getMe`, `sendMessage`) + `POST /integrations/telegram/validate`؛ Nominatim واقعی؛ کاوه‌نگار/زرین‌پال/دیوار/شیپور → 503 «پیاده‌سازی نشده»؛ کلاس‌های جعلی LLM حذف؛ `use_provider` دیگر تنظیم سراسری را عوض نمی‌کند (ADR-0019).
- تأیید ملک: `property:approve`، وضعیت‌های `changes_requested/rejected`، `POST /properties/{id}/review`، اعلان به ثبت‌کننده، ستون‌های `approved_by/approved_at/review_note` (ADR-0020).
- کمیسیون: فقط `commission:manage` تعیین/تغییر؛ مشاور `commission:read`؛ ماسک مبلغ برای بدون‌مجوز.
- نقش‌های سیستمی `manager` و `observer`؛ همگام‌سازی نقش‌ها و مجوزها در شروع برنامه.
- انقضای دعوت‌نامه (`expires_at`، ۱ تا ۳۰ روز، پیش‌فرض ۷).
- Migration `c3d4e5f6a7b8` (upgrade/downgrade تست شد).

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
- [x] Sprint 0 — DONE
- [ ] Sprint 1 — درخواست: مشاور مسئول، Claim ایمن، سابقهٔ واگذاری، مهلت، اقدام بعدی، پیگیری‌ها، فهرست بی‌مسئول/عقب‌افتاده؛ بازدید: وضعیت‌های نهایی + تاریخچه + انتخابگر شمسی؛ جدول عمومی `audit_logs`

## Pending Work (اولویت‌دار — ترتیب مالک P1..P6)
1. **P1 هستهٔ عملیاتی:** Sprint 1 (بالا) + یادآوری روزانه و ارجاع به مدیر + درخواست بازدید عمومی ← CRM.
2. **P2 معاملات:** انواع معامله (فروش/اجاره/مشارکت/معاوضه) با فیلدهای خاص؛ اعمال قوانین انتقال مرحله در سرور.
3. **P3 مالی:** موتور قوانین کمیسیون (نسخه‌دار، اختصاصی مشاور، تاریخ اجرا، Audit)؛ دفتر کمیسیون.
4. **P4 مدیریت:** جلسات مدیر، اطلاعیه‌ها، گزارش‌ها، داشبورد عمل‌محور.
5. **P5 اتصال‌ها:** Web Push واقعی، اعلان تلگرام، پیامک/پرداخت واقعی (با مستندات رسمی).
6. **P6 پلتفرم:** Rate limit روی Redis، FTS فارسی، قالب نهایی کد ملک (ADR-0021)، RLS FORCE.

## Blocked
- هیچ مورد Blocked فنی وجود ندارد.

## Known Issues / بدهی فنی
- RLS policies use ::text comparison for org_id BigInt; `FORCE ROW LEVEL SECURITY` فعال نیست (مالک جدول از RLS عبور می‌کند).
- Rate limiting in-memory — برای چند worker نیاز به Redis.
- Period کد ملک/معامله میلادی `YYMM` — شمسی معوق (ADR-0021).
- اعلان فقط درون‌برنامه — تلگرام/Push آینده.
- قوانین انتقال مرحلهٔ معامله (`ALLOWED_TRANSITIONS`) در سرور اعمال نمی‌شود.
- Audit Log عمومی وجود ندارد؛ حذف عضویت فقط در لاگ برنامه ثبت می‌شود (ADR-0022).
- Offline outbox فقط ثبت ملک.
- ملک‌های منتشرشده قبل از Sprint 0 `approved_by` ندارند (تغییری در رفتار ایجاد نمی‌کند).

## Next Task
**Sprint 1** — به `docs/BUSINESS_RULES.md` §۴ و §۵ و §۱.۴ مراجعه شود.

## Verification
- `alembic upgrade head` → OK تا `c3d4e5f6a7b8` (downgrade -1 و upgrade دوباره تست شد).
- `pytest` → **73 passed** (۷ تست جدید `tests/test_sprint0.py`؛ همهٔ ارائه‌دهنده‌ها در تست روی mock قفل‌اند).
- Frontend: `tsc -b && vite build` → OK.
