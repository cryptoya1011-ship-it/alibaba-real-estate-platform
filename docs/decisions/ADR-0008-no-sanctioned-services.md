# ADR-0008 — بدون وابستگی به سرویس‌های تحریم‌شده

- **Date:** 2026-09-18
- **Status:** Accepted

## Context

پروژه در ایران توسعه داده می‌شود و باید بدون وابستگی به سرویس‌های ابری تحریم‌شده کار کند. همچنین باید روی Android/Termux بدون Docker اجرا شود.

## Decision

تمام Dependencyها Open Source و Self-hosted هستند:

- **Backend:** FastAPI, SQLAlchemy, Alembic, PyJWT, aiosqlite, asyncpg
- **Frontend:** React, Vite, TypeScript
- **DB:** SQLite (local), PostgreSQL (prod)
- **Cache:** Redis (optional, self-hosted)
- **Proxy:** Nginx
- **Auth:** Telegram Web App (HMAC, self-validated)

هیچ SDK ابری, سرویس پرداخت خارجی یا AI API خارجی در مسیر اصلی وجود ندارد.

تنها منبع خارجی, اسکریپت `telegram-web-app.js` است که خود تلگرام سرو می‌کند و در صورت نیاز قابل host شدن محلی است.

## Alternatives

- **Firebase, Supabase, Vercel:** تحریم, وابستگی
- **AWS S3:** تحریم, نیاز به Object Storage جایگزین (MinIO self-hosted در آینده)
- **OpenAI API مستقیم در Core:** وابستگی, باید Adapter باشد

## Consequences

**مثبت:**
- اجرا روی Termux بدون Docker
- بدون نگرانی تحریم
- Self-hosted کامل
- هزینه کمتر

**منفی:**
- برخی ویژگی‌ها (Push Notification, Email) باید خودمان پیاده کنیم
- AI Provider باید Adapter داشته باشد (بند 16)

**Future:**
- Media Storage: Filesystem محلی فعلا, MinIO self-hosted در آینده (abstraction از حالا)
- AI: Adapter Pattern تا Provider قابل تعویض باشد
- Maps: OpenStreetMap به جای Google Maps
