# ADR — Architecture Decision Records — AREP

هر تصمیم معماری مهم اینجا به‌صورت جداگانه ثبت می‌شود (بند 64 قانون اساسی).

فرمت هر ADR:

- **Context:** مسئله چیست؟ چرا باید تصمیم بگیریم؟
- **Decision:** چه تصمیمی گرفتیم؟
- **Alternatives:** چه گزینه‌های دیگری بررسی شد؟
- **Consequences:** چه عواقبی (مثبت/منفی) دارد؟

نام‌گذاری: `ADR-XXXX-title.md` — شماره‌ها ترتیبی و یکتا.

## لیست ADRها

- ADR-0001 — SQLite برای توسعه, PostgreSQL برای Production
- ADR-0002 — Tenant Isolation در لایه Repository (فعلاً بدون RLS)
- ADR-0003 — Permission از Token خوانده نمی‌شود
- ADR-0004 — تفکیک Authentication از Authorization
- ADR-0005 — پاسخ 404 برای Tenant دیگر
- ADR-0006 — Idempotency در سطح دیتابیس
- ADR-0007 — Property Code جدا از Sequence
- ADR-0008 — بدون وابستگی به سرویس‌های تحریم‌شده
- ADR-0009 — Property Domain Layered Model (Phase 5)
- ADR-0010 — CRM Domain (Person, Requests, Favorites, Saved Searches) (Phase 6)
- ADR-0011 — Visits & Notifications Domain (Phase 7-8)

برای تصمیم جدید: `ADR-0009-...` بساز و اینجا لیست کن.

همچنین `../DECISIONS.md` قدیمی به‌عنوان legacy نگه داشته شده است.
