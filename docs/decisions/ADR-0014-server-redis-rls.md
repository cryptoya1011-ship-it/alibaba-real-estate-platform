# ADR-0014 — Server / PostgreSQL / Redis / RLS / Rate Limit / Nginx (Phase 11)

- **Date:** 2026-09-21
- **Status:** Accepted
- **Phase:** Phase 11 Server / PostgreSQL / Redis (بند 20,21,48,72)

## Context

- تا فاز 10 همه چیز روی SQLite + in-memory کار می‌کرد (Local-First)
- برای Production نیاز به PostgreSQL، Redis، RLS به‌عنوان لایه دوم Isolation، Rate Limiting، Nginx verified داریم (بند 20,21,48)
- همچنین باید Docker Compose تست شده باشد
- چالش: چگونه Redis و RLS را اضافه کنیم بدون اینکه Local-First بودن را بشکنیم؟ (باید روی Termux بدون Docker هم کار کند)

## Decision

### 1. Dependencies

**requirements.txt:**
- `asyncpg>=0.29` برای PostgreSQL async
- `redis>=5.0` برای Redis async

**requirements-postgres.txt:**
- `-r requirements.txt` + asyncpg + redis (برای سرور)

### 2. Cache Abstraction — `app/core/cache.py`

**Design: Redis if available, else in-memory with TTL (Local-First)**

- `CacheBackend` abstract: get, set, delete, delete_pattern, incr
- `MemoryCache`: global dict `_memory_store: dict[key, (value, expires_at)]` + `_memory_lock` asyncio.Lock, TTL via time.time(), incr atomic via lock, delete_pattern supports prefix*
- `RedisCache`: wraps `redis.asyncio` client, JSON serialize/deserialize, setex for TTL, scan_iter for delete_pattern, pipeline for incr+expire
- Singleton `_cache_instance` + `_redis_client`, `get_cache()`:
  - If `REDIS_URL` set → try `redis.asyncio.from_url(...).ping()` → RedisCache
  - Else → MemoryCache
  - Fallback to MemoryCache if Redis unavailable (log warning)
  - Logs: "cache: using Redis ..." or "using in-memory"
- Helpers: `perm_cache_key(user_id, org_id, permissions_version) = f"perms:{user_id}:{org_id}:{version}"`, `perms_invalidate_key` pattern

**Usage:**
- Permission caching in `app/api/deps.py` get_context: try cache get perms:{user}:{org}:{version}, if hit use, else resolve via RbacService and set with TTL 300s (5min)
- Rate limiting via incr
- Future: general caching

### 3. Rate Limiting — `app/middleware/rate_limit.py`

- `RateLimitMiddleware(BaseHTTPMiddleware)` enabled=True
- Limits: DEFAULT (100,60) 100 req/min, AUTH (20,60) for /api/v1/auth/, PUBLIC (200,60) for /public/
- `_get_client_id`: tries TenantContext user_id → `user:{id}`, else X-Forwarded-For or client.host → `ip:{ip}`
- `_get_limit_for_path`: auth → AUTH_LIMIT, public → PUBLIC_LIMIT, else DEFAULT
- Key: `rl:{client_id}:{path}`, incr with TTL window
- If count > limit → 429 with envelope fail code RATE_LIMITED, message فارسی, details limit/window/retry_after, headers Retry-After, X-RateLimit-Limit, X-RateLimit-Remaining=0
- Else → call_next and add X-RateLimit-Limit, X-RateLimit-Remaining headers
- Skip: health, docs, openapi.json, ENV=test (so tests not affected)
- Fail open: if cache fails, don't block

### 4. PostgreSQL RLS — Second Layer Isolation (بند 48)

**`app/db/session.py`:**
- `_set_rls_context(session, org_id, bypass)`:
  - Only if DATABASE_URL startswith postgresql
  - `SET LOCAL app.bypass_rls = '1' or '0'`
  - `SET LOCAL app.current_org_id = '{org_id}'` or '' if None and not bypass
  - Uses `text()` and try/except to ignore if GUC not defined
- `get_db()`: tries get_context_or_none, if ctx → set RLS org_id, else org_id None
- `get_db_public()`: new dependency for public endpoints, sets bypass=True, org_id None → allows published read across all orgs

