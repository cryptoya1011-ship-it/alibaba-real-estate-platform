# راهنمای کامل لپ‌تاپ — اجرای AREP فاز ۱۵ روی ویندوز / مک / لینوکس

> روی لپ‌تاپ خیلی راحت‌تر از Termux است — فقط ۲ ترمینال لازم داری: یکی Backend، یکی Frontend. همه چیز mock است، بدون API Key خارجی کار می‌کند.

## پیش‌نیازها

- **Git**
- **Python 3.11+** (تست شده با 3.11, 3.12)
- **Node.js 18+** + NPM 9+ (توصیه Node 20 LTS)
- مرورگر Chrome / Firefox

چک:

```bash
git --version
python --version
node -v
npm -v
```

اگر نداری:

- Python: https://www.python.org/downloads/
- Node: https://nodejs.org/ (LTS)
- Git: https://git-scm.com/

## ۱. کلون پروژه

```bash
git clone https://github.com/cryptoya1011-ship-it/alibaba-real-estate-platform.git
cd alibaba-real-estate-platform
git checkout arena/01a0c452-alibaba-real-estate-platform
```

## ۲. Backend — ترمینال ۱

### ویندوز (PowerShell) / مک / لینوکس — یکسان:

```bash
cd backend

# ساخت venv
python -m venv .venv

# فعال‌سازی
# ویندوز PowerShell:
.venv\Scripts\Activate.ps1
# ویندوز CMD:
# .venv\Scripts\activate.bat
# مک/لینوکس:
source .venv/bin/activate

# نصب
pip install --upgrade pip
pip install -r requirements-dev.txt

# .env
# اگر .env نداری:
cp .env.example .env
# یا در ویندوز:
# copy .env.example .env

# اگر می‌خواهی JWT_SECRET تصادفی:
python -c "import secrets; print(secrets.token_urlsafe(48))"
# مقدار را در .env جایگزین JWT_SECRET کن

# مهاجرت‌ها — ۷ مهاجرت (0001 تا b2c3d4e5f6a7)
alembic upgrade head

# دیتای اولیه — نقش‌ها و مجوزها
python -m app.cli seed

# اجرا
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

باید ببینی:

```
Uvicorn running on http://0.0.0.0:8000
```

تست:

```
http://127.0.0.1:8000/docs  → Swagger UI
http://127.0.0.1:8000/api/v1/health → {"success":true,"data":{"status":"ok"}}
```

### تست‌های Backend (اختیاری):

ترمینال جدید:

```bash
cd backend
source .venv/bin/activate  # یا .venv\Scripts\Activate.ps1
pytest -k "not test_alembic" -v
# باید 58 passed
```

## ۳. Frontend — ترمینال ۲

**ترمینال دوم باز کن (جدید)**

```bash
cd frontend

# نصب — بار اول 1-2 دقیقه
npm install

# اجرا — dev با HMR
npm run dev
```

خروجی:

```
VITE v5.4.0 ready in 300ms
Local: http://localhost:5173/
Network: http://192.168.1.XX:5173/
```

مرورگر:

```
http://127.0.0.1:5173
```

**نکته Proxy:** `vite.config.ts` خودکار `/api` را به `http://127.0.0.1:8000` پروکسی می‌کند، نیاز به تنظیم نیست.

### اگر `vite: not found`:

```bash
rm -rf node_modules package-lock.json
npm cache clean --force
npm install
npx vite --host --port 5173
```

## ۴. ورود — Dev Login

چون `ENV=local` و `ALLOW_DEV_LOGIN=true` در `.env`:

- اپ خودکار با `telegram_id=1000001` لاگین می‌کند (کاربر Dev)
- نیازی به تلگرام نیست

اگر خطای نشست دیدی → `http://127.0.0.1:5173` را Refresh کن.

## ۵. ساخت سازمان — اولین قدم

