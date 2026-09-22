# AREP — MASTER PROJECT CONSTITUTION

## Alibaba Real Estate Platform

**Local-First → PWA → Android/iOS → Public Web → Multi-Tenant Platform**

---

### 0. مهم‌ترین دستور این سند

این سند، قرارداد مادر پروژه AREP است.

هر هوش مصنوعی، Agent، برنامه‌نویس یا تیمی که روی این پروژه کار می‌کند باید این سند را به‌عنوان یکی از منابع اصلی پروژه در نظر بگیرد.

اما این سند به‌تنهایی Source of Truth کامل نیست.

**Source of Truth واقعی پروژه مجموعه زیر است:**

- PROJECT_CONSTITUTION.md
- ARCHITECTURE.md
- DATABASE.md
- API_CONTRACT.md
- UI_UX.md
- ROADMAP.md
- ADR/
- Source Code
- Database Migrations
- Tests
- Git History

اگر بین حافظه AI و Repository اختلافی وجود داشت:

**Repository و مستندات پروژه بر حافظه AI اولویت دارند.**

اگر بین این سند و کد موجود اختلافی وجود داشت:

1. اختلاف را گزارش کن.
2. علت را بررسی کن.
3. بدون تأیید، معماری را تغییر نده.
4. تصمیم نهایی را در Documentation ثبت کن.

---

### 1. هویت پروژه

**نام:** Alibaba Real Estate Platform
**نام کوتاه:** AREP
**برند:** املاک علی‌بابا
**مدیر محصول:** حامد کریمی
**شعار:** «معامله ملکی، مهندسیِ حساب و کتاب است؛ اینجا بر اساس منطق و آینده‌نگری قدم برمی‌داریم.»

---

### 2. Vision

هدف، ساخت یک سیستم حرفه‌ای و چندساله برای صنعت املاک است که در ابتدا برای املاک علی‌بابا ساخته می‌شود اما Architecture آن از ابتدا قابلیت تبدیل شدن به یک Platform را داشته باشد.

سیستم باید برای دو گروه اصلی قابل استفاده باشد:

**A. کاربران داخلی**
- مدیر
- مدیر شعبه
- ادمین
- مشاور املاک
- همکار
- کارمند
- نقش‌های عملیاتی آینده

**B. کاربران عمومی**
- مالک
- خریدار
- مستأجر
- سرمایه‌گذار
- سازنده
- فروشنده
- متقاضی ملک
- واسطه
- سایر کاربران آینده

---

### 3. هدف Platform

AREP نباید صرفاً یک CRM داخلی باشد.

در معماری نهایی باید بتواند به‌صورت همزمان:

- Internal Real Estate Management
- Public Property Platform
- CRM
- Property Search
- Deal Management
- Communication
- Automation

را پشتیبانی کند.

---

### 4. اصل Cross-Platform

هدف نهایی این است که یک Codebase اصلی داشته باشیم که بتواند روی:

- Android
- iOS
- Windows
- macOS
- Linux
- Tablet
- Mobile Browser
- Desktop Browser

قابل استفاده باشد.

برای این منظور **Web Application / PWA** رابط اصلی است.

نباید برای Android و iOS دو پروژه جداگانه ایجاد کنیم مگر اینکه در آینده نیاز واقعی و اثبات‌شده‌ای وجود داشته باشد.

---

### 5. چرا Web App / PWA؟

چون می‌خواهیم:

- یک Codebase داشته باشیم.
- Android و iOS را پوشش دهیم.
- Desktop را نیز پوشش دهیم.
- نصب روی موبایل ممکن باشد.
- انتشار سریع باشد.
- وابستگی به App Store/Google Play در فاز اول حداقل باشد.
- امکان استفاده مستقیم از Browser وجود داشته باشد.
- در آینده امکان تبدیل به Native Wrapper در صورت نیاز وجود داشته باشد.

بنابراین **PWA-first** یکی از اصول اصلی پروژه است.

---

### 6. Local-First

نسخه اول باید بتواند بدون نیاز اجباری به Server عمومی روی Android اجرا شود.

هدف:

```
Android
↓
Termux / Local Runtime
↓
AREP Backend
↓
AREP Web App
↓
Browser / PWA
```

اما نسخه Local نباید Prototype دورریختنی باشد. همان Core باید بعدها روی Server اجرا شود.

