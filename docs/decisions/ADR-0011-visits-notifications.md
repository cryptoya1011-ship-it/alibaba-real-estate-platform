# ADR-0011 — Visits & Notifications Domain (Phase 7-8)

- **Date:** 2026-09-21
- **Status:** Accepted
- **Phase:** Phase 7-8 Search Polish + Visits + Notifications

## Context

- **Visit** شامل Property, Customer, Agent, Date, Time, Status, Notes (بند 38)
- **Notification** Core مستقل از Provider (بند 41), Channelهای آینده In-App, Telegram, SMS, Push, Email, Priority Critical/Important/Normal/Informational (بند 82)
- همچنین Search باید Polish شود (بند 15, 83)

چگونه Visit و Notification را به‌صورت Modular Monolith پیاده کنیم که هم برای Internal CRM و هم برای Public Platform قابل استفاده باشد و Providerها قابل تعویض باشند؟

## Decision

**Models:**

1. **visits:**
   - organization_id, branch_id, property_id FK CASCADE, customer_id (person) FK CASCADE, agent_id (user) FK SET NULL
   - visit_date (Date), visit_time (Time nullable), status (scheduled, done, cancelled, no_show, rescheduled) default scheduled, notes, follow_up_notes, result (interested, not_interested...)
   - Indexes: organization_id+property_id, customer_id, agent_id, date, status
   - TenantEntity + BaseEntity

2. **notifications:**
   - organization_id, branch_id, user_id (BigInt, recipient), channel (in_app, telegram, sms, push, email) default in_app, priority (critical, important, normal, informational) default normal
   - title (300), body (Text), entity_type (property, visit, person...), entity_id, data_json (JSON extra)
   - is_read bool default false, read_at DateTime
   - Indexes: org+user_id, org+is_read, org+priority, org+channel, user_id+is_read
   - TenantEntity

**Permissions:**

- visit:create, read, update, delete
- notification:read, manage
- Added to ALL_PERMISSIONS and System Roles:
  - ORG_ADMIN: all
  - BRANCH_ADMIN: all visits + notifications
  - AGENT: create/read/update visits, read notifications

**Services:**

- **VisitService:**
  - create: validate status, check property exists (TenantRepository), check customer exists, agent_id default current user, create notification for agent (in_app, important) — بند 41: `بازدید جدید: {prop.title}` 
  - list: filters property_id, customer_id, agent_id, status, date_from/to (ISO YYYY-MM-DD)
  - update: status validation, optimistic locking
  - soft_delete

- **NotificationService:**
  - create: normalize priority/channel, data_json dump, is_read false
  - list: per user_id, filters is_read, priority, order by created_at desc
  - mark_read: set is_read true + read_at now
  - mark_all_read: fetch unread and update
  - get_unread_count: count where is_read false
  - delete: soft delete

**API:**

- **Visits:** POST /visits, GET /visits (filters), GET /visits/{id}, PATCH /{id}, DELETE /{id}
- **Notifications:** GET /notifications (filters is_read, priority), GET /notifications/unread-count, POST /{id}/read, POST /read-all, DELETE /{id}, POST / (admin create)

**Search Polish (Phase 7):**

- PropertyRepository.search already has structured filters (type, transaction, status, city_code, district_code, price, area, parking, elevator, rooms, q LIKE) — کافی برای Local (بند 83)
- SavedSearchService.find_matches uses PropertyService.search — برای بند 37
- Future: PostgreSQL Full Text Search, Natural Language via AI Adapter — Architecture ready, not implemented yet (Simplicity Rule بند 90)

**Frontend:**

- api.ts: listVisits, createVisit, updateVisit, listNotifications, getUnreadCount, markNotificationRead, markAllNotificationsRead
- App.tsx: Tabs added Visits and Notifications, Visit Create Form (property_id, customer_id, date, time), Notification list with priority badges (critical=red, important=orange, normal=blue, informational=gray), unread highlight, mark all read, unread count in header

**Events (Future):**

- VisitScheduled → Notification (implemented directly in VisitService.create)
- Future: Domain Events via Outbox: PropertyCreated, VisitScheduled, DealClosed, etc. (بند 54)

## Alternatives

- **Visit بدون Agent:** Agent الزامی نیست — default current user
- **Notification بدون Channel abstraction:** فقط in_app — اما از ابتدا channel field داریم تا Provider قابل تعویض باشد (بند 89 No Vendor Lock-in)
- **Push via Firebase مستقیم:** تحریم — باید Adapter باشد

## Consequences

**مثبت:**
- Visit CRUD کامل با Tenant Isolation 404
- Notification Core مستقل از Provider — channel abstraction از روز اول
- Priority badges برای UX (Critical/Important/Normal/Info)
- Unread count + mark read/all read
- Visit creation automatically creates notification for agent — Action-oriented Dashboard (بند 14)
- Tests: 3 new (CRUD+notification, tenant isolation, priority filter) — total 37 passed
- Migration: 84455b931380_add_visits_and_notifications

**منفی:**
- Notification delivery فعلا فقط in_app — Telegram/SMS/Push adapter آینده
- Visit → Property → Person JOIN در لیست انجام نمی‌شود (فقط ID) — برای Performance فعلا ID کافی, Detail می‌تواند JOIN کند
- No real-time (WebSocket) — فعلا Polling, آینده می‌تواند اضافه شود

**Future:**

- Telegram Adapter برای Notification (Bot + Deep Link)
- Visit Calendar view در Frontend
- Deal ارتباط با Visit (Visit → Deal pipeline بند 39)
- Notification for Saved Search matches: هنگام ساخت Property جدید, چک کردن Saved Searches و ایجاد Notification (بند 37) — Service آماده است
