# راهنمای اجرای کامل روی گوشی اندروید با Termux — AREP فاز ۱۵

> این پروژه **Local-First** طراحی شده — یعنی بدون Docker، بدون سرور ابری تحریم‌شده، مستقیم روی گوشی اندروید با Termux اجرا می‌شود. تمام Integrationها و AI روی حالت mock هستند، پس بدون اینترنت و بدون API Key هم کار می‌کند.

## ۱. نصب Termux

**مهم:** Termux را از **F-Droid** نصب کنید، نه Google Play (نسخه Play قدیمی و خراب است).

1. F-Droid را از https://f-droid.org نصب کنید
2. در F-Droid جستجو کنید: **Termux**
3. نصب کنید + Termux:API (اختیاری، برای دسترسی بیشتر)

بعد از نصب، Termux را باز کنید و اجرا:

```bash
pkg update -y && pkg upgrade -y
```

## ۲. نصب پیش‌نیازها

```bash
pkg install -y python git nodejs termux-api
```

- `python` → Backend FastAPI
- `git` → کلون پروژه
- `nodejs` → Frontend React + Vite
- `termux-api` → اختیاری (برای vibration, etc)

## ۳. کلون پروژه

```bash
cd ~
git clone https://github.com/cryptoya1011-ship-it/alibaba-real-estate-platform.git
cd alibaba-real-estate-platform
git checkout arena/01a0c452-alibaba-real-estate-platform
```

یا اگر فایل zip دارید:

```bash
cd ~
unzip alibaba-real-estate-platform.zip
cd alibaba-real-estate-platform
```

## ۴. راه‌اندازی خودکار (پیشنهادی)

ما اسکریپت یکپارچه ساختیم:

```bash
bash scripts/termux_setup.sh
```

این اسکریپت چه می‌کند؟

- `backend/.venv` می‌سازد
- `pip install -r requirements-dev.txt` (FastAPI, SQLAlchemy, aiosqlite, etc)
- `backend/.env` از `.env.example` می‌سازد + `JWT_SECRET` تصادفی
- `alembic upgrade head` → ۷ مهاجرت (0001 تا b2c3d4e5f6a7) → SQLite local + RLS no-op
- `python -m app.cli seed` → دیتای اولیه (System Roles, Permissions)

**نکته:** اگر قبلاً نصب کردید:

```bash
cd ~/alibaba-real-estate-platform/backend
.venv/bin/python -m alembic upgrade head
```

## ۵. اجرای Backend — ترمینال ۱

```bash
bash scripts/termux_start.sh
```

یا دستی:

