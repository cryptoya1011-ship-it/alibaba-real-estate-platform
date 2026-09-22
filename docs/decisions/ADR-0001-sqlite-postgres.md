# ADR-0001 — SQLite برای توسعه، PostgreSQL برای Production

- **Date:** 2026-09-18
- **Status:** Accepted

## Context

محیط اصلی توسعه، گوشی Android + Termux است و Docker/PostgreSQL روی آن عملاً قابل اجرا نیست. از طرفی Production باید PostgreSQL باشد تا RLS, Full Text Search, Partitioning, PostGIS را پشتیبانی کند.

چگونه یک Codebase داشته باشیم که هر دو را پوشش دهد بدون تغییر Business Logic؟

## Decision

لایه دسترسی داده کاملاً از طریق SQLAlchemy async نوشته می‌شود؛ `DATABASE_URL` تنها نقطه تفاوت است.

- نوع ستون‌ها با `BigInteger().with_variant(Integer, "sqlite")` قابل حمل شده
- Alembic با `render_as_batch=True` روی SQLite کار می‌کند
- هیچ ویژگی اختصاصی PostgreSQL (JSONB, RLS, PostGIS) تا زمانی که سرور اصلی نیامده استفاده نمی‌شود
- `DATABASE_URL` پیش‌فرض: `sqlite+aiosqlite:///./arep_dev.db`
- Production: `postgresql+asyncpg://...`

## Alternatives

- **فقط PostgreSQL:** روی Termux کار نمی‌کند, Local-first نقض می‌شود
- **فقط SQLite:** برای Production مقیاس‌پذیر نیست, RLS ندارد
- **ORM جدا برای هر DB:** پیچیدگی, دو Codebase

## Consequences

**مثبت:**
- هیچ کدی هنگام انتقال به سرور تغییر نمی‌کند
- توسعه روی Android ممکن است
- تست‌ها سریع (SQLite in-memory)

**منفی:**
- برخی ویژگی‌های PostgreSQL فعلاً قابل استفاده نیست
- باید مراقب سازگاری Typeها باشیم
- Migration باید روی هر دو DB تست شود

**Mitigation:**
- `BigInt` wrapper
- `models_registry` برای اطمینان از کامل بودن metadata
- تست roundtrip migration
