# ADR-0009 — Property Domain Layered Model

- **Date:** 2026-09-21
- **Status:** Accepted
- **Phase:** Phase 5 Property Engine

## Context

Property Model باید Layered و Flexible باشد (بند 22 قانون اساسی):

- Property Core + Usage + Physical + Location + Financial + Transaction + Media + Legal + Extended Attributes
- Mixed Use: ملک می‌تواند همزمان چند کاربری داشته باشد (بند 24)
- Area: انواع متراژ (بند 25)
- Transaction: Sale, Rent, Exchange, Partnership با Exchange flexible (بند 26,27)
- Privacy: آدرس دقیق و شماره مالک نباید عمومی باشد (بند 30,61)
- Code: AB-ISF-MJ-AP-S-2608-00124 یکتا و قابل تحلیل (بند 32)
- Lifecycle: Draft → ... → Archived قابل توسعه (بند 33)

چگونه مدلی بسازیم که هم ساده باشد (برای First Release) و هم آماده Scale؟

## Decision

**جداول:**

1. **properties (Core):**
   - code, code_period, code_sequence — یکتا per org
   - title, description, property_type, transaction_type, status, registrant_type
   - Area: land_area, built_area, useful_area, floor_area
   - Physical: rooms, bedrooms, bathrooms, floor_number, total_floors, year_built
   - Financial: price, rent_price, deposit, currency, is_exchangeable, exchange_description
   - Partnership: owner_share, builder_share
   - Owner: owner_name, owner_phone, owner_person_id (nullable, برای Intermediary)
   - Amenities: has_parking, has_elevator, has_warehouse, has_balcony, amenities_json (JSON)
   - Legal: legal_info
   - BaseEntity + TenantEntity

2. **property_usages (Mixed Use):**
   - property_id FK CASCADE, usage_type, is_primary
   - Unique(property_id, usage_type) — برای پشتیبانی چند کاربری
   - TenantEntity

3. **property_locations (Privacy):**
   - property_id FK unique (one-to-one)
   - city, city_code (ISF), district, district_code (MJ), neighborhood
   - public_lat/lng (controlled public)
   - exact_address, postal_code (private, فقط با permission property:address:read)
   - TenantEntity

4. **property_media (بند 31):**
   - property_id FK CASCADE, file_path, file_name, file_type (image/video/document), mime_type, is_primary, sort_order, storage_backend (filesystem/object_storage abstraction)
   - TenantEntity

**Code Generator (ADR-007):**
- code_sequences جدول فقط شمارنده نگه می‌دارد (organization_id, scope=property, period=YYMM)
- Service: `AB-{city_code}-{district_code}-{prop_type_code}-{trans_code}-{period}-{seq:05d}`
- Period: YYMM Gregorian (2609 برای 2026-09) — TODO Jalali در آینده
- Type codes: apartment→AP, villa→VI, land→LA, etc. Transaction: sale→S, rent→R
- Atomic increment via CodeSequenceRepository.next_value()

**Privacy (بند 61):**
- Public DTO vs Internal DTO جدا
- API: `_property_to_internal_dict` چک می‌کند `property:address:read` و `property:owner:read`
- List items هرگز exact_address ندارند
- Owner info فقط اگر has_owner permission

**Lifecycle:**
- status enum: draft, pending_review, approved, published, reserved, sold, rented, archived
- Default draft, قابل توسعه

**Search (بند 15):**
- Structured search در PropertyRepository.search(): property_type, transaction_type, status, city_code, district_code, price, area, amenities, q (LIKE)
- آینده: PostgreSQL FTS, Natural Language via AI Adapter

## Alternatives

- **Single table با JSON برای همه:** ساده‌تر اما Query سخت, Index ندارد
- **EAV برای همه Attributes:** انعطاف بالا اما پیچیدگی, Performance پایین
- **جدا کردن هر Area به جدول جدا:** Over-engineering برای First Release
- **Code به‌صورت UUID:** خوانا نیست, قابل تحلیل نیست

## Consequences

**مثبت:**
- Layered ولی ساده — برای First Release کافی
- Mixed Use پشتیبانی می‌شود
- Privacy رعایت شده (Public vs Internal)
- Code یکتا و قابل تحلیل
- Search ساختاریافته آماده
- Tenant Isolation via TenantRepository (404 برای Tenant دیگر)
- Idempotency, Optimistic Locking, Soft Delete رعایت شده

**منفی:**
- Area به‌صورت ستون‌های جدا — اگر Area types جدید اضافه شود Migration لازم است (قابل قبول برای Phase 5)
- Location one-to-one — اگر ملک چند آدرس داشته باشد (نادر) نیاز به تغییر
- Media Storage فعلا filesystem — Object Storage abstraction آماده اما پیاده‌سازی نشده

**Future:**
- property_sections جدول جدا برای Area types بیشتر
- PostGIS برای location search دقیق
- Media upload endpoint + Object Storage (MinIO)
- Natural Language Search via AI Adapter
- Lifecycle state machine با Events (PropertyApproved, etc.)