```bash
cd ~/alibaba-real-estate-platform/backend
. .venv/bin/activate
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

خروجی باید:

```
Uvicorn running on http://0.0.0.0:8000
```

حالا مرورگر گوشی (Chrome) را باز کنید:

```
http://127.0.0.1:8000/docs
```

Swagger UI باید باز شود — تمام APIها: `/api/v1/properties`, `/ai/*`, `/integrations/*`, `/public/*`, `/admin/*`

### تست سریع Backend:

در ترمینال دوم (swipe از چپ → New Session):

```bash
curl http://127.0.0.1:8000/api/v1/health
```

باید:

```json
{"success":true,"data":{"status":"ok","env":"local"},...}
```

## ۶. اجرای Frontend — ترمینال ۲

**ترمینال جدید باز کنید:** در Termux، از چپ بکشید → **New Session**

```bash
cd ~/alibaba-real-estate-platform/frontend
npm install
npm run dev
```

Vite روی `0.0.0.0:5173` اجرا می‌شود:

```
Local: http://localhost:5173/
Network: http://192.168.1.XX:5173/
```

مرورگر گوشی:

```
http://127.0.0.1:5173
```

یا اگر می‌خواهید build تولیدی (PWA کامل):

```bash
npm run build
npm run preview
```


### رفع خطای `vite: not found` (گیر کردن در مرحله ۶)

این خطا یعنی `npm install` کامل نشده و پوشه `node_modules` وجود ندارد.

**راه حل سریع — اسکریپت خودکار:**

```bash
bash ~/alibaba-real-estate-platform/scripts/fix_frontend.sh
```

**راه حل دستی — مرحله به مرحله:**

```bash
# 1. نسخه‌ها را چک کن
node -v
npm -v
# باید Node >= 18 و NPM >= 9 باشد
# اگر قدیمی: pkg install -y nodejs-lts

# 2. برو به پوشه frontend
cd ~/alibaba-real-estate-platform/frontend

# 3. پاکسازی کامل
rm -rf node_modules package-lock.json
npm cache clean --force

# 4. نصب دوباره (2-3 دقیقه طول می‌کشد، اینترنت لازم)
npm install

# 5. چک کن vite وجود دارد
ls node_modules/.bin/vite
./node_modules/.bin/vite --version

# 6. اجرا با npx (مطمئن‌تر از npm run dev)
npx vite --host --port 5173

# اگر باز هم خطا: نصب سراسری vite
npm install -g vite
vite --host --port 5173
```

**چرا این اتفاق می‌افتد در Termux؟**

- اینترنت ضعیف → `npm install` نیمه‌کاره می‌ماند
- حافظه کم → Node crash
- قبلاً `npm install` نزدید → فقط `npm run dev` زدید

**تست که درست شد:**

```bash
cd ~/alibaba-real-estate-platform/frontend
npx vite --host --port 5173
# باید ببینی:
# VITE v5.4.0 ready in 300ms
# Local: http://localhost:5173/
# Network: http://192.168.1.XX:5173/
```

بعد Chrome → `http://127.0.0.1:5173`


### Proxy:

`vite.config.ts` خودکار `/api` را به `http://127.0.0.1:8000` پروکسی می‌کند، پس Frontend بدون تنظیم اضافی به Backend وصل می‌شود.

## ۷. ورود — Dev Login

چون `ALLOW_DEV_LOGIN=true` و `ENV=local`:

- اپ خودکار با `telegram_id=1000001` لاگین می‌کند (کاربر Dev)
- اگر داخل Telegram Web App باشید، `initData` تلگرام خودکار چک می‌شود (HMAC-SHA256)

بعد از ورود:

1. **+ سازمان** → نام فارسی + slug انگلیسی (مثلاً `alibaba`)
2. سازمان ساخته شده را انتخاب کنید → توکن جدید با `organization_id`
3. حالا ۱۲ تب می‌بینید:

```
املاک | مشتریان | بازدید | معاملات | تیم | نقش‌ها | 🤖 AI | 🔌 یکپارچه | عمومی | ★ | 🔔 | 👑 ادمین (اگر سوپر ادمین)
```

## ۸. تست فازهای مختلف

### املاک:
- + ملک → عنوان، نوع آپارتمان، فروش، ۱۲۰ متر، ۱۵ میلیارد → ثبت → کد `AB-ISF-MJ-AP-S-...` ساخته می‌شود

### عمومی / PWA:
- تب عمومی → لیست املاک منتشر شده (فقط published)
- روی `/p/{code}` کلیک → صفحه عمومی بدون احراز هویت + OG tags
- تب املاک → `/p/{code}` لینک Deep Link

### AI (فاز ۱۴):
- تب 🤖 AI → `آپارتمان 120 متری در مرداویج اصفهان با پارکینگ و آسانسور تا 15 میلیارد` → Parse → باید property_type apartment, city اصفهان, district مرداویج, has_parking true, max_price 15B تشخیص دهد
- جستجو + اجرا → ملک را پیدا کند
- تطبیق → score 0-1 + reasons

### Integrations (فاز ۱۵):
- تب 🔌 یکپارچه → وضعیت providers (همه mock 🔑✗ چون کلید ندارید — همین درست است)
- Telegram: chat_id 123456 + متن → ارسال پیام → mock message_id
- SMS: 09130000000 + پیام → ارسال → mock
- OTP: شماره → کد ۶ رقمی mock
- دیوار/شیپور: یک ملک بسازید → دیوار → external_id `divar-AB-...`
- پرداخت: ۵۰۰,۰۰۰ تومان → لینک پرداخت mock `https://payment.example.com/pay/pay_...`
- نقشه: آدرس `اصفهان، مرداویج` → Geocode → lat 32.65+ lng 51.66+ → لینک OSM
- فاصله اصفهان-تهران → ~400km
- لاگ‌ها → هر فراخوانی لاگ می‌شود در `integration_logs` (tenant-aware + RLS)

### تیم / نقش‌ها / ادمین:
- تیم → دعوت با telegram_id + نقش agent → توکن یک بار نمایش (sha256 ذخیره)
- نقش‌ها → نقش سفارشی بسازید `sales_manager` + مجوزها
- ادمین → اگر سوپر ادمین باشید (`is_super_admin=true`) → آمار کلی + لیست سازمان‌ها + toggle سوپر

### تبدیل به سوپر ادمین (در گوشی):

```bash
cd ~/alibaba-real-estate-platform/backend
. .venv/bin/activate
python << 'PY'
import asyncio
from sqlalchemy import text
from app.db.session import get_engine

async def main():
    engine = get_engine()
    async with engine.begin() as conn:
        await conn.execute(text("UPDATE users SET is_super_admin=1 WHERE telegram_id=1000001"))
    print("super_admin set for 1000001 - please re-login in PWA (refresh)")

asyncio.run(main())
PY
```

بعد Refresh در مرورگر → تب 👑 ادمین ظاهر می‌شود.

## ۹. PWA — نصب روی Home Screen

1. Chrome → `http://127.0.0.1:5173` → منو (۳ نقطه) → **Add to Home Screen** / **Install App**
2. آیکون `علی‌بابا` روی صفحه اصلی می‌آید
3. باز کنید → standalone (بدون نوار آدرس) → offline کار می‌کند
4. Service Worker → ۳۶ فایل precache ~1.7MB + API cache NetworkFirst + public StaleWhileRevalidate

### آفلاین:
- اینترنت گوشی را خاموش کنید → بنر قرمز `آفلاین`
- + ملک → ذخیره در Outbox (localStorage `arep_outbox`)
- اینترنت روشن → دکمه همگام‌سازی → ملک‌ها ارسال می‌شوند

## ۱۰. ساختار .env

`backend/.env.example` → `backend/.env` کپی می‌شود:

```
ENV=local
DATABASE_URL=sqlite+aiosqlite:///./arep_dev.db
JWT_SECRET=...تصادفی...
ALLOW_DEV_LOGIN=true

AI_PROVIDER=mock
# OPENAI_API_KEY=... (اختیاری، اگر نداشته باشید fallback به mock)

TELEGRAM_PROVIDER=mock
SMS_PROVIDER=mock
DIVAR_PROVIDER=mock
SHEYPOOR_PROVIDER=mock
PAYMENT_PROVIDER=mock
MAPS_PROVIDER=mock
# MAPS_PROVIDER=osm → OpenStreetMap رایگان بدون کلید
```

**هیچ کلید خارجی لازم نیست** — همه mock deterministic.

اگر کلید واقعی دارید (مثلاً TELEGRAM_BOT_TOKEN)، در `.env` بگذارید → provider خودکار از mock به real می‌رود، اما fallback به mock اگر API fail.

## ۱۱. تست‌ها روی گوشی

```bash
cd ~/alibaba-real-estate-platform/backend
. .venv/bin/activate
pytest -k "not test_alembic" -q
```

باید:

```
58 passed, 1 deselected
```

## ۱۲. اجرای همزمان با یک دستور (اختیاری)

اسکریپت `scripts/start_all.sh` ساختیم:

```bash
bash scripts/start_all.sh
```

این دو ترمینال Termux می‌سازد؟ نه، در یک ترمینال backend و frontend را با هم اجرا می‌کند (backend در پس‌زمینه).

بهتر: دو Session دستی باز کنید (قدم ۵ و ۶).

## ۱۳. IP گوشی در شبکه محلی — اشتراک با لپ‌تاپ

اگر می‌خواهید لپ‌تاپ هم به گوشی وصل شود:

```bash
ifconfig | grep 192
# یا
termux-wifi-connectioninfo
```

IP مثلاً `192.168.1.42` → در لپ‌تاپ مرورگر:

```
http://192.168.1.42:8000/docs
http://192.168.1.42:5173
```

فایروال Termux ندارد، اما اگر کار نکرد:

```bash
termux-wake-lock
```

تا گوشی sleep نرود.

## ۱۴. بک‌آپ و انتقال

دیتابیس SQLite:

```
~/alibaba-real-estate-platform/backend/arep_dev.db
```

کپی کنید:

```bash
cp backend/arep_dev.db /sdcard/arep_backup.db
```

یا:

```bash
termux-setup-storage
cp backend/arep_dev.db ~/storage/shared/arep.db
```

## ۱۵. عیب‌یابی

| مشکل | راه‌حل |
|------|--------|
| `ALLOW_DEV_LOGIN must be false in production` | **مهمترین خطای تو الان!** `.env` روی `ENV=production` هست. فیکس: `bash scripts/fix_env.sh` یا دستی `cp backend/.env.example backend/.env` بعد `bash scripts/termux_start.sh` |
| `TELEGRAM_BOT_TOKEN must be set in production` | همین مشکل — `ENV=production` دارید ولی توکن ندارید. فیکس: `ENV=local` کنید. `bash scripts/fix_env.sh` |
| `JWT_SECRET must be set in production` | همین — `.env` رو به `local` برگردونید: `cp backend/.env.example backend/.env` |
| `alembic not found` | `.venv/bin/activate` کنید |
| `port 8000 already in use` | `pkill -f uvicorn` یا `lsof -i :8000` |
| Frontend `Cannot find module` | `npm install` دوباره |
| `JWT error` | `rm backend/.env` + `bash scripts/termux_setup.sh` |
| `permission denied` برای `termux_setup.sh` | `chmod +x scripts/*.sh` |
| `sh: 1: vite: not found` | `node_modules` نصب نشده — `bash scripts/fix_frontend.sh` یا دستی زیر |
| `vite: not found` بعد از `npm install` | `npx vite --host --port 5173` یا `npm install -g vite` |
| Chrome `127.0.0.1:5173` باز نمی‌شود | مطمئن شوید `npm run dev` با `--host` اجرا شده (vite.config.ts دارد `host: 0.0.0.0`) |
| PWA نصب نمی‌شود | باید `npm run build && npm run preview` باشد، نه `dev` — یا Chrome → DevTools → Application → Manifest چک |

## ۱۶. مرحله بعد — تولید (اختیاری)

برای سرور واقعی (VPS خارج):

```bash
docker compose up --build
```

شامل: postgres:16 + redis:7 + backend (alembic + uvicorn) + nginx (security headers, gzip, PWA cache, Deep Links bot→OG) — `docker-compose.yml` آماده است.

اما برای گوشی، همین SQLite + mock کافی و **تحریم‌ناپذیر** است (ADR-0008).

---

**خلاصه دستورات طلایی Termux:**

```bash
# ترمینال 1 — Backend
cd ~/alibaba-real-estate-platform
bash scripts/termux_setup.sh   # فقط بار اول
bash scripts/termux_start.sh   # هر بار

# ترمینال 2 — Frontend
cd ~/alibaba-real-estate-platform/frontend
npm install   # بار اول
npm run dev   # هر بار

# مرورگر:
# http://127.0.0.1:5173 → اپ اصلی (12 تب)
# http://127.0.0.1:8000/docs → API docs
```

موفق باشید! 🏠🚀

---

## 🎨 به‌روزرسانی به رابط کاربری جدید (فاز ۱۶)

رابط کاربری کاملاً بازطراحی شده است (Tailwind + تم روشن/تیره + ناوبری موبایل + صفحه عمومی جدید).
چون **وابستگی‌های جدید npm اضافه شده‌اند**، فقط `git pull` کافی نیست؛ یک‌بار `npm install` لازم است.

```bash
# ۱) آپدیت کد (از ریشه پروژه)
cd ~/alibaba-real-estate-platform
git fetch origin
git checkout arena/01a0c452-alibaba-real-estate-platform
git reset --hard origin/arena/01a0c452-alibaba-real-estate-platform

# ۲) نصب وابستگی‌های جدید فرانت (یک‌بار؛ چند دقیقه طول می‌کشد)
cd frontend
npm install

# ۳) اجرا
cd ~/alibaba-real-estate-platform
bash scripts/termux_start.sh      # ترمینال ۱ → بک‌اند روی 8000

cd ~/alibaba-real-estate-platform/frontend
npx vite --host --port 5173       # ترمینال ۲ → رابط کاربری روی 5173
```

سپس در Chrome گوشی: **`http://127.0.0.1:5173`**

### اگر خطا گرفتید
| خطا | راه‌حل |
| --- | --- |
| `Cannot find module 'tailwindcss'` یا `sonner` | در پوشه `frontend` دوباره `npm install` بزنید (وابستگی‌های جدید) |
| `Failed to resolve import "recharts"` | همان بالا — نصب کامل نشده |
| صفحه سفید و در کنسول `Unexpected token` | کش مرورگر: DevTools → Application → Unregister Service Worker و Hard Reload (یا حالت ناشناس) |
| فونت فارسی زشت/پیش‌فرض است | فایل‌های فونت در `frontend/public/fonts/` باید موجود باشند (`ls public/fonts`) |

### نکات جدید
- **تم روشن/تیره:** آیکون ماه/خورشید در نوار بالا؛ انتخاب شما ذخیره می‌شود.
- **منوی موبایل:** ۴ تب اصلی پایین صفحه + دکمه «بیشتر» برای تیم، نقش‌ها، AI، یکپارچه‌سازی، ادمین.
- **لینک عمومی ملک:** `http://127.0.0.1:5173/p/<کد ملک>` — بدون ورود باز می‌شود.
- **صف آفلاین:** اگر اینترنت قطع باشد، شمارنده در نوار بالا نمایش داده می‌شود؛ با وصل شدن، روی همان چیپ بزنید تا همگام‌سازی شود.