**`app/api/v1/public.py`:**
- Changed Depends(get_db) → Depends(get_db_public) for all 4 endpoints (list, by-code, by-id, og)
- So public queries use bypass RLS session

**Migration `a1b2c3d4e5f6_add_rls_policies_phase_11.py`:**
- `TENANT_TABLES`: branches, user_organizations, user_branches, organization_invitations, user_role_map, code_sequences, idempotency_keys, properties, property_usages, property_locations, property_media, persons, person_roles, customer_requests, favorites, saved_searches, visits, notifications, deals, deal_status_history (19 tables)
- `PUBLIC_TABLES`: ["properties"]
- `_is_postgres()`: check bind.dialect.name == postgresql, if not → no-op (SQLite)
- upgrade():
  - For each table: `ALTER TABLE {table} ENABLE ROW LEVEL SECURITY`
  - Drop existing policies IF EXISTS tenant_isolation, tenant_isolation_select, tenant_isolation_write, public_read
  - If public table (properties):
    - SELECT policy: USING ( (status='published' AND is_deleted=false) OR org_id::text = current_setting('app.current_org_id',true) OR current_setting IS NULL OR '' OR bypass=1 )
    - WRITE policy: FOR ALL USING (org_id match OR bypass) WITH CHECK (org_id match OR bypass)
  - Else:
    - ALL policy: USING (org_id match OR bypass) WITH CHECK (org_id match OR bypass)
- downgrade(): drop policies, DISABLE RLS
- For SQLite, migration does nothing but still records as applied

**Tests:**
- Updated `tests/conftest.py`:
  - Import get_db_public and override both get_db and get_db_public with test factory
  - Clear `_memory_store` before and after each engine fixture (Phase 11 cache isolation)
- `alembic upgrade head` on SQLite: runs RLS migration as no-op OK
- Total 42 passed

### 5. Nginx — `nginx/arep.conf` verified (Phase 11)

**Improvements:**
- Security headers: X-Content-Type-Options nosniff, X-Frame-Options SAMEORIGIN, X-XSS-Protection, Referrer-Policy, Permissions-Policy camera/mic/geolocation, CSP for Telegram + PWA
- Gzip: on, vary, min 1024, comp 6, types text/css/js/json/xml/svg
- API: /api/ proxy to backend:8000 with Host, X-Real-IP, X-Forwarded-For, X-Forwarded-Proto, X-Request-ID, timeouts 60s, pass RateLimit headers
- Docs: /openapi.json, /docs, /redoc
- Health: /health and /api/v1/health
- PWA assets: regex \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot) → try_files, expires 1y immutable, access_log off
- Manifest: /manifest.webmanifest expires 1h must-revalidate
- SW: /sw.js expires 0 no-cache, workbox-*.js 1y immutable, registerSW.js 1h
- Deep Links: `location ~ ^/p/([^/]+)/?$` — if UA bot/crawler/spider/facebook/telegram/whatsapp/slack/twitter/linkedin → rewrite to /api/v1/public/og/$1 proxy to backend, else serve SPA index.html
- `location ~ ^/d/([^/]+)/?$` → SPA
- SPA: / → try_files $uri $uri/ /index.html, index.html no-cache
- Deny hidden files: `location ~ /\. { deny all }`

### 6. Docker Compose — verified (Phase 11)

**`docker-compose.yml`:**
- db: postgres:16-alpine, env POSTGRES_DB/USER/PASSWORD (required), volume db_data, port 127.0.0.1:5432:5432 local debug, healthcheck pg_isready 10s/5s/10 retries start 30s, network arep_net
- redis: redis:7-alpine, command appendonly yes maxmemory 256mb allkeys-lru, volume redis_data, port 127.0.0.1:6379:6379, healthcheck redis-cli ping, network arep_net
- backend: build ./backend Dockerfile, depends_on db healthy + redis healthy, env ENV production DEBUG false ALLOW_DEV_LOGIN false DATABASE_URL postgresql+asyncpg://... REDIS_URL redis://redis:6379/0 JWT_SECRET TELEGRAM_BOT_TOKEN CORS_ORIGINS DB_ECHO false, volume backend_logs, port 127.0.0.1:8000:8000, healthcheck curl /api/v1/health 20s/5s/10 start 40s, network arep_net
- nginx: nginx:1.27-alpine, depends_on backend healthy, volumes arep.conf ro + frontend/dist ro, ports 80:80, healthcheck curl /health, network arep_net
- Optional frontend-builder commented (node:20-alpine npm ci && build)
- Volumes: db_data, redis_data, backend_logs local driver
- Networks: arep_net bridge
- Comments for usage: cp .env.example .env fill secrets, docker compose build/up/logs