---

### 7. معماری کلان

```
                 AREP
                   │
           Application Core
                   │
          ┌────────┴────────┐
          │                 │
      Local Runtime      Cloud Runtime
          │                 │
        SQLite          PostgreSQL
          │                 │
       Android           Server
          │                 │
          └────────┬────────┘
                   │
             React + PWA
                   │
       ┌───────────┼───────────┐
       │           │           │
   Telegram       AI       Notifications
   Adapter       Adapter       Adapter
```

**اصول:**
- API-first
- Modular Monolith
- Domain-driven
- Clean Architecture
- Local-first
- PWA-first
- Multi-tenant ready
- Event-driven ready
- AI-ready
- Cloud-ready

---

### 8. Modular Monolith

در فاز اول Microservices ممنوع است مگر اینکه دلیل واقعی و مستند وجود داشته باشد.

Backend یک Modular Monolith خواهد بود.

مثلاً:

```
AREP Backend
│
├── Identity
├── Organizations
├── Properties
├── CRM
├── Visits
├── Deals
├── Notifications
├── Media
└── Analytics
```

اما مرز Domainها باید از ابتدا واقعی و واضح باشد. در آینده هر Domain در صورت نیاز قابلیت جدا شدن داشته باشد.

---

### 9. Clean Architecture

ساختار منطقی:

```
API
 ↓
Application / Service
 ↓
Domain
 ↓
Repository
 ↓
Infrastructure
```

Business Logic نباید مستقیماً در API نوشته شود.

---

### 10. Frontend Architecture

Frontend با React + TypeScript ساخته شود.

معماری Feature-Based:

```
frontend/src/

app/

features/
├── auth/
├── properties/
├── customers/
├── visits/
├── deals/
├── notifications/
├── search/
├── favorites/
└── settings/

shared/
├── ui/
├── forms/
├── hooks/
├── utils/
├── types/
└── services/
```

هر Feature باید تا حد ممکن مستقل باشد.

---

### 11. Design System

از ابتدا یک Design System داخلی ساخته شود.

نمونه:

- Button, Input, Select, DatePicker, Modal, Drawer, BottomSheet, Card, Badge, Table, Tabs, Toast, Dialog, EmptyState, LoadingState, ErrorState

هیچ Feature نباید بدون دلیل Component اختصاصی مشابه Component موجود بسازد.

هدف: Consistency, Speed, Maintainability, Professional UI

---

### 12. UI/UX

UI باید:

- Persian-first
- RTL
- Mobile-first
- Touch-friendly
- سریع
- تمیز
- مینیمال
- حرفه‌ای
- قابل فهم

باشد.

**رنگ برند:**
- Deep Petrol Blue: #1B3A5C
- Gold: #C9A84C
- White: #F5F5F5
- Light Gray: #E0E0E0

---

### 13. Mobile UX

Mobile نباید Desktop کوچک‌شده باشد. Navigation باید برای انگشت طراحی شود.

در Mobile می‌توان از:

- Bottom Navigation
- Bottom Sheet
- Floating Action Button
- Swipe
- Large Touch Targets

استفاده کرد.

Desktop می‌تواند Sidebar + Content داشته باشد.

---

### 14. Dashboard

Dashboard باید Action-oriented باشد.

اول:
- کارهای امروز
- بازدیدها
- Follow-upها
- معاملات
- فایل‌های جدید

بعد:
- آمار
- نمودار
- گزارش

Dashboard نباید با نمودارهای غیرضروری شلوغ شود.

---

### 15. Search

Search یکی از Core Featureهای AREP است. Search باید ابتدا Structured باشد.

مثلاً: نوع ملک, محدوده, متراژ, قیمت, نوع معامله, تعداد اتاق, پارکینگ, آسانسور, انباری, امکانات

اما Architecture باید آماده Natural Language Search نیز باشد.

مثلاً: «آپارتمان ۱۵۰ متری مرداویج تا ۲۰ میلیارد، پارکینگ و آسانسور»

در آینده AI این جمله را به Query ساختاریافته تبدیل کند.

---

### 16. AI Architecture

AI نباید Core سیستم باشد.

```
AREP Core
     ↑
AI Adapter
     ↑
AI Provider
```

Provider می‌تواند در آینده OpenAI, Gemini, Claude, Local LLM باشد. تعویض AI Provider نباید باعث تغییر Business Logic شود.

