# ADR-0012 — Deals & Commission Domain (Phase 9)

- **Date:** 2026-09-21
- **Status:** Accepted
- **Phase:** Phase 9 Deals / Commission (بند 39, 40, 87)

## Context

- **Deal** مستقل از Property است (بند 39): یک معامله می‌تواند بدون ملک ثبت شود، بعداً ملک لینک شود
- Pipeline: Lead → Qualification → Property Match → Visit → Negotiation → Agreement → Closed (closed_won / closed_lost / archived) (بند 39)
- هر مرحله باید History داشته باشد (بند 39)
- Code generation: DL-YYMM-00001 (مثل DL-2609-00001) — atomic via code_sequences
- Customer (person) الزامی، Property اختیاری، Agent (user)، Amount، Commission (total/agent_share/office_share/referral_share)، Status کمیسیون (pending/partially_paid/paid/cancelled)، Notes/LossReason
- Notifications روی create و status change (بند 87)
- Tenant isolation 404، optimistic locking، soft delete
- Commission accounting جدا در آینده (بند 40)

چگونه Deal را به‌صورت Modular Monolith پیاده کنیم که مستقل از Property باشد، Pipeline قابل توسعه باشد، و Commission محاسبه شود؟

## Decision

**Models:**

1. **deals:**
   - organization_id, branch_id, code unique human-readable (DL-YYMM-00001), code_period (YYMM), code_sequence (int)
   - title (500), status enum (lead, qualification, property_match, visit, negotiation, agreement, closed_won, closed_lost, archived) default lead
   - customer_id FK persons RESTRICT (الزامی), property_id FK properties SET NULL nullable (مستقل per بند 39), agent_id FK users SET NULL nullable
   - amount BigInt nullable, commission_total BigInt nullable, commission_agent_share BigInt, commission_office_share BigInt, commission_referral_share BigInt
   - commission_status enum (pending, partially_paid, paid, cancelled) default pending
   - notes Text nullable, loss_reason Text nullable (برای closed_lost)
   - Indexes: organization_id+status, customer_id, property_id, agent_id, code unique
   - TenantEntity + BaseEntity

2. **deal_status_history:**
   - organization_id, branch_id, deal_id FK deals CASCADE
   - from_status nullable, to_status (status enum), changed_by FK users SET NULL, notes Text nullable
   - Indexes: organization_id+deal_id, deal_id
   - TenantEntity (organization_id from deal)

**Code Generation:**

- scope = "deal" در code_sequences
- period = YYMM UTC (e.g. 2609 برای 2026-09)
- sequence = 5 digits: DL-{period}-{seq:05d} → DL-2609-00001
- Atomic via CodeSequenceRepository.next_value (SELECT FOR UPDATE pattern with unique constraint)

**Pipeline Validation:**

```python
VALID_TRANSITIONS = {
  "lead": ["qualification", "closed_lost", "archived"],
  "qualification": ["property_match", "closed_lost", "archived"],
  "property_match": ["visit", "closed_lost", "archived"],
  "visit": ["negotiation", "closed_lost", "archived"],
  "negotiation": ["agreement", "closed_lost", "archived"],
  "agreement": ["closed_won", "closed_lost", "archived"],
  "closed_won": ["archived"],
  "closed_lost": ["lead", "archived"],  # reopen allowed
  "archived": [],
}
```

- create با status = lead (default) یا هر status اولیه
- update: اگر status تغییر کند → validate transition, create history entry
- History: هر تغییر status → DealStatusHistory entry با from_status, to_status, changed_by, notes

**Permissions:**

- deal:create, deal:read, deal:update, deal:delete
- commission:read, commission:manage
- Added to ALL_PERMISSIONS and System Roles:
  - ORG_ADMIN: all
  - BRANCH_ADMIN: all deals + commission
  - AGENT: create/read/update deals, read commission

**Services:**