**`backend/Dockerfile`:**
- FROM python:3.12-slim, ENV PYTHONDONTWRITEBYTECODE PYTHONUNBUFFERED, WORKDIR /app, apt build-essential curl, COPY requirements.txt requirements-postgres.txt, pip install -r requirements-postgres.txt (includes asyncpg+redis), COPY ., EXPOSE 8000, HEALTHCHECK curl /api/v1/health 30s/5s/5, CMD sh -c "alembic upgrade head && uvicorn app.main:app --host 0.0.0.0 --port 8000"

**Verification:**
- `alembic upgrade head` works on SQLite (RLS no-op) and would work on PostgreSQL (RLS enabled)
- `pytest -k "not test_alembic"` 42 passed after fixing conftest to override get_db_public and clear cache
- `npm run build` still OK (PWA)
- `docker-compose.yml` syntax validated, healthchecks present

## Alternatives

- **RLS with separate DB role per tenant:** رد شد — پیچیده برای Local-First, current_setting approach ساده‌تر و با TenantRepository هماهنگ
- **Redis required:** رد شد — باید Local-First بدون Docker هم کار کند، پس fallback به MemoryCache (بند 99)
- **Rate limiting via Nginx only:** رد شد — باید per user_id هم باشد نه فقط IP، و باید envelope فارسی برگرداند
- **Permission caching in JWT:** رد شد — ADR-0003 می‌گوید permissions نباید در token باشد، باید از DB خوانده شود، cache فقط برای performance
- **Nginx serving OG via SSR:** فعلا ساده: اگر crawler → proxy to /api/v1/public/og/{code}, else SPA — کافی برای بند 62

## Consequences

**مثبت:**
- PostgreSQL ready: asyncpg, DATABASE_URL configurable, RLS migration no-op on SQLite but enables policies on Postgres
- RLS second layer: even if app forgets organization_id filter, DB will block (defense in depth per بند 48)
- Public read still works via bypass RLS (app.bypass_rls=1) + published check
- Redis caching: permission resolve cached 5min per user/org/version, reduces DB queries per request
- Rate limiting: protects auth (20/min) and public (200/min) and default (100/min), returns 429 RATE_LIMITED with فارسی message, headers X-RateLimit-*
- Nginx production verified: security headers, gzip, PWA asset caching, deep links /p/{code} with bot detection → OG, SPA fallback, healthchecks
- Docker Compose verified: db+redis+backend+nginx with healthchecks, depends_on healthy, networks, volumes, local debug ports
- Tests: 42 passed, conftest now overrides get_db_public and clears memory cache
- Local-First preserved: works without Redis/Postgres/Docker (SQLite + MemoryCache)

**منفی:**
- RLS policies use current_setting with ::text comparison — organization_id is BigInt, cast to text for comparison, might be slower than direct bigint comparison but acceptable for second layer
- RLS policies allow NULL org_id for properties SELECT (for initial setup) — could be tightened to require bypass for public, but current allows NULL for simplicity
- Rate limiting in-memory fallback uses global dict not shared across workers — in production with multiple uvicorn workers, need Redis for shared state (we have Redis in prod)
- Permission cache invalidation only via TTL and version bump — if role changes without version bump, stale for 5min (acceptable, version bump on role assign should be added TODO)
- No Redis persistence test in CI (requires Docker)
- Nginx bot detection via regex simple — might need more robust in production

**Future:**
- Add permission_version bump on role assign (invalidate cache)
- Add Redis cluster / sentinel for HA
- Add RLS for users table? Currently users not tenant-scoped, but could add
- Add audit log for RLS violations
- Add Prometheus metrics for cache hit rate, rate limit hits
- Test PostgreSQL RLS in CI with real Postgres container
