# ADR-0002 — Tenant Isolation در لایه Repository (فعلاً بدون RLS)

- **Date:** 2026-09-18
- **Status:** Accepted

## Context

Master Spec خواستار Isolation در چهار لایه است (DB/RLS, Repository, Service, API). اما SQLite از RLS پشتیبانی نمی‌کند. چگونه Isolation را تضمین کنیم بدون وابستگی به PostgreSQL؟

## Decision

`TenantRepository` فیلتر `organization_id` را به‌صورت مرکزی در `_base_select` و `create` اعمال می‌کند و مقدار آن را فقط از Request Context می‌خواند، نه از ورودی کاربر.

```python
class TenantRepository:
    def _organization_id(self) -> int:
        return current_context().require_organization()

    def _base_select(self, ...):
        return super()._base_select(...).where(self.model.organization_id == self._organization_id())

    async def create(self, **values):
        values["organization_id"] = self._organization_id()
        return await super().create(**values)
```

- `organization_id` هرگز از Body/Query نمی‌آید
- `current_context()` از `contextvars` می‌آید که در Middleware ست می‌شود
- `is_deleted` هم مرکزی فیلتر می‌شود

## Alternatives

- **فیلتر دستی در هر Query:** فراموش می‌شود, ناامن
- **RLS از روز اول:** روی SQLite کار نمی‌کند, Local-first نقض
- **Middleware فقط:** کافی نیست, Service می‌تواند فراموش کند

## Consequences

**مثبت:**
- فراموش کردن فیلتر Tenant غیرممکن (یا سخت) است
- روی SQLite و PostgreSQL یکسان کار می‌کند
- تست Tenant Isolation آسان

**منفی:**
- RLS فعلاً نیست — یک لایه دفاعی کمتر
- اگر کسی مستقیماً از Session استفاده کند (بدون Repository) می‌تواند فراموش کند

**Mitigation / Future:**
- RLS به‌عنوان لایه دوم دفاعی هنگام مهاجرت به PostgreSQL اضافه می‌شود (Migration جداگانه, Backward Compatible)
- Code Review: هیچ Query مستقیم بدون Repository
- تست: `test_tenant_isolation.py` با 5 تست
