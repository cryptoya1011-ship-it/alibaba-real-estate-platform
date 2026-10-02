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
- ADR-0012 — Deals & Commission
- ADR-0013 — PWA / Public Platform
- ADR-0014 — Server / Redis / RLS
- ADR-0015 — Multi-Tenant
- ADR-0016 — AI / Automation (بخش ارائه‌دهندگان LLM با ADR-0019 جایگزین شد)
- ADR-0017 — Integrations (بخش fallback جعلی با ADR-0019 جایگزین شد)
- ADR-0018 — رنگ‌های برند: آبی نفتی و طلایی
- ADR-0019 — اتصال‌های صادق؛ حذف APIهای جعلی
- ADR-0020 — تأیید ملک توسط مدیر، حفاظت کمیسیون، نقش‌های مدیر/ناظر، انقضای دعوت‌نامه
- ADR-0021 — قالب کد ملک (حفظ قالب فعلی، تعویق پیشوند برند و دورهٔ شمسی)
- ADR-0022 — حذف واقعی عضویت و نقش کاربر (استثنای Soft Delete)
- ADR-0023 — ورود موقت با نام کاربری و رمز عبور (خارج از تلگرام؛ قابل خاموش شدن)

برای تصمیم جدید: `ADR-0009-...` بساز و اینجا لیست کن.

همچنین `../DECISIONS.md` قدیمی به‌عنوان legacy نگه داشته شده است.