---

### 17. AI Independence

پروژه نباید به هیچ AI خاصی وابسته باشد.

مثلاً Claude محدود شد؟ → Codex, Codex محدود شد؟ → Gemini

هیچ‌کدام نباید باعث توقف پروژه شوند.

برای این هدف Documentation, Git, Tests, Architecture, API Contracts, Database Migrations, ADR باید در خود Repository نگهداری شوند.

---

### 18. AI Handoff Protocol

هر AI که وارد پروژه می‌شود باید ابتدا:

1. Repository را بخواند.
2. Documentation را بخواند.
3. Git history را بررسی کند.
4. وضعیت فعلی را تشخیص دهد.
5. Featureهای موجود را شناسایی کند.
6. Tests را بررسی کند.
7. Migrationها را بررسی کند.
8. تغییرات Uncommitted را بررسی کند.

سپس گزارش دهد: Current State, Known Issues, Completed Features, Pending Work, Recommended Next Step

و بدون تأیید وارد تغییر معماری نشود.

---

### 19. No AI Lock-in

هیچ دانش مهم پروژه نباید فقط در Chat History باقی بماند. هر تصمیم مهم باید به Repository منتقل شود.

مثلاً `docs/decisions/ADR-0001.md` — این اصل حیاتی است.

---

### 20. Database

- Local: SQLite
- Production: PostgreSQL

اما Domain و Business Logic نباید به Database خاص وابسته باشند.

هدف: SQLite → PostgreSQL با کمترین تغییر ممکن.

---

### 21. ORM

SQLAlchemy استفاده شود. Migration: Alembic. هر تغییر Schema باید Migration داشته باشد. Database دستی تغییر داده نشود.

---

### 22. Core Property Model

Property Model باید Layered و Flexible باشد.

ساختار مفهومی:

```
Property Core
+
Usage
+
Physical Characteristics
+
Location
+
Financial Terms
+
Transaction Terms
+
Media
+
Legal Information
+
Extended Attributes
```

---

### 23. Property Types

حداقل: Residential, Apartment, Villa, Garden, Commercial, Administrative / Office, Land, Industrial / Factory, Mixed Use

معماری باید امکان اضافه کردن Typeهای جدید را بدون تغییرات مخرب فراهم کند.

---

### 24. Mixed Use

ملک می‌تواند همزمان چند Usage داشته باشد. مثلاً Residential + Administrative, Commercial + Administrative, Commercial + Residential. بنابراین Usage نباید فقط یک Enum ساده باشد.

---

### 25. Area

بسته به Property:

- Land Area
- Built Area
- Useful Area
- Net Area
- Floor Area
- Other Dimensions

قابل ثبت باشد.

---

### 26. Transaction Types

حداقل: Sale, Rent, Exchange, Partnership

---

### 27. Exchange

Exchange ممکن است شامل Property, Car, Gold, Other Assets باشد. بنابراین ساختار Exchange باید Flexible باشد.

---

### 28. Construction Partnership

دو بخش:

**Land**
- area, frontage, dimensions, existing building, zoning, location, legal information

**Partnership**
- owner share, builder share, owner contribution, builder contribution, schedule, number of units, construction terms

---

### 29. Property Registration

ثبت‌کننده می‌تواند Owner, Intermediary, Agent, Office Staff باشد.

اگر Intermediary باشد: نام و شماره مالک الزاماً لازم نیست.

---

### 30. Privacy

کاربر عمومی نباید اطلاعاتی دریافت کند که امکان bypass کردن دفتر را ایجاد کند.

بنابراین آدرس دقیق, شماره مالک, اطلاعات خصوصی مالک نباید عمومی باشد. مکان عمومی می‌تواند در سطح کنترل‌شده نمایش داده شود.

---

### 31. Media

Property می‌تواند Images, Videos, Documents داشته باشد.

Media Storage باید abstraction داشته باشد.

- Local: Filesystem
- Production: Object Storage / Server Storage

---

### 32. Property Code

Code یکتا: `AB-ISF-MJ-AP-S-2608-00124`

اما قبل از Production باید پایداری Location Code بررسی شود.

Code باید Unique, Searchable, Human-readable, Analyzable باشد.

Sequence باید با `code_sequences` مدیریت شود.

---

### 33. Listing Lifecycle

