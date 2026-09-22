# ARCHITECTURE — AREP

## 1. Vision معماری

AREP یک **Modular Monolith, API-First, Local-First, PWA-First, Multi-Tenant Ready** است.

هدف نهایی: یک Codebase که روی Android (Termux), iOS (PWA), Desktop Browser, و Server (PostgreSQL) بدون تغییر Business Logic اجرا شود.

```
                 AREP
                   │
           Application Core
                   │
          ┌────────┴────────┐
          │                 │
      Local Runtime      Cloud Runtime
          │                 │
        SQLite          PostgreSQL
          │                 │
       Android           Server
          │                 │
          └────────┬────────┘
                   │
             React + PWA
                   │
       ┌───────────┼───────────┐
       │           │           │
   Telegram       AI       Notifications
   Adapter       Adapter       Adapter
```

## 2. اصول کلیدی

- **API-first:** Frontend و Telegram Bot فقط Consumer هستند؛ هیچ Business Logic در آنها نیست.
- **Modular Monolith:** در فاز اول Microservices ممنوع (ADR-001). هر Domain مرز واضح دارد و قابلیت جدا شدن دارد.
- **Clean Architecture:** API → Service → Repository → Infrastructure. Business Logic فقط در Service Layer.
- **Local-first:** SQLite پیش‌فرض, بدون نیاز به Docker روی Android.
- **PWA-first:** یک Codebase برای Android/iOS/Desktop.
- **Multi-tenant ready:** Tenant Isolation در 4 لایه (فعلا Repository, بعدا RLS).
- **AI-ready / Event-ready:** Adapter Pattern, Domain Events قابل اضافه شدن.

## 3. ساختار Backend

```
backend/
├── app/
│   ├── core/               # config, security (Telegram HMAC + JWT), tenant context, permissions, errors, envelope, idempotency, logging
│   ├── db/                 # Base, mixins (BaseEntity/TenantEntity), types (BigInt), session, system_models, models_registry
│   ├── middleware/         # RequestContext (request-id, tenant), ErrorHandler
│   ├── modules/
│   │   ├── auth/           # Telegram login, dev-login, select-organization, schemas, service
│   │   ├── users/          # User entity (global identity)
│   │   ├── organizations/  # Organization, Branch, Membership, Invitation
│   │   ├── rbac/           # Role, Permission, RolePermission, UserRole, service
│   │   ├── properties/     # TODO Phase 5
│   │   ├── crm/            # TODO Phase 6
│   │   ├── visits/         # TODO Phase 8
│   │   ├── deals/          # TODO Phase 9
│   │   └── notifications/  # TODO Phase 8
│   ├── repositories/       # BaseRepository (soft-delete aware) + TenantRepository (org filter)
│   ├── api/v1/             # router, deps (auth context, permission guard, pagination, idempotency), endpoints
│   ├── main.py             # FastAPI factory, CORS, middleware
│   └── cli.py              # seed, status, make-super-admin
├── migrations/             # Alembic, render_as_batch برای SQLite
└── tests/                  # pytest, isolated SQLite
```

### 3.1 لایه‌ها

**API Layer:** FastAPI routers, Pydantic schemas, فقط validation و فراخوانی Service. هیچ Query مستقیم.

**Service Layer:** Business Logic, Transaction Management, Event Emission (آینده). به Repository وابسته است نه به DB مستقیم.

**Repository Layer:** `BaseRepository` و `TenantRepository`. فیلتر `organization_id` و `is_deleted` مرکزی. `organization_id` فقط از `current_context()` می‌آید نه از ورودی کاربر.

**Infrastructure:** SQLAlchemy async, Alembic, Filesystem Media (آینده Object Storage).

## 4. Frontend Architecture (وضعیت فعلی و هدف)

**وضعیت فعلی:**
- React 18 + TypeScript + Vite
- `src/App.tsx`, `api.ts`, `telegram.ts` ساده
- Telegram Web App integration

**هدف طبق قانون اساسی (بند 10):**

```
frontend/src/
├── app/                    # router, providers, layout
├── features/
│   ├── auth/
│   ├── properties/
│   ├── customers/
│   ├── visits/
│   ├── deals/
│   ├── notifications/
│   ├── search/
│   ├── favorites/
│   └── settings/
├── shared/
│   ├── ui/                 # Design System: Button, Input, Modal, BottomSheet, Card, etc.
│   ├── forms/
│   ├── hooks/
│   ├── utils/
│   ├── types/
│   └── services/
└── styles/                 # Tailwind یا CSS Modules + RTL
```

هر Feature مستقل, دارای api, hooks, components, types خودش.

## 5. Multi-Tenancy

**Tenant فعلی:** Alibaba (سازمان پیش‌فرض)

**Isolation:**
- **API:** `get_tenant_context()` اجباری برای endpointهای Tenant-scoped
- **Service:** `current_context().require_organization()` 
- **Repository:** `TenantRepository._base_select()` فیلتر `organization_id` خودکار
- **Database (آینده):** PostgreSQL RLS به‌عنوان لایه دوم (ADR-002)

