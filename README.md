# Alibaba Real Estate Platform (AREP)

پلتفرم مدیریت املاک «املاک علی‌بابا» — Modular Monolith، Multi-Tenant، API-First، Android-First.

فاز فعلی: **Sprint 1 — Platform Core** (Auth + Tenancy + RBAC + زیرساخت API)

---

## ساختار پروژه

```
backend/          FastAPI + SQLAlchemy 2 + Alembic
  app/core/       config, security (Telegram initData + JWT), tenant context, errors, envelope
  app/db/         Base, mixins (soft delete / version / audit), session, system tables
  app/modules/    users, organizations, rbac, auth  (هر Domain مستقل)
  app/repositories/  BaseRepository + TenantRepository (فیلتر tenant به‌صورت مرکزی)
  app/api/v1/     endpointها + deps (auth, permission guard, pagination, idempotency)
  migrations/     Alembic
  tests/          pytest (۲۸ تست)
frontend/         React + TypeScript + Vite (Telegram Web App)
nginx/            reverse proxy برای سرور
scripts/          نصب و اجرا روی Termux
docker-compose.yml  اجرا روی سرور (PostgreSQL + Redis + Nginx)
PROJECT_STATE.md  وضعیت پروژه برای ادامه کار در Session جدید
```

---

## اجرا روی گوشی (Termux) — بدون Docker

```bash
cd ~/alibaba-real-estate-platform
bash scripts/termux_setup.sh      # یک‌بار
bash scripts/termux_start.sh      # هر بار اجرا
```

سپس در مرورگر گوشی: `http://127.0.0.1:8000/docs`

پایگاه داده پیش‌فرض SQLite است تا روی Android بدون Docker کار کند؛ روی سرور فقط
`DATABASE_URL` به PostgreSQL تغییر می‌کند و کد تغییر نمی‌کند.

## اجرا روی سرور (Docker)

```bash
cp .env.example .env      # مقادیر را پر کنید
docker compose up -d --build
```

## تست

```bash
bash scripts/test.sh
```

---

## قواعد ثابت معماری

| موضوع | قاعده |
|---|---|
| Business Logic | فقط در Service Layer؛ نه در Bot، نه در Frontend |
| Tenant | `organization_id` هرگز از ورودی کاربر خوانده نمی‌شود؛ از Request Context می‌آید |
| دسترسی به Tenant دیگر | پاسخ `404` (نه `403`) تا وجود منبع افشا نشود |
| Response | همیشه `{success, data, meta, error}` |
| حذف | Soft Delete (`is_deleted`)؛ رکورد فیزیکی حذف نمی‌شود |
| ویرایش | Optimistic Locking با فیلد `version` |
| ثبت مجدد | `Idempotency-Key` روی POSTهای حساس |
| Secret | فقط در `.env`؛ هرگز در Git |

مستندات تصمیم‌های معماری: `docs/DECISIONS.md`