1. در بالای صفحه → **+ سازمان**
2. نام: `املاک علی‌بابا` → slug: `alibaba` (انگلیسی، بدون فاصله)
3. سازمان ساخته می‌شود → لیست سازمان‌ها → روی `املاک علی‌بابا ✓` کلیک → توکن جدید با `organization_id`
4. حالا ۱۲ تب می‌بینی:

```
املاک (0) | مشتریان (0) | بازدید (0) | معاملات (0) | تیم (0) | نقش‌ها (3) | 🤖 AI | 🔌 یکپارچه | عمومی (0) | ★ (0) | 🔔 | 👑 ادمین (اگر سوپر)
```

## ۶. تست قدم‌به‌قدم — چک‌لیست کامل فازها

### فاز ۵ — املاک (Property Engine):

- تب **املاک** → **+ ملک**
- عنوان: `آپارتمان 120 متری مرداویج` → نوع: آپارتمان، فروش، ۱۲۰ متر، ۱۵ میلیارد → **ثبت ملک — کد AB-...**
- باید کد `AB-ISF-MJ-AP-S-2609-00001` ببینی (کد اتمیک)
- لیست املاک → کد + قیمت + لینک `/p/{code}` + دکمه ★ علاقه‌مندی
- روی ★ کلیک → تب ★ برو → باید ملک را ببینی

### فاز ۶ — CRM (مشتریان):

- تب **مشتریان** → **+ مشتری** → نام: `علی`، نام خانوادگی: `تست`، موبایل: `09130000000`، نقش buyer → **ثبت مشتری**
- لیست مشتریان → `علی تست` + `buyer`
- توجه: شماره موبایل تکراری در یک سازمان خطای `CUSTOMER_PHONE_TAKEN` می‌دهد (Tenant Isolation)

### فاز ۷-۸ — بازدید + اعلان:

- تب **بازدید** → **+ بازدید** → ID ملک: `1`، ID مشتری: `1`، تاریخ امروز، ساعت `10:00` → **ثبت بازدید + اعلان**
- باید پیام `بازدید ثبت شد + اعلان ساخته شد` ببینی
- تب **🔔** → باید اعلان `بازدید جدید` با priority important ببینی + unread count
- **خواندن همه** → unread صفر می‌شود

### فاز ۹ — معاملات (Deals Pipeline):

- تب **معاملات** → **+ معامله** → عنوان: `فروش مرداویج`، ID مشتری: `1`، ID ملک: `1` (اختیاری، می‌تواند خالی باشد per بند ۳۹ مستقل از Property)، مبلغ ۲۰ میلیارد، کمیسیون ۱ میلیارد → **ثبت معامله — کد DL-...**
- کد `DL-2609-00001` ساخته می‌شود
- Pipeline: `lead → qualification → property_match → visit → negotiation → agreement → closed_won`
- دکمه **مرحله بعدی →** → status تغییر می‌کند
- دکمه **تاریخچه** → ۲ مرحله می‌بینی (lead → qualification)
- لینک `/d/{code}` Deep Link

### فاز ۱۰-۱۲ — عمومی + PWA + SEO:

- تب **عمومی** → **↻ بارگذاری** → لیست خالی چون ملک‌ها draft هستند
- برای انتشار: باید ملک status را به published تغییر دهی (از API یا DB)
- سریع‌ترین راه — در ترمینال Backend:

```bash
# در ترمینال ۳
cd backend
source .venv/bin/activate
python << 'PY'
import asyncio
from sqlalchemy import text
from app.db.session import get_engine

async def main():
    engine = get_engine()
    async with engine.begin() as conn:
        await conn.execute(text("UPDATE properties SET status='published' WHERE id=1"))
    print("property 1 published")

asyncio.run(main())
PY
```

