# راهنمای راه‌اندازی دائمی روی سرور (VPS) — AREP

این راهنما سامانه را روی یک سرور مجازی با **آدرس ثابت و HTTPS** بالا می‌آورد تا مینی‌اپ تلگرام
همیشه در دسترس باشد. ساختار موجود پروژه (`docker-compose.yml` و `nginx/arep.conf`) دست‌نخورده
می‌ماند؛ فقط لایهٔ HTTPS با Caddy از پوشهٔ `deploy/` روی آن سوار می‌شود و گواهی رایگان
Let's Encrypt را خودکار می‌گیرد و تمدید می‌کند.

```
تلگرام / مرورگر ──HTTPS──▶ Caddy ──▶ nginx ──▶ frontend/dist (PWA)
                                        └──▶ backend (FastAPI) ──▶ PostgreSQL + Redis
```

---

## ۰. پیش‌نیازها

| مورد | توضیح |
|---|---|
| سرور مجازی | Ubuntu 22.04 یا 24.04، حداقل ۲ گیگ رم، ۱ هسته، ۲۰ گیگ دیسک. سرور **خارج از ایران** (مثلاً Hetzner یا هر دیتاسنتر اروپایی) پیشنهاد می‌شود تا Docker Hub، GitHub و API تلگرام بدون مشکل در دسترس باشند. |
| دامنه | یک دامنه یا زیردامنه (مثلاً `arep.example.com`) که رکورد **A** آن به IP سرور اشاره کند. **اگر دامنه ندارید** از `sslip.io` استفاده کنید: برای IP ‏`203.0.113.5` آدرس `203-0-113-5.sslip.io` خودکار به سرور اشاره می‌کند و نیازی به خرید دامنه نیست. |
| ربات تلگرام | توکن ربات از @BotFather و نام کاربری ربات (مثلاً `Areepp_bot`). |
| پورت‌ها | پورت‌های **80** و **443** سرور باز باشند (برای صدور گواهی HTTPS). |

---

## ۱. نصب Docker روی سرور

با SSH وارد سرور شوید و اجرا کنید:

```bash
curl -fsSL https://get.docker.com | sh
docker compose version   # باید 2.24 یا بالاتر باشد
```

## ۲. دریافت کد

```bash
git clone -b arena/01a0d354-alibaba-real-estate-platform \
  https://github.com/cryptoya1011-ship-it/alibaba-real-estate-platform.git arep
cd arep
```

> اگر این شاخه را در `main` ادغام (merge) کرده‌اید، `-b ...` را حذف کنید.

## ۳. ساخت فایل تنظیمات `.env`

```bash
cp .env.example .env
nano .env
```

محتوا را این‌طور تنظیم کنید (مقادیر نمونه را عوض کنید):

```dotenv
ENV=production
POSTGRES_DB=arep
POSTGRES_USER=arep
POSTGRES_PASSWORD=یک-رمز-قوی-و-طولانی
JWT_SECRET=خروجی-دستور-زیر
TELEGRAM_BOT_TOKEN=توکن-ربات-از-BotFather
TELEGRAM_BOT_USERNAME=Areepp_bot
DOMAIN=arep.example.com
CORS_ORIGINS=https://arep.example.com

# باعث می‌شود همهٔ دستورهای docker compose لایهٔ HTTPS را هم خودکار بخوانند
COMPOSE_FILE=docker-compose.yml:deploy/docker-compose.https.yml
```

برای ساخت `JWT_SECRET` تصادفی:

```bash
python3 -c "import secrets;print(secrets.token_urlsafe(48))"
```

> فایل `.env` در `.gitignore` است و هرگز در گیت‌هاب ذخیره نمی‌شود. توکن را جای دیگری منتشر نکنید.

## ۴. ساخت نسخهٔ نهایی رابط کاربری

نیازی به نصب Node روی سرور نیست؛ از Docker استفاده می‌شود:

```bash
docker run --rm -v "$PWD/frontend":/app -w /app node:22-alpine \
  sh -c "npm ci && npm run build"
ls frontend/dist/index.html   # باید وجود داشته باشد
```

## ۵. روشن کردن سامانه

```bash
docker compose up -d --build
docker compose ps            # همه باید Up / healthy باشند
docker compose logs -f caddy # صدور گواهی را ببینید؛ با Ctrl+C خارج شوید
```

سپس نقش‌ها و مجوزهای پایه را بسازید (فقط بار اول):

```bash
docker compose exec backend python -m app.cli seed
```

بررسی سلامت: آدرس `https://arep.example.com/health` را باز کنید؛ باید پاسخ JSON بدهد.

## ۶. اتصال ربات تلگرام

1. در @BotFather ← `/mybots` ← ربات خود ← **Bot Settings** ← **Menu Button** ← **Configure menu button**.
2. آدرس را بفرستید: `https://arep.example.com` و یک عنوان (مثلاً «املاک») بدهید.
3. در چت ربات، دکمهٔ منو را بزنید؛ برنامه با حساب تلگرام شما باز می‌شود.
4. در اولین ورود، یک سازمان بسازید (نام + شناسهٔ انگلیسی).
5. خودتان را مدیر کل (Super Admin) کنید — عدد، شناسهٔ تلگرام شماست:

```bash
docker compose exec backend python -m app.cli make-super-admin 677873313
```

سپس برنامه را در تلگرام ببندید و دوباره باز کنید تا بخش «مدیریت کل» ظاهر شود.

> **نکتهٔ امنیتی:** در حالت production ورود آزمایشی (`dev-login`) عمداً غیرفعال است؛ پنل مدیریت
> فقط از داخل تلگرام قابل ورود است. صفحهٔ عمومی ملک (`/p/کد-ملک`) برای همه باز است.

---

## به‌روزرسانی بعد از تغییر کد

```bash
cd ~/arep
git pull
docker run --rm -v "$PWD/frontend":/app -w /app node:22-alpine sh -c "npm ci && npm run build"
docker compose up -d --build
```

مهاجرت‌های پایگاه داده (alembic) هنگام روشن شدن backend خودکار اجرا می‌شوند.

## پشتیبان‌گیری از پایگاه داده

```bash
docker compose exec -T db pg_dump -U arep arep | gzip > backup-$(date +%F).sql.gz
```

بازگردانی:

```bash
gunzip -c backup-YYYY-MM-DD.sql.gz | docker compose exec -T db psql -U arep arep
```

## عیب‌یابی

| مشکل | راه‌حل |
|---|---|
| گواهی HTTPS صادر نمی‌شود | رکورد A دامنه را بررسی کنید (`ping arep.example.com` باید IP سرور را بدهد) و پورت‌های 80/443 را در فایروال باز کنید: `ufw allow 80,443/tcp`. لاگ: `docker compose logs caddy`. |
| backend بالا نمی‌آید | `docker compose logs backend`. رایج‌ترین علت: خالی بودن `JWT_SECRET` یا `TELEGRAM_BOT_TOKEN`، یا باقی ماندن مقدار نمونه. |
| در تلگرام «امضای initData نامعتبر است» | توکن `.env` با رباتی که دکمهٔ منو را دارد یکی نیست. توکن را اصلاح و `docker compose up -d` کنید. |
| صفحه سفید / قدیمی | مرحلهٔ ۴ (ساخت frontend) را دوباره اجرا کنید؛ سپس برنامه را کامل ببندید و باز کنید. |
| `!reset` خطا می‌دهد | نسخهٔ Docker Compose قدیمی است؛ Docker را با دستور مرحلهٔ ۱ به‌روز کنید. |