```
Draft → Pending Review → Approved → Published → Reserved → Sold / Rented → Archived
```

Lifecycle باید قابل توسعه باشد.

---

### 34. CRM

CRM باید افراد را مستقل از Business Role نگهداری کند.

یک Person می‌تواند همزمان Owner, Buyer, Tenant, Seller, Investor, Landlord, Developer, Intermediary باشد.

---

### 35. Customer Requests

Request می‌تواند شامل transaction type, property type, location, budget, area, rooms, amenities, special requirements باشد.

---

### 36. Favorites

User بتواند Property را Favorite کند.

---

### 37. Saved Search

User بتواند Search را ذخیره کند. Matching Property جدید → Notification

---

### 38. Visits

Visit شامل Property, Customer, Agent, Date, Time, Status, Notes باشد.

---

### 39. Deals

Deal مستقل از Property باشد.

Pipeline:

```
Lead → Qualification → Property Match → Visit → Negotiation → Agreement → Closed
```

---

### 40. Commission

در آینده: Total Commission, Agent Share, Office Share, Referral Share, Payment Status پشتیبانی شود. Accounting کامل Domain جداگانه باشد.

---

### 41. Notifications

Notification Core مستقل از Provider. Channelهای آینده: In-App, Telegram, SMS, Push, Email

---

### 42. Telegram

Telegram نباید Core UI باشد. Telegram یک Integration Adapter است.

استفاده‌های احتمالی: Login, Notification, Bot, Deep Link, Communication

---

### 43. Authentication

Identity Core مستقل از Authentication Provider باشد.

Providerها: Local/Phone, Telegram, Future OAuth/other providers

---

### 44. Telegram Security

Telegram WebApp InitData باید HMAC-SHA256 Validation داشته باشد.

---

### 45. JWT

Claimهای مهم: user_id, organization_id, branch_id, roles, permissions_version, session_id

Role/Permission change → permissions_version افزایش یابد. Tokenهای قدیمی قابل invalidation باشند.

---

### 46. RBAC

Roleها: Super Admin, System Admin, Organization Admin, Branch Admin, Operational Admin, Observer

Permissions granular باشند.

مثلاً:

```
property.create, property.read, property.update, property.delete, property.approve
customer.create, customer.read, customer.update
deal.create, deal.read, deal.update
user.manage, role.manage, organization.manage, branch.manage
```

---

### 47. Multi-Tenant

Tenant فعلی: Alibaba

اما Architecture باید امکان Organization A, B, C را فراهم کند.

Tenant Isolation در API, Service, Repository, Database رعایت شود.

Production PostgreSQL: RLS واقعی

---

### 48. Security Rule

اگر User متعلق به Tenant دیگری باشد: 404 نه 403 تا وجود رکورد افشا نشود.

---

### 49. API

API-first. Version: /api/v1, /api/v2

Response:

```json
{
  "success": true,
  "data": {},
  "meta": {},
  "error": null
}
```

Health می‌تواند استثنا باشد.

---

### 50. API Standards

در Implementation: Cursor Pagination, Optimistic Locking, Idempotency-Key, Request ID, Standard Error Codes, API Versioning رعایت شود.

---

### 51. Base Entity

Base fields: id, organization_id, branch_id, created_at, updated_at, created_by, updated_by, is_deleted, deleted_at, deleted_by, version

---

### 52. Audit

Audit Log برای عملیات حساس.

حداقل: user, organization, branch, action, entity, entity_id, old_value, new_value, timestamp, ip, user_agent

Audit Logs باید در Production برای رشد زیاد آماده partitioning ماهانه باشند.

---

### 53. Repository

```
API → Service → Repository → Database
```

---

### 54. Event Architecture

در فاز اول Event Bus کامل لازم نیست. اما Domain Events باید از ابتدا قابل اضافه شدن باشند.

مثلاً: PropertyCreated, PropertyApproved, VisitScheduled, DealClosed, PermissionChanged

---

### 55. Local Sync Architecture

در Local-first باید از ابتدا مفهوم Sync در نظر گرفته شود.

```
Local Change → Outbox / Sync Queue → Internet Available → Server Sync → Conflict Resolution
```

اما Sync Engine کامل فقط زمانی پیاده شود که نیاز واقعی به آن برسد.

---

### 56. Offline

Offline باید مرحله‌ای توسعه یابد.