- تب عمومی → بارگذاری → حالا ملک را می‌بینی + عکس + `/p/{code}` + `OG HTML`
- کلیک `/p/{code}` → صفحه عمومی بدون احراز هویت باز می‌شود (Public DTO، بدون owner_phone, exact_address)
- تب املاک → هر ملک لینک `/p/{code}` دارد

#### PWA:

- `npm run build` → `dist/` شامل `sw.js`, `workbox-*.js`, `manifest.webmanifest`
- `npm run preview` → PWA کامل با Service Worker
- Chrome → F12 → Application → Manifest + Service Workers را چک کن
- Chrome → منو → Install App → روی دسکتاپ نصب می‌شود

#### SEO / OG:

- `http://127.0.0.1:8000/api/v1/public/og/AB-ISF-MJ-AP-S-...` → HTML با OG tags + JSON-LD RealEstateListing

### فاز ۱۳ — Multi-Tenant (تیم، نقش‌ها، ادمین):

#### تیم — Invitation Flow:

- تب **تیم** → Telegram ID مثلاً `2000002` + نقش `agent` → **+ دعوت**
- پیام: توکن یک بار نمایش `...` → کپی کن (فقط یک بار دیده می‌شود، sha256 ذخیره)
- پایین صفحه → **پذیرش دعوت** → توکن را بچسبان → **پذیرش** → باید بگوید `دعوت پذیرفته شد — لطفاً دوباره وارد شوید`
- توضیح: Token single-use، دومین بار ۴۰۴ می‌دهد، identity match telegram_id

#### نقش‌ها — Custom Roles:

- تب **نقش‌ها** → ۳ نقش سیستمی می‌بینی: `organization_admin`, `branch_admin`, `agent` (global)
- ساخت نقش سفارشی: کد `sales_manager`، عنوان `مدیر فروش`، مجوزها `property:read,property:create,customer:read` → **+ نقش سفارشی**
- نقش جدید با badge سبز **سفارشی** می‌آید + لیست مجوزها
- دکمه **حذف** → فقط سفارشی‌ها قابل حذف، سیستمی ۴۰۳

#### سوپر ادمین — ۴ لایه ایزولیشن:

- برای دیدن تب 👑 ادمین:

```bash
cd backend
source .venv/bin/activate
python << 'PY'
import asyncio
from sqlalchemy import text
from app.db.session import get_engine

async def main():
    engine = get_engine()
    async with engine.begin() as conn:
        await conn.execute(text("UPDATE users SET is_super_admin=1 WHERE telegram_id=1000001"))
    print("super_admin enabled - refresh browser")

asyncio.run(main())
PY
```

- Refresh مرورگر → تب **👑 ادمین** ظاهر می‌شود
- **↻ بارگذاری ادمین** → آمار کلی: سازمان‌ها، کاربران، شعب، املاک، مشتریان، بازدید، معامله
- لیست سازمان‌ها (BaseRepository بدون فیلتر tenant — بای‌پس RLS via `get_db_public`)
- دکمه **آمار** هر سازمان → members, branches, properties, persons, visits, deals count
- لیست کاربران همه tenantها → toggle سوپر ادمین
- **Tenant Isolation واقعی:** اگر ۲ سازمان بسازی (Org A, Org B)، ملک‌های هر کدام فقط در همان سازمان دیده می‌شود، دسترسی به دیگری ۴۰۴ نه ۴۰۳ (Org A,B,C در `test_multi_tenant_isolation_abc`)

### فاز ۱۴ — AI / Automation (🤖 AI):

- تب **🤖 AI** → بالا: `ارائه‌دهنده فعلی: mock — موجود: mock, openai, gemini, claude, local` + چیپ‌ها `mock: rule-based ✓` + `openai: llm 🔑✗` (چون کلید نداری، fallback به mock — درست)

#### Natural Language Search:

- Input پیش‌فرض: `آپارتمان 120 متری در مرداویج اصفهان با پارکینگ و آسانسور تا 15 میلیارد`
- **Parse** → JSON:

