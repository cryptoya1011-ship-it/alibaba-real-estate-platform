# ADR-0004 — تفکیک Authentication از Authorization

- **Date:** 2026-09-18
- **Status:** Accepted

## Context

Telegram Web App هویت را اثبات می‌کند اما نباید نقش و دسترسی را تعیین کند. سازمان, شعبه, نقش و دسترسی باید در AREP تعیین شود, نه در Telegram.

## Decision

- **Authentication:** Telegram فقط هویت را با HMAC-SHA256 روی `initData` اثبات می‌کند (`app/core/security.py`)
  - `secret_key = HMAC_SHA256(key="WebAppData", msg=bot_token)`
  - `expected_hash = HMAC_SHA256(key=secret_key, msg=data_check_string)`
  - `auth_date` بررسی می‌شود تا initData قدیمی قابل استفاده مجدد نباشد (max 86400s)
- **Authorization:** سازمان, شعبه, نقش و دسترسی کاملاً در AREP تعیین می‌شود
  - User توسط `telegram_id` پیدا یا ساخته می‌شود
  - Membership در `user_organizations` چک می‌شود
  - Roles/Permissions از `rbac` resolve می‌شود

## Alternatives

- **Telegram نقش بدهد:** ناامن, هر کسی می‌تواند نقش جعل کند
- **OAuth کامل Telegram:** پیچیده, نیاز به Bot API اضافه

## Consequences

**مثبت:**
- امنیت: Telegram فقط Identity Provider است
- انعطاف: می‌توان Providerهای دیگر (Phone OTP, OAuth) اضافه کرد بدون تغییر RBAC
- `auth_date` از Replay Attack جلوگیری می‌کند

**منفی:**
- نیاز به پیاده‌سازی HMAC دقیق (تست شده)

**Tests:**
- امضای دست‌کاری‌شده → 401
- user جعلی → 401
- initData منقضی → 401
