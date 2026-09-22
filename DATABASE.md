# DATABASE — AREP

## 1. استراتژی کلی (بند 20,21)

- **Local:** SQLite (`sqlite+aiosqlite:///./arep_dev.db`) — بدون نیاز به Docker روی Android
- **Production:** PostgreSQL (`postgresql+asyncpg://...`) — فقط با تغییر `DATABASE_URL`, بدون تغییر کد
- **ORM:** SQLAlchemy 2.0 async
- **Migration:** Alembic با `render_as_batch=True` برای سازگاری SQLite
- **قانون:** هیچ تغییر دستی در DB؛ هر تغییر Schema باید Migration داشته باشد

## 2. Portable Types

```python
BigInt = BigInteger().with_variant(Integer, "sqlite")
```

تمام PK و FK از این Type استفاده می‌کنند تا روی SQLite AUTOINCREMENT کار کند.

Naming Convention برای Alembic:

```
ix_%(table_name)s_%(column_0_N_name)s
uq_%(table_name)s_%(column_0_N_name)s
ck_%(table_name)s_%(constraint_name)s
fk_%(table_name)s_%(column_0_name)s
pk_%(table_name)s
```

## 3. Base Mixins (بند 51)

```python
class BaseEntity(IdMixin, TimestampMixin, AuditMixin, SoftDeleteMixin, VersionMixin)

IdMixin: id (BigInt PK)
TimestampMixin: created_at, updated_at (DateTime timezone=True, server_default now())
AuditMixin: created_by, updated_by (BigInt nullable)
SoftDeleteMixin: is_deleted (bool default False), deleted_at, deleted_by
VersionMixin: version (int default 1) — Optimistic Locking
TenantEntity(BaseEntity): + organization_id (FK RESTRICT), branch_id (FK SET NULL nullable)
```

تمام Entityهای Tenant-scoped از TenantEntity ارث می‌برند.

## 4. جداول فعلی (Migrations 0001 → 0005)

### Migration Chain (2026-09-21)
- 76a44e4e99c4_initial (Identity, Tenancy, RBAC, code_sequences, idempotency_keys)
- 8d453b823210_add_property_domain (properties, usages, locations, media)
- 0e898a633ce7_add_crm_domain (persons, person_roles, customer_requests, favorites, saved_searches)
- 84455b931380_add_visits_and_notifications (visits, notifications)
- 30be32e888f7_add_deals_and_commission (deals, deal_status_history)

### 4.0 جداول فعلی

#### Identity / Tenancy / RBAC — Migration 0001

### 4.1 Identity

**users**
- telegram_id unique nullable, telegram_username, first_name, last_name, phone (indexed), language_code default fa
- is_active, is_super_admin, permissions_version (برای ابطال JWT)
- BaseEntity

### 4.2 Tenancy

**organizations**
- name, slug unique, city_code, phone, is_active
- BaseEntity

**branches**
- organization_id FK, name, code (unique per org), address, is_main, is_active
- BaseEntity

**user_organizations (Membership)**
- user_id FK CASCADE, organization_id FK CASCADE, is_active, is_owner
- unique(user_id, organization_id)
- BaseEntity

**user_branches**
- user_id, organization_id, branch_id (همه FK CASCADE), is_default
- unique(user_id, branch_id)
- BaseEntity

**organization_invitations**
- organization_id FK CASCADE, branch_id FK SET NULL, invited_telegram_id indexed, invited_phone indexed, role_code, token_hash indexed, status (pending/accepted...), accepted_by_user_id
- BaseEntity — Endpoint ندارد هنوز

### 4.3 RBAC

**permissions**
- code unique (مثل `property:create`), title nullable
- BaseEntity

**roles**
- code unique (مثل `organization_admin`), title, organization_id nullable (system roles global), is_system
- BaseEntity

**role_permission_map**
- role_id FK CASCADE, permission_id FK CASCADE, unique(role_id, permission_id)
- BaseEntity

**user_role_map**
- user_id FK CASCADE, organization_id FK CASCADE, role_id FK CASCADE, branch_id FK SET NULL nullable
- BaseEntity

### 4.4 System Tables

**code_sequences** (ADR-007)
- organization_id FK CASCADE, scope (مثل `property`), period (مثل `2608` برای مرداد 1404), last_value int
- unique(organization_id, scope, period)
- BaseEntity — فقط شمارنده نگه می‌دارد؛ فرمت `AB-ISF-MJ-AP-S-2608-00124` در Service

**idempotency_keys** (ADR-006)
- organization_id nullable indexed, user_id nullable, endpoint string 200, key string 128, request_fingerprint sha256, status_code, response_body text, expires_at
- unique(organization_id, endpoint, key)
- BaseEntity — Retry امن بدون Redis

## 5. جداول آینده (Phase 5+)

### 5.1 Property Domain (بند 22-33)

**properties (Core)**
- code unique human-readable, title, description, status (Draft, PendingReview, Approved, Published, Reserved, Sold, Rented, Archived), property_type (Apartment, Villa, Land...), transaction_type (Sale, Rent, Exchange, Partnership)
- organization_id, branch_id, submitted_by (user), owner_person_id nullable (اگر Intermediary باشد لازم نیست)
- BaseEntity + TenantEntity

