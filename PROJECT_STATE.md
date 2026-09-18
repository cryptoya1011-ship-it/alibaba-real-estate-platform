# PROJECT_STATE — AREP

> این فایل برای ادامه کار در Session جدید است. اول این را بخوان، بعد کد.

## وضعیت فعلی
- **Sprint جاری:** Sprint 1 — Platform Core (تمام‌شده)
- **تاریخ:** 2026-09-18
- **Commit:** `chore(init): AREP platform core — auth, tenancy, RBAC, API foundation`
- **Branch:** `main`
- **وضعیت GitHub قبل از این Commit:** Repository کاملاً خالی بود (بدون هیچ commit). «Sprint 5A» ذکرشده در
  Master Prompt روی GitHub وجود نداشت.
- **Runtime تأییدشده:** Python 3.12+ (تست‌شده روی 3.14)، SQLite، uvicorn — سرور بالا آمده و پاسخ داده است.

## Featureهای انجام‌شده (VERIFIED — تست اجرا شده)
- Config امن با pydantic-settings + Guard برای Production (JWT_SECRET/dev-login/bot token).
- Response Envelope واحد `{success, data, meta, error}` + Error Handler سراسری (بدون افشای خطای خام DB).
- Telegram Web App `initData` با HMAC-SHA256 + بررسی `auth_date` (تست: امضای دست‌کاری‌شده، user جعلی، initData منقضی).
- JWT شامل `user_id, organization_id, branch_id, roles, permissions_version, session_id`.
- `permissions_version` برای بی‌اعتبارسازی Tokenهای قبلی.
- Tenant Context: Request-Scoped + Immutable (`contextvars`, frozen dataclass).
- `TenantRepository`: فیلتر `organization_id` + `is_deleted` به‌صورت مرکزی؛ `organization_id` هرگز از ورودی کاربر.
- Tenant Isolation: دسترسی به سازمان دیگر → `404` (۵ تست).
- RBAC: Permission/Role/RolePermission/UserRole + نقش‌های سیستمی (organization_admin, branch_admin, agent).
- Organization + Branch + Membership (UserOrganization) + UserBranch؛ سازنده سازمان → owner + organization_admin + شعبه MAIN.
- Multi-Organization: انتخاب سازمان فعال با `POST /auth/select-organization`.
- Optimistic Locking روی PATCH با فیلد `version` → `VERSION_CONFLICT`.
- Soft Delete + Audit (`created_by/updated_by/deleted_by`) روی همه Entityها.
- Idempotency-Key روی POSTها (تکرار = همان پاسخ؛ کلید تکراری با بدنه متفاوت = 409).
- Pagination (offset) با `meta.pagination` آماده برای Cursor.
- Migration Alembic: upgrade و downgrade هر دو تست شده.
- CLI: `python -m app.cli seed | status | make-super-admin <telegram_id>`.
- Frontend: Telegram Web App (React+TS+Vite) — `npm run build` موفق.
- Docker Compose (Postgres+Redis+Nginx) و Dockerfile — **UNVERIFIED** (روی این محیط اجرا نشد).

## Migrationهای اجراشده
- `0001_initial_platform_core` — users, organizations, branches, user_organizations, user_branches,
  organization_invitations, roles, permissions, role_permission_map, user_role_map,
  code_sequences, idempotency_keys.

## تست‌ها
`bash scripts/test.sh` → **28 passed** (health/envelope، auth، organizations، tenant isolation، migration roundtrip).

## Featureهای باقی‌مانده (به ترتیب اولویت)
1. **Property Domain** (Sprint 2): Property + PropertyUsage (چند کاربری) + PropertySection + Owner ≠ SubmittedBy
   + Media + Property Code از `code_sequences` + پنهان‌سازی آدرس دقیق بر اساس Permission.
2. **Invitation Flow**: پذیرش دعوت محدود به هویت مشخص (جدول موجود، Endpoint ندارد).
3. **Custom Roles**: مدیریت Role/Permission توسط Organization Admin (مدل موجود، Endpoint ندارد).
4. **Telegram Bot**: نقطه ورود + Notification (بدون Business Logic).
5. **CRM / Deal / Commission / Matching / Analytics**.
6. **PostgreSQL RLS** به‌عنوان لایه دوم Isolation.
7. **Redis** برای Cache دسترسی‌ها و Rate Limit.

## Known Issues / بدهی فنی
- RLS در دیتابیس فعال نیست (ADR-002). فیلتر Tenant فعلاً در Repository است.
- `permissions` در هر Request از DB خوانده می‌شود (یک Query اضافه) — عمداً؛ Cache بعداً.
- `POST /auth/dev-login` فقط برای توسعه؛ در Production خودکار غیرفعال است.
- Media Storage انتخاب نشده (پیشنهاد: فایل‌سیستم محلی + مسیر قابل تغییر، بدون S3).
- Rate Limiting ندارد.
- Docker Compose تست واقعی نشده.

## تصمیمات مهم
در `docs/DECISIONS.md` (ADR-001 تا ADR-008).

## دستور اجرای پروژه
```bash
# Termux (یک‌بار)
cd ~/alibaba-real-estate-platform && bash scripts/termux_setup.sh
# اجرا
bash scripts/termux_start.sh          # http://127.0.0.1:8000/docs
# تست
bash scripts/test.sh
```