- **DealService:**
  - create: validate customer exists (TenantRepository), property exists if provided (optional), agent default current user, generate code via CodeSequenceRepository, create Deal, create DealStatusHistory (from_status None → to_status), create Notification in_app important: "معامله جدید: {title}" for agent/creator
  - list: filters status, customer_id, property_id, agent_id, q LIKE title/code
  - get_by_id, get_by_code (Deep Link)
  - update: validate status transition if status changed, optimistic locking via version, create history entry, notification on status change (important for normal, critical for closed)
  - delete: soft delete
  - get_history: list DealStatusHistory for deal ordered by created_at asc

- **Commission:** فعلاً فیلدهای ساده در Deal (total, agent_share, office_share, referral_share, status). Accounting جدا در آینده (بند 40) — Domain جدا ledger, payments

**API:**

- POST /deals — create, idempotency optional, returns DealResponse
- GET /deals — list with filters status, customer_id, property_id, agent_id, q, pagination
- GET /deals/by-code/{code} — Deep Link /d/{code} future, returns DealResponse
- GET /deals/{id} — detail
- GET /deals/{id}/history — list history entries
- PATCH /deals/{id} — update with version, status transition validated
- DELETE /deals/{id} — soft delete

**Notifications:**

- On create: title "معامله جدید: {title}", body includes code, priority important, entity_type deal, entity_id deal.id
- On status change: title "تغییر وضعیت معامله: {code}", body "{from} → {to}", priority important, critical if closed_won/closed_lost
- Recipient: agent_id or current user (creator)

**Frontend:**

- api.ts: listDeals, getDeal, getDealByCode, createDeal, updateDeal, getDealHistory
- App.tsx: Tab "معاملات", Deal Create Form (title, customer_id, property_id optional, amount, commission_total), Pipeline badge, Next Stage button, History viewer

## Alternatives

- **Deal حتماً Property داشته باشد:** رد شد — بند 39 صراحتاً می‌گوید مستقل از Property
- **Status به‌صورت آزاد (بدون validation):** رد شد — Pipeline باید enforce شود تا گزارش‌دهی درست باشد
- **Code بدون period:** رد شد — period YYMM برای گزارش ماهانه و جلوگیری از sequence بزرگ
- **Commission جدا از Deal از روز اول:** رد شد — بند 40 می‌گوید Accounting جدا آینده، فعلاً فیلدهای ساده کافی است (Simplicity Rule بند 90)

## Consequences

**مثبت:**
- Deal مستقل از Property — تست test_deal_without_property پاس
- Pipeline کامل Lead → ... → Closed با validation — تست pipeline پاس (7 مرحله + 7 history)
- History tracking — هر تغییر status ثبت می‌شود
- Code generation atomic DL-YYMM-00001
- Commission fields ساده اما قابل توسعه به Accounting جدا
- Notifications روی create و status change — Action-oriented Dashboard (بند 14, 87)
- Tenant isolation 404 — test_deal_tenant_isolation پاس
- Optimistic locking via version
- Deep Link by code: /deals/by-code/{code}
- Tests: 3 new (CRUD+pipeline+history+notification+commission, without_property, tenant_isolation) — total 40 passed
- Migration: 30be32e888f7_add_deals_and_commission

**منفی:**
- Commission accounting جدا هنوز نیست — فقط فیلدهای ساده
- Deal → Visit ارتباط مستقیم ندارد (فقط از طریق Property/Customer) — آینده می‌تواند deal_id در visits اضافه شود
- No commission calculation automation — فعلاً دستی
- Frontend هنوز Pipeline visualization ندارد (Kanban board آینده)

**Future:**

- Accounting Domain جدا: ledger, payments, commission distribution
- Deal ↔ Visit linkage (visit.deal_id)
- Kanban board برای Pipeline در Frontend
- Commission auto-calculation based on rules
- Deal documents / contracts upload
- Deal Deep Link /d/{code} برای Public (اگر Public Platform بخواهد)