- فاز اول: App Shell, Cached UI, Local Data
- فاز بعد: Offline Property Creation, Offline CRM, Sync, Conflict Resolution

---

### 57. PWA

PWA شامل Manifest, Service Worker, Installability, Caching, Update Strategy, Offline Strategy, Icons, Responsive UI باشد.

---

### 58. Performance

اصل: Fast by default

از ابتدا: Lazy Loading, Code Splitting, Pagination, Efficient Queries, Image Optimization, Caching, Debounced Search, Virtualized Lists در صورت نیاز در نظر گرفته شود.

---

### 59. Accessibility

UI باید تا حد امکان Keyboard-friendly, Screen-reader-friendly, Contrast-aware, Touch-friendly باشد.

---

### 60. Public vs Internal

سیستم باید دو Experience اصلی داشته باشد.

**Public** برای Search, View Listings, Favorites, Requests, Registration, Contact Office

**Internal** برای CRM, Property Management, Customers, Visits, Deals, Reports, Users, Permissions

این دو نباید از نظر امنیتی فقط با مخفی کردن UI از هم جدا شوند. Authorization باید Server-side باشد.

---

### 61. Public Property

Public Listing باید فقط اطلاعات مجاز را نمایش دهد. Private fields هرگز فقط با CSS یا Frontend مخفی نشوند. Backend باید Public DTO جداگانه داشته باشد.

---

### 62. Deep Links

هر Property باید URL پایدار داشته باشد. مثلاً `/p/AB-ISF-MJ-AP-S-2608-00124`

---

### 63. Documentation

Repository باید Documentation کامل داشته باشد.

```
docs/
architecture/
api/
database/
deployment/
decisions/
security/
development/
```

---

### 64. ADR

هر تصمیم معماری مهم: ADR-0001, ADR-0002, ... ثبت شود.

هر ADR شامل Context, Decision, Alternatives, Consequences باشد.

---

### 65. AI Handoff

هر AI باید بتواند فقط با Repository پروژه را ادامه دهد.

حداقل فایل‌های مهم:

- PROJECT_CONSTITUTION.md
- CURRENT_STATE.md
- ROADMAP.md
- CHANGELOG.md
- ARCHITECTURE.md
- DATABASE.md
- API_CONTRACT.md
- UI_UX.md
- CONTRIBUTING.md

---

### 66. CURRENT_STATE.md

این فایل باید همیشه وضعیت واقعی پروژه را نشان دهد:

- Current Phase
- Current Sprint
- Completed
- In Progress
- Blocked
- Known Issues
- Next Task
- Last Verified Commit

بعد از هر Sprint مهم Update شود. این فایل برای انتقال پروژه بین AIها حیاتی است.

---

### 67. CHANGELOG

تمام تغییرات مهم ثبت شوند.

مثلاً:

```
2026-09-20
Added Property Domain
Added Property Registration
Added Property Code Generator
Added Tests
```

---

### 68. CONTRIBUTING.md

قوانین کار روی پروژه: Branching, Commit, Testing, Migration, Code Review, Documentation

---

### 69. Testing

هر Feature مهم باید Test داشته باشد.

سطوح: Unit, Service, Repository, API, Integration, E2E

اما تست‌های سنگین فقط زمانی اضافه شوند که ارزش واقعی داشته باشند.

---

### 70. Git

Git Source of Truth است.

Commitها معنی‌دار:

```
feat(properties): add property registration
fix(crm): prevent duplicate customer
feat(auth): validate telegram init data
refactor(db): improve tenant isolation
```

---

### 71. Branching

برای Featureهای بزرگ: main, develop, feature/..., fix/...

در صورت ساده بودن پروژه، می‌توان workflow ساده‌تری داشت.

اصل مهم: main باید همیشه قابل بازیابی باشد.

---

### 72. Backup

قبل از تغییرات خطرناک: Database Backup, Git Commit, File Backup در نظر گرفته شود.

---

### 73. Secrets

هیچ Secretی وارد GitHub نشود. ".env" در ".gitignore". ".env.example" در Repository.

---

### 74. Deployment

Production:

```
Internet → HTTPS → Nginx → Frontend / PWA → FastAPI → PostgreSQL → Redis
```

Docker در Production قابل استفاده است. Docker نباید شرط اجرای Local روی Android باشد.

---

### 75. Local Development