**property_usages**
- property_id FK, usage_type (Residential, Commercial, Administrative...) — چندتایی
- unique(property_id, usage_type) — برای Mixed Use

**property_sections (بند 25)**
- property_id FK, section_type (LandArea, BuiltArea, UsefulArea, NetArea...), value, unit
- یا به صورت ستون‌های جدا در properties اگر ساده‌تر باشد

**property_location**
- property_id FK, city, district, neighborhood, public_lat/lng (controlled), exact_address (private, فقط با permission `property:address:read`), postal_code
- نکته Privacy: Public DTO هرگز exact_address را نمی‌دهد

**property_financials**
- property_id FK, price, currency, rent_amount, deposit, exchange_description (flexible: Property/Car/Gold/Other)

**property_partnership (بند 28)**
- property_id FK, land_area, frontage, zoning, owner_share, builder_share, etc.

**property_media (بند 31)**
- property_id FK, file_path, file_type (image/video/doc), is_primary, sort_order, storage_backend (filesystem/object_storage)
- Media Storage abstraction

**property_attributes (Extended)**
- property_id FK, key, value (JSON) — برای امکانات (پارکینگ, آسانسور...)

### 5.2 CRM (بند 34-37)

**persons**
- organization_id, first_name, last_name, phone, national_id, type (Owner, Buyer, Tenant... می‌تواند چندتایی باشد)
- TenantEntity

**person_roles**
- person_id, role (Owner, Buyer...) — برای نقش‌های چندگانه

**customer_requests**
- person_id FK, transaction_type, property_type, location, budget_min/max, area_min/max, rooms, amenities JSON, special_requirements

**favorites**
- user_id, property_id, unique(user_id, property_id)

**saved_searches**
- user_id, query JSON, name

### 5.3 Visits (بند 38), Deals (بند 39), Commission (بند 40)

**visits** — DONE Migration 84455b931380
- organization_id, branch_id, property_id FK, customer_id FK persons, agent_id FK users SET NULL
- visit_date Date, visit_time Time nullable, status enum scheduled/done/cancelled/no_show/rescheduled default scheduled, notes, follow_up_notes, result
- Indexes: org+property, customer, agent, date, status
- TenantEntity

**deals** — DONE Migration 30be32e888f7
- organization_id, branch_id, code unique DL-YYMM-00001, code_period YYMM, code_sequence int, title 500, status enum lead/qualification/property_match/visit/negotiation/agreement/closed_won/closed_lost/archived default lead
- customer_id FK persons RESTRICT required, property_id FK properties SET NULL nullable (مستقل per بند 39), agent_id FK users SET NULL
- amount BigInt, commission_total BigInt, commission_agent_share BigInt, commission_office_share BigInt, commission_referral_share BigInt, commission_status enum pending/partially_paid/paid/cancelled default pending
- notes Text, loss_reason Text
- Indexes: org+status, customer_id, property_id, agent_id, code unique
- TenantEntity + BaseEntity

**deal_status_history** — DONE Migration 30be32e888f7
- organization_id, branch_id, deal_id FK deals CASCADE, from_status nullable, to_status, changed_by FK users SET NULL, notes Text
- Indexes: org+deal_id, deal_id
- TenantEntity

**Commission (future Accounting Domain per بند 40)**
- فعلا فیلدهای ساده در deals
- آینده: commission_ledger, commission_payments, commission_rules

### 5.4 Notifications (بند 41), Analytics (بند 85)

**notifications**
- organization_id, user_id, channel (in-app/telegram/sms...), priority (Critical/Important/Normal/Info), title, body, is_read

**analytics_events**
- organization_id, event_type (ListingView, Search, Lead...), entity_id, metadata JSON — آماده partitioning ماهانه

## 6. Tenant Isolation

**فعلا (SQLite):**
- `TenantRepository._base_select()` → `WHERE organization_id = current_context().require_organization() AND is_deleted = false`
- `create()` → `organization_id` فقط از Context

**آینده (PostgreSQL):**
- RLS به‌عنوان لایه دوم:
```sql
ALTER TABLE properties ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON properties FOR ALL USING (organization_id = current_setting('app.current_org_id')::bigint);
```
- `SET app.current_org_id = ...` در هر Connection از Middleware

## 7. Migration Strategy

- هر تغییر Schema → `alembic revision --autogenerate -m "..."`
- تست: `alembic upgrade head` و `downgrade base` و دوباره `upgrade` (تست roundtrip در `tests/test_migrations.py`)
- روی Termux: `alembic upgrade head` قبل از `uvicorn`

## 8. Backup & Safety (بند 72)

- قبل از Migration خطرناک: `cp arep_dev.db arep_dev.db.bak` یا `pg_dump`
- Git Commit قبل از Migration
- هیچ Migration دستی بدون Review

## 9. Future Considerations

- **Partitioning:** Audit Logs و Analytics Events آماده partitioning ماهانه در Production
- **Full Text Search:** PostgreSQL FTS برای Search (بند 83), نه Elasticsearch روز اول
- **PostGIS:** برای Location Search دقیق در آینده (اختیاری)
- **Redis:** برای Cache Permissions و Rate Limit (آینده)