```json
{
  "property_type": "apartment",
  "city": "اصفهان",
  "city_code": "ISF",
  "district": "مرداویج",
  "district_code": "MJ",
  "min_area": 120,
  "has_parking": true,
  "has_elevator": true,
  "max_price": 15000000000,
  "parsed_by": "mock",
  "confidence": 0.85,
  "filters": {...}
}
```

- **جستجو + اجرا** → لیست املاک مطابق (مثلاً آپارتمان ISF تا 15B)

#### Auto Matching:

- پایین: دکمه‌های `تطبیق درخواست‌های علی` + `تطبیق ملک آپارتمان 120 متری`
- کلیک → لیست با Score badge: سبز >=0.7، نارنجی >=0.5، خاکستری <0.5 + `✅ مطابق` + reasons فارسی: `نوع ملک مطابقت دارد: apartment | شهر مطابق: ISF | قیمت در بودجه`
- اگر مشتری درخواست نداشته باشد: ابتدا در تب CRM برای مشتری درخواست بساز (از API):

```bash
# مثال: customer_request
curl -X POST http://127.0.0.1:8000/api/v1/customer-requests \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"person_id":1,"property_type":"apartment","transaction_type":"sale","city_code":"ISF","district_code":"MJ","area_min":100,"area_max":150,"budget_min":10000000000,"budget_max":20000000000,"rooms":2}'
```

- **توضیح AI:** دکمه `توضیح AI` روی ملک → کارت سبز `توضیح پیشنهادی AI برای AB-...` → `آپارتمان 120 متری در مرداویج اصفهان، 3 خوابه، مناسب برای خانواده...`

### فاز ۱۵ — Integrations / Advanced Platform (🔌 یکپارچه):

- تب **🔌 یکپارچه** → بالا: `وضعیت ارائه‌دهندگان: telegram: mock, sms: mock, payment: mock, maps: mock, listings: [divar,sheypoor]` + چیپ‌ها `telegram: mock 🔑✗` (چون BOT_TOKEN نداری) — `maps: mock 🔑✓` (OSM free)

#### Telegram:

- chat_id: `123456` + متن: `سلام از املاک علی‌بابا 🏠` → **ارسال پیام** → Result: `mock — success — message_id 1234`
- **Deep Link** → `https://t.me/arep_bot?start=prop_...` — برای Login/Notification/Deep Link per بند ۶۲
- **ارسال کارت ملک:** دکمه `ارسال کارت آپارتمان 120 متری` → کارت با کد `/p/{code}`

#### SMS:

- موبایل: `09130000000` + پیام: `کد تایید شما: 123456` → **ارسال SMS** → mock success + to
- **OTP** → کد ۶ رقمی random + `code returned only in mock mode`

#### دیوار / شیپور:

- هر ملک → ۲ دکمه **دیوار** قرمز + **شیپور** آبی
- کلیک **دیوار** → `external_id: divar-AB-...-timestamp` + url `https://divar.ir/v/...` + status published (mock deterministic)
- **شیپور** → `sheypoor-AB-...`

#### پرداخت:

- مبلغ: `500000` + توضیح: `کمیسیون معامله` → **ایجاد لینک پرداخت** → `payment_id: pay_...` + `payment_url: https://payment.example.com/pay/pay_...` + amount 500k
- در واقعیت Zarinpal می‌شود، الان mock (No Vendor Lock-in)

#### نقشه — OSM (بدون تحریم):

- آدرس: `اصفهان، مرداویج، خیابان آزادی` → **Geocode** → lat ~32.65+ lng ~51.66+ (hash-based deterministic) + city اصفهان + confidence 0.85
- لینک **مشاهده در OSM** → `https://www.openstreetmap.org/?mlat=...`
- **فاصله اصفهان-تهران** → `distance_km: 400+` (haversine)

#### نتایج + لاگ‌ها:

