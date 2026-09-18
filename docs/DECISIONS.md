# Architecture Decision Records — AREP

## ADR-001 — SQLite برای توسعه، PostgreSQL برای Production
**مسئله:** محیط اصلی توسعه، گوشی Android + Termux است و Docker/PostgreSQL روی آن عملاً قابل اجرا نیست.
**تصمیم:** لایه دسترسی داده کاملاً از طریق SQLAlchemy async نوشته می‌شود؛ `DATABASE_URL` تنها نقطه تفاوت است.
نوع ستون‌ها با `BigInteger().with_variant(Integer, "sqlite")` قابل حمل شده و Alembic با `render_as_batch`
روی SQLite کار می‌کند.
**نتیجه:** هیچ کدی هنگام انتقال به سرور تغییر نمی‌کند. ویژگی‌های اختصاصی PostgreSQL (JSONB، RLS، PostGIS)
تا زمانی که سرور اصلی نیامده استفاده نمی‌شوند.

## ADR-002 — Tenant Isolation در لایه Repository (فعلاً بدون RLS)
**مسئله:** Master Spec خواستار Isolation در چهار لایه است (DB/RLS، Repository، Service، API)؛
اما SQLite از RLS پشتیبانی نمی‌کند.
**تصمیم:** `TenantRepository` فیلتر `organization_id` را به‌صورت مرکزی در `_base_select` و `create`
اعمال می‌کند و مقدار آن را فقط از Request Context می‌خواند، نه از ورودی کاربر.
**وضعیت:** RLS به‌عنوان لایه دوم دفاعی هنگام مهاجرت به PostgreSQL اضافه می‌شود (Migration جداگانه،
Backward Compatible، چون فیلترها همین حالا اعمال می‌شوند).

## ADR-003 — Permission از Token خوانده نمی‌شود
**مسئله:** اگر Permission داخل JWT ذخیره و مبنای تصمیم باشد، تغییر دسترسی تا انقضای Token اثر ندارد.
**تصمیم:** JWT فقط انتخاب Tenant و `permissions_version` را حمل می‌کند؛ Roles/Permissions در هر Request
از دیتابیس resolve می‌شوند. با افزایش `users.permissions_version` تمام Tokenهای قبلی همان کاربر بی‌اعتبار می‌شوند.
**هزینه:** یک Query اضافه در هر Request محافظت‌شده — قابل Cache شدن با Redis در آینده بدون تغییر API.

## ADR-004 — تفکیک Authentication از Authorization
Telegram فقط هویت را با HMAC-SHA256 روی `initData` اثبات می‌کند (`app/core/security.py`).
سازمان، شعبه، نقش و دسترسی کاملاً در AREP تعیین می‌شود. `auth_date` بررسی می‌شود تا initData قدیمی
قابل استفاده مجدد نباشد.

## ADR-005 — پاسخ 404 برای Tenant دیگر
دسترسی به منبعِ سازمان دیگر `404` می‌گیرد، نه `403`، تا وجود منبع افشا نشود
(تست: `tests/test_tenant_isolation.py`).

## ADR-006 — Idempotency در سطح دیتابیس
جدول `idempotency_keys` اولین پاسخ موفق را برای هر `(organization, endpoint, key)` نگه می‌دارد و
Retry همان بدنه، همان پاسخ را برمی‌گرداند. استفاده مجدد کلید با بدنه متفاوت خطای
`IDEMPOTENCY_KEY_REUSED` می‌دهد. Redis لازم نیست، پس روی Termux و cPanel هم کار می‌کند.

## ADR-007 — Property Code جدا از Sequence
جدول `code_sequences` فقط شمارنده را نگه می‌دارد (`organization_id, scope, period`)؛ قالب‌بندی
`ISF-MJ-AP-S-2608-00124` در Service Layer انجام می‌شود تا تغییر قالب، داده‌های قبلی را خراب نکند.

## ADR-008 — بدون وابستگی به سرویس‌های تحریم‌شده
تمام Dependencyها Open Source و Self-hosted هستند: FastAPI، SQLAlchemy، Alembic، PyJWT، React، Vite،
PostgreSQL، Redis، Nginx. هیچ SDK ابری، سرویس پرداخت خارجی یا AI API خارجی در مسیر اصلی وجود ندارد.
تنها منبع خارجی، اسکریپت `telegram-web-app.js` است که خود تلگرام سرو می‌کند و در صورت نیاز قابل host شدن محلی است.
