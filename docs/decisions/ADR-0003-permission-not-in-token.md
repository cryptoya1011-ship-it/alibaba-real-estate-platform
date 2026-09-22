# ADR-0003 — Permission از Token خوانده نمی‌شود

- **Date:** 2026-09-18
- **Status:** Accepted

## Context

اگر Permission داخل JWT ذخیره و مبنای تصمیم باشد, تغییر دسترسی تا انقضای Token اثر ندارد. کاربر با Token قدیمی همچنان دسترسی قبلی را دارد. چگونه تغییر Role/Permission را آنی کنیم؟

## Decision

JWT فقط انتخاب Tenant و `permissions_version` را حمل می‌کند؛ Roles/Permissions در هر Request از دیتابیس resolve می‌شوند.

- JWT Claims: `user_id, organization_id, branch_id, roles (برای نمایش), permissions_version, session_id`
- `permissions_version` در جدول `users` ذخیره می‌شود
- در `get_context` هر Request: `user.permissions_version` با `payload.permissions_version` مقایسه می‌شود؛ اگر متفاوت → Unauthorized
- با افزایش `users.permissions_version` تمام Tokenهای قبلی همان کاربر بی‌اعتبار می‌شوند
- `RbacService.resolve(user_id, org_id)` → roles + permissions از DB

## Alternatives

- **Permission در JWT:** سریع‌تر (بدون Query) اما تغییر دسترسی دیر اثر می‌کند
- **Short TTL + Refresh Token:** پیچیده‌تر, هنوز تاخیر دارد
- **Blacklist Token:** نیاز به Redis, روی Termux سخت

## Consequences

**مثبت:**
- تغییر Permission آنی اثر می‌کند
- ابطال تمام Tokenها با یک UPDATE
- ساده, بدون Redis

**منفی:**
- یک Query اضافه در هر Request محافظت‌شده (Join roles/permissions)

**Mitigation:**
- قابل Cache شدن با Redis در آینده بدون تغییر API (فقط در RbacService)
- Query کوچک و Indexed است
- می‌توان `permissions_version` را در Redis هم Cache کرد