Local باید تا حد ممکن ساده باشد.

در نهایت: `./scripts/start-local.sh` یا معادل Android-compatible.

هدف: Database + Backend + Frontend با حداقل دستور اجرا شوند.

---

### 76. Android

محیط اولیه: Android, Termux, Browser, GitHub, AI Coding Agent

در صورت عدم امکان اجرای تکنولوژی خاص روی Android، راه جایگزین ارائه شود.

---

### 77. iOS

iOS از طریق Safari, PWA Installation پشتیبانی شود. در صورت نیاز آینده می‌توان Native Wrapper اضافه کرد.

---

### 78. Native Apps

ساخت Native Android/iOS در فاز اول ممنوع. فقط اگر بعداً مشخص شد PWA محدودیت مهمی ایجاد می‌کند: Capacitor, React Native, Native Wrapper بررسی شود. Core نباید تغییر کند.

---

### 79. Public Platform

در آینده امکان Public Website: www.example.com و Application: app.example.com وجود داشته باشد. اما Domain واقعی بعداً تعیین می‌شود.

---

### 80. SEO

برای Public Property Pages در آینده: SEO, Structured Data, Open Graph, Share Preview, Search Engine Indexing در نظر گرفته شود.

---

### 81. Property Sharing

User باید بتواند Listing را Share کند. مثلاً Share, Telegram, WhatsApp, Copy Link ولی اطلاعات Private هرگز وارد Share URL عمومی نشود.

---

### 82. Notifications

Notificationها باید Priority داشته باشند: Critical, Important, Normal, Informational

---

### 83. Search Engine

در Local: Database Search کافی است. در Scale بالا: PostgreSQL Full Text Search و در آینده در صورت نیاز Search Engine تخصصی. از Elasticsearch/OpenSearch در روز اول استفاده نکن.

---

### 84. Caching

Cache فقط جایی استفاده شود که ارزش واقعی دارد. Redis در Server آماده باشد. Local نباید به Redis وابسته باشد مگر ضرورت داشته باشد.

---

### 85. Analytics

Analytics Domain جدا باشد. مثلاً Listings, Views, Searches, Leads, Visits, Deals, Conversion

---

### 86. Accounting

Accounting کامل فعلاً در Core نیست. اما Architecture باید برای اضافه شدن آن آماده باشد.

---

### 87. Contract Management

Contracts در آینده Domain جداگانه: Lease, Sale, Partnership, Attachments, Signatures, Legal Documents

---

### 88. Integrations

در آینده: Telegram, SMS, Divar, Sheypoor, Payment, Maps, AI Providers

هر Integration باید Adapter مستقل باشد.

---

### 89. No Vendor Lock-in

هیچ Provider خارجی نباید Core را قفل کند. Providerها باید قابل تعویض باشند.

---

### 90. Simplicity Rule

هر چیزی که امروز لازم نیست: فقط Architecture-ready شود. نباید صرفاً برای آینده Microservice, Kafka, Elasticsearch, Kubernetes, Complex Event Bus اضافه کنیم.

اصل: «ساده در شروع، حرفه‌ای در مرزها، آماده برای Scale.»

---

### 91. Development Method

هر Sprint:

1. Inspect
2. Analyze
3. Identify affected modules
4. Plan
5. Ask approval
6. Implement
7. Test
8. Review
9. Document
10. Commit
11. Update CURRENT_STATE.md

---

### 92. AI Coding Rules

AI نباید:

- فایل‌های موجود را بدون بررسی overwrite کند.
- Database را دستی تغییر دهد.
- Secret ایجاد یا Commit کند.
- Architecture را بدون دلیل تغییر دهد.
- Dependency غیرضروری اضافه کند.
- Feature ناقص تحویل دهد.
- تست‌های شکست‌خورده را نادیده بگیرد.
- خطا را با حذف قابلیت حل کند.

---

### 93. وقتی AI به Limit خورد

AI جدید باید بتواند پروژه را از Repository ادامه دهد.

دستورالعمل:

Read: PROJECT_CONSTITUTION.md, CURRENT_STATE.md, ROADMAP.md, ARCHITECTURE.md, CHANGELOG.md

سپس: git status, git log و پروژه را ادامه دهد.

هیچ دانش حیاتی نباید فقط در AI قبلی باقی مانده باشد.

---

### 94. Current State Handoff