- **نتایج** → لیست ۱۰ نتیجه آخر mock با provider/url
- **لاگ‌ها** → **↻ بارگذاری لاگ** → هر فراخوانی لاگ شده در `integration_logs` (tenant-aware + RLS) → provider/action/status/external_id/url

## ۷. Docker Compose (اختیاری — برای سرور):

اگر Docker داری:

```bash
docker compose up --build
```

شامل:

- db: postgres:16-alpine healthcheck
- redis: redis:7-alpine
- backend: build + alembic + uvicorn + healthcheck
- nginx: arep.conf (security headers, gzip, PWA cache 1y, sw.js no-cache, Deep Links bot→OG else SPA)

```
http://127.0.0.1:80 → nginx → backend + frontend/dist
http://127.0.0.1:80/docs
http://127.0.0.1:80/p/{code} → bot → OG HTML else SPA
```

## ۸. ساختار ۱۲ تب نهایی

| تب | فاز | چی تست کنی |
|---|---|---|
| املاک | 5 | + ملک → کد AB-... → ★ → /p/{code} |
| مشتریان | 6 | + مشتری → phone unique → roles |
| بازدید | 7-8 | + بازدید → اعلان auto → 🔔 |
| معاملات | 9 | + معامله → DL-... → Pipeline → تاریخچه |
| تیم | 13 | + دعوت telegram_id → token یک بار → پذیرش → re-login |
| نقش‌ها | 13 | + نقش سفارشی → مجوزها → حذف |
| 🤖 AI | 14 | Parse فارسی → جستجو+اجرا → تطبیق score+reasons → توضیح |
| 🔌 یکپارچه | 15 | Telegram/SMS/Divar/Sheypoor/Payment/Maps OSM → Results + Logs |
| عمومی | 10-12 | publish ملک → لیست عمومی → /p/{code} بدون auth → OG |
| ★ | 6 | علاقه‌مندی |
| 🔔 | 7-8 | اعلان‌ها priority + خواندن همه |
| 👑 ادمین | 13 | سوپر ادمین → آمار کلی → org stats → users toggle |

## ۹. دستورات طلایی لپ‌تاپ

```bash
# ترمینال 1 — Backend
cd backend
source .venv/bin/activate  # ویندوز: .venv\Scripts\Activate.ps1
alembic upgrade head
python -m app.cli seed
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
# http://127.0.0.1:8000/docs

# ترمینال 2 — Frontend
cd frontend
npm install
npm run dev
# http://127.0.0.1:5173

# ترمینال 3 — Tests (اختیاری)
cd backend
source .venv/bin/activate
pytest -k "not test_alembic" -v
# 58 passed
```

## ۱۰. عیب‌یابی لپ‌تاپ

| مشکل | راه حل |
|---|---|
| `python not found` | `python3 -m venv .venv` |
| `alembic not found` | `source .venv/bin/activate` |
| `vite: not found` | `rm -rf node_modules && npm install && npx vite --host` |
| `port 8000 already in use` | `lsof -i :8000` + `kill -9 PID` (ویندوز: `netstat -ano | findstr 8000`) |
| `CORS error` | مطمئن شو backend روی 8000 و frontend روی 5173 است، vite proxy دارد |
| `401 Unauthorized` | Refresh صفحه — dev login خودکار |
| `404 برای ملک` | سازمان را انتخاب کردی؟ tenant isolation → 404 اگر org دیگر |
| `public خالی` | ملک status published کن (SQL بالا) |
| `AI 0 results` | q فیلتر حذف شده — باید با فیلترهای ساختاری جستجو کند، نه LIKE |
| `Integrations 🔑✗` | درست است — mock mode، بدون کلید کار می‌کند |

---

موفق باشی! 🏠🚀
- اگر خواستی build تولیدی PWA: `cd frontend && npm run build && npm run preview`
- اگر خواستی کل پروژه را ببندی: Ctrl+C در هر دو ترمینال
