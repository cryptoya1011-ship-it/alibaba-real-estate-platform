# ADR-0006 — Idempotency در سطح دیتابیس

- **Date:** 2026-09-18
- **Status:** Accepted

## Context

POSTهای حساس (ساخت سازمان, ملک) ممکن است به خاطر Network Retry دو بار ارسال شوند. چگونه از ساخت Duplicate جلوگیری کنیم بدون وابستگی به Redis؟

## Decision

جدول `idempotency_keys` اولین پاسخ موفق را برای هر `(organization_id, endpoint, key)` نگه می‌دارد.

- Client Header `Idempotency-Key` می‌فرستد (UUID)
- Server: fingerprint از Body می‌گیرد (sha256)
- اگر Key تکراری + Body یکسان → همان Response قبلی (200) برگردانده می‌شود
- اگر Key تکراری + Body متفاوت → `409 IDEMPOTENCY_KEY_REUSED`
- `expires_at` برای پاکسازی آینده

## Alternatives

- **Redis:** سریع‌تر اما روی Termux/cPanel نیاز به سرویس اضافه
- **بدون Idempotency:** خطر Duplicate
- **Unique Constraint روی Business Field:** کافی نیست, همه جا نمی‌توان

## Consequences

**مثبت:**
- بدون نیاز به Redis, روی Termux و cPanel کار می‌کند
- Retry امن
- پیاده‌سازی ساده

**منفی:**
- یک Write اضافه در هر POST با Key
- جدول رشد می‌کند (نیاز به Cleanup Job آینده)

**Mitigation:**
- Cleanup Job: حذف رکوردهای قدیمی‌تر از 24h
- فقط برای POSTهای حساس استفاده شود, نه همه