**Security Rule:** دسترسی به Tenant دیگر → 404 نه 403 (عدم افشای وجود منبع).

**Organization Model:**
- Organization (id, slug unique, city_code, phone)
- Branch (organization_id, code unique per org, is_main)
- UserOrganization (membership, is_owner, is_active)
- UserBranch (چند شعبه‌ای)

## 6. Identity & Auth

**Authentication Providers:**
- Telegram Web App: HMAC-SHA256 روی initData (بند 44). `auth_date` چک می‌شود.
- Dev Login: فقط وقتی `ALLOW_DEV_LOGIN=true` (غیرفعال در Production)
- آینده: Phone OTP, OAuth

**JWT:**
- Claims: `user_id, organization_id, branch_id, roles, permissions_version, session_id, iat, exp, iss`
- `permissions_version` در User ذخیره می‌شود؛ افزایش آن تمام Tokenهای قبلی را باطل می‌کند (ADR-003)
- Permissions داخل JWT نیست؛ هر Request از DB resolve می‌شود (قابل Cache با Redis آینده)

**RBAC:**
- Permissions granular: `property:create, property:read, property:address:read, ...`
- Roles: `super_admin, system_admin, organization_admin, branch_admin, agent`
- System Role → Permissions mapping در `core/permissions.py`

## 7. Base Entity & Cross-Cutting

**BaseEntity:** `id, created_at, updated_at, created_by, updated_by, is_deleted, deleted_at, deleted_by, version`

**TenantEntity:** + `organization_id, branch_id`

- Soft Delete: هیچ Delete فیزیکی
- Optimistic Locking: `version` روی هر Update چک می‌شود → `VERSION_CONFLICT`
- Audit: `created_by/updated_by/deleted_by` از TenantContext
- Idempotency: جدول `idempotency_keys` با `(organization_id, endpoint, key)` unique

## 8. Property Domain (طراحی آینده - Phase 5)

**Layered Model (بند 22):**
- Property Core (id, code, title, description, status)
- Usage (چندتایی: Residential, Commercial, etc.) — جدول جدا
- Physical (area types, rooms, floor, etc.)
- Location (city, district, controlled public location, exact private address)
- Financial (price, rent, exchange flexible)
- Transaction (Sale, Rent, Exchange, Partnership)
- Media (images, videos, docs) با abstraction
- Legal
- Extended Attributes (JSONB در آینده)

**Property Code:** `AB-ISF-MJ-AP-S-2608-00124` — فرمت در Service, شمارنده در `code_sequences` (ADR-007)

**Privacy:** Public DTO جدا از Internal DTO. آدرس دقیق و شماره مالک هرگز در Public نیست (بند 61).

## 9. Event Architecture (آینده)

فعلا Event Bus کامل نیست اما Domain Events آماده:

- PropertyCreated, PropertyApproved, VisitScheduled, DealClosed, PermissionChanged

در آینده Outbox Pattern برای Local Sync:

```
Local Change → Outbox / Sync Queue → Internet → Server Sync → Conflict Resolution
```

## 10. PWA & Offline (بند 57)

**هدف:**
- Manifest (name, icons, theme_color #1B3A5C, background #F5F5F5, RTL, Persian)
- Service Worker (Workbox یا Vite PWA plugin): App Shell caching, API caching strategy
- Installability
- Update Strategy
- Offline: App Shell + Cached UI → بعدا Offline Property Creation + Sync

**وضعیت فعلی:** ندارد — در Phase 10 پیاده می‌شود.

## 11. Performance & Scalability

- Fast by default: Lazy Loading, Code Splitting, Pagination (offset فعلا, cursor آماده), Efficient Queries, Image Optimization, Debounced Search
- No premature optimization: از Elasticsearch/Kafka/Kubernetes در روز اول استفاده نکن (بند 90)
- Caching: Redis آماده در docker-compose, اما Local وابسته نیست

## 12. Deployment

**Local (Termux):**
```
Android → Termux → Python venv → SQLite → Uvicorn 0.0.0.0:8000 → Browser
./scripts/termux_setup.sh (یک‌بار)
./scripts/termux_start.sh (هر بار)
```

**Server (Production):**
```
Internet → HTTPS → Nginx → Frontend (dist) + Backend (FastAPI) → PostgreSQL + Redis
docker compose up -d --build
```

Docker شرط اجرای Local نیست.

## 13. تصمیمات کلیدی (خلاصه ADR)

- ADR-001: SQLite dev, PostgreSQL prod, BigInt variant
- ADR-002: Tenant Isolation در Repository فعلا, RLS بعدا
- ADR-003: Permission از DB نه از Token
- ADR-004: Auth جدا از Authorization
- ADR-005: 404 برای Tenant دیگر
- ADR-006: Idempotency در DB نه Redis
- ADR-007: Code Sequence جدا از Formatting
- ADR-008: بدون وابستگی به سرویس تحریم‌شده

جزئیات در `docs/decisions/`
