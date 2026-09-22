# ADR-0005 — پاسخ 404 برای Tenant دیگر

- **Date:** 2026-09-18
- **Status:** Accepted

## Context

اگر کاربر سازمان A به منبع سازمان B دسترسی پیدا کند, چه پاسخی بدهیم؟ 403 وجود منبع را افشا می‌کند (می‌فهمد که ID وجود دارد اما دسترسی ندارد). 404 امن‌تر است.

## Decision

دسترسی به منبعِ سازمان دیگر `404` می‌گیرد, نه `403`, تا وجود منبع افشا نشود.

- در `TenantRepository`: اگر `organization_id` متفاوت باشد, Query هیچ ردیفی برنمی‌گرداند → `None` → `NotFoundError` → 404
- در `OrganizationService.get_visible`: اگر membership نباشد → `NotFoundError`
- حتی اگر کاربر `is_super_admin` نباشد, همین منطق

## Alternatives

- **403 Forbidden:** ساده‌تر اما اطلاعات نشت می‌دهد (IDOR enumeration)
- **401 Unauthorized:** گمراه‌کننده, چون Auth درست است

## Consequences

**مثبت:**
- امنیت: Enumeration سخت‌تر
- سازگار با بند 48 قانون اساسی

**منفی:**
- Debugging کمی سخت‌تر (نمی‌فهمی 404 واقعی است یا به خاطر Tenant)

**Mitigation:**
- Logging داخلی با `request_id` و `organization_id` برای تشخیص
- تست: `tests/test_tenant_isolation.py` با 5 تست