هر AI قبل از پایان کار مهم باید:

1. تغییرات را Commit کند.
2. Tests را اجرا کند.
3. CURRENT_STATE را Update کند.
4. CHANGELOG را Update کند.
5. Migrationها را ثبت کند.
6. کارهای باقی‌مانده را مستند کند.

---

### 95. Definition of Done

یک Feature زمانی Done است که:

- Code complete
- Tests pass
- Security checked
- Migration ready
- Documentation updated
- UI usable
- Mobile checked
- API documented
- Git committed

باشد.

---

### 96. Roadmap

- Phase 0: Project Constitution + Documentation
- Phase 1: Local Runtime
- Phase 2: Core Backend
- Phase 3: Frontend + Design System
- Phase 4: Identity / RBAC
- Phase 5: Property Engine
- Phase 6: CRM
- Phase 7: Search / Favorites / Saved Searches
- Phase 8: Visits / Notifications
- Phase 9: Deals / Commission
- Phase 10: PWA / Offline
- Phase 11: Server / PostgreSQL / Redis
- Phase 12: Public Platform
- Phase 13: Multi-Tenant
- Phase 14: AI / Automation
- Phase 15: Integrations / Advanced Platform

---

### 97. First Release Goal

اولین Release واقعی باید کوچک ولی قابل استفاده باشد.

حداقل: Login, Dashboard, Property Registration, Property List, Property Search, Property Detail, Customer Registration, Customer List, Basic Visit, Favorites, Basic Notifications

نه اینکه از روز اول تمام قابلیت‌های آینده ساخته شوند.

---

### 98. UX Goal

کاربر باید بتواند بدون آموزش طولانی:

```
ثبت ملک → جستجو → مشاهده → ثبت مشتری → ثبت درخواست → بازدید → پیگیری
```

را انجام دهد.

---

### 99. Performance Goal

هدف: سریع, سبک, کم‌مصرف, Mobile-friendly, Network-efficient باشد.

هیچ تکنولوژی سنگینی صرفاً برای «حرفه‌ای به نظر رسیدن» اضافه نشود.

---

### 100. Final Product

```
                 AREP
                  │
        ┌─────────┴─────────┐
        │                   │
   Public Platform      Internal CRM
        │                   │
        └─────────┬─────────┘
                  │
             AREP Core
                  │
       ┌──────────┼──────────┐
       │          │          │
     Local      PWA       Server
       │          │          │
    Android      iOS      Web/Desktop
                  │
        ┌─────────┼─────────┐
        │         │         │
      AI      Telegram    Other APIs
```

---

### 101. دستور شروع برای هر AI

هر AI جدیدی که این سند را دریافت می‌کند، حق ندارد فوراً کدنویسی را شروع کند.

ابتدا:

- STEP 1: Repository را بررسی کن.
- STEP 2: Documentation را بخوان.
- STEP 3: Git status و history را بررسی کن.
- STEP 4: CURRENT_STATE را بررسی کن.
- STEP 5: Architecture فعلی را با این Constitution مقایسه کن.
- STEP 6: اختلاف‌ها را گزارش کن.
- STEP 7: وضعیت فعلی را خلاصه کن.
- STEP 8: فقط یک Next Step پیشنهاد بده.

سپس منتظر تأیید بمان.

---

### 102. دستور مهم برای AI

اگر چیزی را نمی‌دانی: حدس نزن.

اگر فایل یا تصمیمی در Repository وجود ندارد: بگو وجود ندارد.

اگر بین دو سند تضاد است: تضاد را اعلام کن.

اگر یک تصمیم معماری جدید لازم است: پیشنهاد بده و منتظر تأیید بمان.

---

### 103. اصل نهایی پروژه

AREP باید:

- قابل استفاده باشد، نه فقط قابل نمایش.
- قابل توسعه باشد، نه فقط قابل اجرا.
- قابل انتقال بین AIها باشد، نه وابسته به یک AI.
- قابل انتقال از Android به Server باشد، نه وابسته به Localhost.
- قابل استفاده برای تیم داخلی باشد، نه فقط برای مدیر.
- قابل استفاده برای مردم عادی باشد، نه فقط مشاوران.

و مهم‌تر از همه:

**«هیچ تصمیم امروز نباید بدون دلیل مسیر رشد فردای سیستم را خراب کند.»**
