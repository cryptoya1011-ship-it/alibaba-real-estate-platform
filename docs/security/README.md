# Security Docs

- Tenant Isolation: `TenantRepository` + 404 برای Tenant دیگر (ADR-0002, ADR-0005)
- Auth: Telegram HMAC-SHA256 + JWT + permissions_version (ADR-0003, ADR-0004)
- Idempotency: DB-level (ADR-0006)
- No Vendor Lock-in: بدون سرویس تحریم‌شده (ADR-0008)

TODO:
- rbac.md — جزئیات RBAC
- privacy.md — Public vs Private DTO
- audit.md — Audit Log
