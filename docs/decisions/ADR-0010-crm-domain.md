# ADR-0010 — CRM Domain (Person, Requests, Favorites, Saved Searches)

- **Date:** 2026-09-21
- **Status:** Accepted
- **Phase:** Phase 6 CRM

## Context

CRM باید افراد را مستقل از Business Role نگهداری کند (بند 34):

- یک Person می‌تواند همزمان Owner, Buyer, Tenant, Seller, Investor, Landlord, Developer, Intermediary باشد
- Customer Requests شامل transaction type, property type, location, budget, area, rooms, amenities, special requirements (بند 35)
- Favorites: User بتواند Property را Favorite کند (بند 36)
- Saved Search: User بتواند Search را ذخیره کند و Matching Property جدید → Notification (بند 37)

همچنین باید از ثبت تکراری مشتری با شماره تکراری per organization جلوگیری شود (fix(crm): prevent duplicate customer).

## Decision

**Models:**

1. **persons:**
   - organization_id, first_name, last_name, phone (unique per org), email, national_id, notes
   - Unique(organization_id, phone) — جلوگیری از Duplicate (PostgreSQL و SQLite هر دو چند null را مجاز می‌دانند)
   - TenantEntity + BaseEntity (soft delete, version, audit)

2. **person_roles:**
   - person_id FK CASCADE, role (owner, buyer, tenant, seller, investor, landlord, developer, intermediary)
   - Unique(person_id, role) — یک Person می‌تواند چند نقش داشته باشد
   - TenantEntity — برای Mixed Roles

3. **customer_requests (بند 35):**
   - person_id FK CASCADE
   - transaction_type, property_type, city_code, district_code, city, district
   - budget_min/max (BigInt), area_min/max (Float), rooms, bedrooms, has_parking/elevator/warehouse
   - amenities_json (JSON), special_requirements (Text), status (active, matched, closed)
   - TenantEntity

4. **favorites (بند 36):**
   - user_id (BigInt, از JWT), property_id FK CASCADE, organization_id
   - Unique(user_id, property_id) — یک کاربر یک ملک را یک بار Favorite می‌کند
   - TenantEntity — برای Isolation (هر چند user_id global است, org filter هم داریم)

5. **saved_searches (بند 37):**
   - user_id, name, query_json (JSON of structured search), is_active
   - TenantEntity
   - Matching: `find_matches` در SavedSearchService از PropertyService.search استفاده می‌کند — query_json را به فیلترهای Property تبدیل می‌کند

**Permissions (بند 46):**
- customer:create, read, update, delete
- customer_request:create, read, update
- favorite:manage
- saved_search:manage
- اضافه به ALL_PERMISSIONS و System Roles:
  - ORG_ADMIN: همه
  - BRANCH_ADMIN: همه CRM
  - AGENT: create/read/update برای customer و request, manage برای favorite/saved_search

**Services:**

- **PersonService:**
  - create: چک Duplicate phone per org → ConflictError CUSTOMER_PHONE_TAKEN
  - add_role/remove_role: soft delete aware, فیلتر is_deleted در memory چون relationship selectin فیلتر نمی‌کند
  - list: q search (first_name, last_name, phone LIKE), role filter via JOIN person_roles

- **CustomerRequestService:**
  - create: چک person exists via TenantRepository (Isolation)
  - list: filter by person_id, status

- **FavoriteService:**
  - add: idempotent — اگر قبلا Favorite شده همان را برگردان
  - list: per user_id
  - remove: soft delete

- **SavedSearchService:**
  - create: query_json = JSON dump
  - find_matches: parse query_json و فراخوانی PropertyService.search — برای بند 37 (Matching → Notification آینده)

**API:**

- /persons (POST, GET, GET/{id}, PATCH, DELETE, POST/{id}/roles, DELETE/{id}/roles/{role})
- /customer-requests (POST, GET, GET/{id}, PATCH)
- /favorites (POST, GET, DELETE/{property_id})
- /saved-searches (POST, GET, GET/{id}, PATCH, DELETE, GET/{id}/matches)

**Tenant Isolation:**

- همه Repositoryها TenantRepository — organization_id از Context
- تست: test_crm_tenant_isolation — Org B نمی‌تواند Person Org A را ببیند → 404

## Alternatives

- **Person به‌عنوان User:** User هویت سیستم است (Telegram), Person مشتری خارجی — باید جدا باشند
- **Role به‌صورت ستون در persons:** فقط یک نقش — Mixed Use نقض می‌شود
- **Favorites در persons:** باید per user باشد نه per person
- **Saved Search به‌صورت ستون در user:** نیاز به جدول جدا برای query_json و is_active

## Consequences

**مثبت:**
- Person مستقل از Role — یک فرد چند نقش
- جلوگیری از Duplicate phone per org
- Favorites idempotent
- Saved Search با Matching ساده — آماده برای Notification (بند 37)
- Tenant Isolation کامل
- Permissions granular

**منفی:**
- Relationship selectin فیلتر is_deleted را خودکار نمی‌کند — نیاز به فیلتر دستی در Service (حل شد)
- area_min/max در CustomerRequest فعلا Float — برای بودجه BigInt — ممکن است نیاز به واحد داشته باشد (IRR)
- Matching فعلا ساده (LIKE و فیلترهای پایه) — برای AI Matching آینده باید بهبود یابد

**Future:**
- CRM → Deal ارتباط: یک Request می‌تواند به Deal تبدیل شود
- Notification برای Saved Search matches (بند 37)
- Person → Property relation (Owner of many properties)
- Import/Export CSV برای CRM
