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

## ADR-009 — استک رابط کاربری فاز ۱۶ (Tailwind + Design Tokens)
**تصمیم:** فرانت‌اند روی **Tailwind CSS v3** با توکن‌های CSS Variable (RGB triplet) و کلاس‌های معنایی
(`bg-surface`, `text-ink`, `border-line`, `bg-brand`) بازنویسی شد؛ به‌همراه `lucide-react` (آیکون)،
`sonner` (توست)، `react-router-dom` (مسیر و Deep Link) و `recharts` فقط برای داشبورد ادمین (Chunk جدا + Lazy).
**چرا:** بدون وابستگی به CDN تحریم‌شده یا فونت آنلاین؛ فونت **Vazirmatn** در `frontend/public/fonts`
self-host می‌شود تا PWA آفلاین هم فارسی درست نشان دهد. تمام کامپوننت‌ها روی توکن‌ها ساخته شده‌اند، پس
تغییر تم (روشن/تیره) با یک کلاس روی `<html>` انجام می‌شود و هیچ رنگی در کد Hardcode نشده است.
**هزینه/ریسک:** یک Dependency جدید در باندل (~۱۱۴KB gzip برای بار اول موبایل). برای فاز بعد،
`react-hook-form + zod` برای فرم‌های بلند پیشنهاد می‌شود.
**تست:** `npm test` (Vitest + Testing Library) و `tsc -b && vite build` بخشی از Definition of Done شد.

## ADR-010 — حفظ قرارداد API در بازطراحی UI
**تصمیم:** `frontend/src/api.ts` به‌عنوان تنها لایه ارتباط با بک‌اند دست‌نخورده ماند (فقط یک نوع
پارامتر در `listNotifications` عمومی‌تر شد). Envelope استاندارد `{success, data, error, meta}`،
`ApiError`، هدر `Idempotency-Key` و صف آفلاین (`arep_outbox` در localStorage) بدون تغییر باقی ماندند.
**چرا:** بازطراحی «رابط» نباید «قرارداد» را تغییر دهد؛ با این کار ۵۹ تست بک‌اند و تمام مهاجرت‌های
Alembic بدون هیچ تغییری سبز ماندند و امکان بازگشت (rollback) صرفاً با برگرداندن پوشه فرانت فراهم است.
