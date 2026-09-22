# ADR-0007 — Property Code جدا از Sequence

- **Date:** 2026-09-18
- **Status:** Accepted

## Context

Property Code باید یکتا, قابل جستجو, خوانا و قابل تحلیل باشد: `AB-ISF-MJ-AP-S-2608-00124`

- AB: برند (Alibaba)
- ISF: شهر (Isfahan)
- MJ: محله (Mardavij)
- AP: نوع (Apartment)
- S: معامله (Sale)
- 2608: سال/ماه (1404/05 → 2608 میلادی؟ یا 1404 شمسی؟ باید بررسی شود)
- 00124: Sequence

اگر فرمت Code در DB ذخیره شود, تغییر فرمت در آینده داده‌های قبلی را خراب می‌کند. چگونه Sequence را از Formatting جدا کنیم؟

## Decision

جدول `code_sequences` فقط شمارنده را نگه می‌دارد (`organization_id, scope, period`)؛ قالب‌بندی در Service Layer انجام می‌شود.

```python
# code_sequences
organization_id, scope="property", period="2608", last_value=124

# Service
def generate_property_code(org_id, city, district, prop_type, trans_type):
    seq = increment_sequence(org_id, "property", period)
    return f"AB-{city}-{district}-{prop_type}-{trans_type}-{period}-{seq:05d}"
```

- `scope`: نوع کد (property, deal, invoice...)
- `period`: برای Reset ماهانه/سالانه (اختیاری)
- `last_value`: شمارنده

## Alternatives

- **Code کامل در DB:** تغییر فرمت سخت
- **UUID:** خوانا نیست, قابل تحلیل نیست
- **Sequence دیتابیس (SERIAL):** قابل تنظیم per org/period نیست

## Consequences

**مثبت:**
- تغییر قالب بدون Migration داده‌های قبلی
- Sequence per organization, per period
- قابل تست

**منفی:**
- نیاز به Lock برای جلوگیری از Race Condition (SELECT FOR UPDATE در PostgreSQL, یا transaction در SQLite)
- فرمت باید در یک جا متمرکز باشد (Service)

**Future:**
- بررسی پایداری Location Code قبل از Production (بند 32)
- آیا ISF/MJ ثابت می‌ماند اگر نام محله تغییر کند؟
- پیشنهاد: Code شامل ID محله نباشد یا Mapping جدا داشته باشد
