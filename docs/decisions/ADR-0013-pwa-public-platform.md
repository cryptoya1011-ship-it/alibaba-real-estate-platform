# ADR-0013 — PWA / Offline + Public Platform (Phase 10 + 12)

- **Date:** 2026-09-21
- **Status:** Accepted
- **Phase:** Phase 10 PWA / Offline + Phase 12 Public Platform (بند 62, 97)

## Context

- **PWA** باید Installable باشد، Offline کار کند، Service Worker داشته باشد (بند 97 اولین Release)
- **Public Platform** باید بدون احراز هویت املاک منتشر شده را نمایش دهد، Deep Links `/p/{code}`، OG + JSON-LD برای SEO (بند 62)
- Frontend فعلی فقط SPA با auth است، نیاز به Public View دارد
- Offline: App Shell + Cached UI + Outbox برای ثبت ملک آفلاین → بعدا Sync
- Icons, Manifest, Theme Color #1B3A5C, Background #F5F5F5

چگونه PWA و Public Platform را به‌صورت یک codebase پیاده کنیم که هم برای Internal CRM و هم برای Public Website قابل استفاده باشد؟

## Decision

### PWA

**Dependencies:**
- `vite-plugin-pwa@0.21.1` — generateSW mode, Workbox
- Manifest: name "املاک علی‌بابا — AREP", short_name "علی‌بابا", description فارسی, theme_color #1B3A5C, background #F5F5F5, display standalone, scope /, start_url /, dir rtl, lang fa
- Icons: 72,96,144,192,512 + maskable 512 + apple-touch-icon 180 — generated from base 512 icon (dark navy + gold house)
- includeAssets: favicon.ico, apple-touch-icon.png, icons/*.png, pwa-*.png

**Workbox runtimeCaching:**
- telegram.org → CacheFirst 7 days
- /api/* → NetworkFirst 10s timeout, cache 5min, 100 entries — برای Offline UX
- /api/v1/public/* → StaleWhileRevalidate 1h — برای Public Pages بهتر

**vite.config.ts:**
- plugins: react() + VitePWA({ registerType autoUpdate, manifest, workbox, devOptions enabled true type module })
- Build output: sw.js, workbox-*.js, manifest.webmanifest, registerSW.js, precache 36 entries ~1.7MB

**index.html:**
- meta theme-color #1B3A5C, background-color #F5F5F5, description فارسی
- meta apple-mobile-web-app-capable yes, status-bar black-translucent, title علی‌بابا
- link icon 32, apple-touch-icon 180, favicon.ico
- OG defaults: og:type website, site_name املاک علی‌بابا, title, description, image /icons/icon-512.png, twitter card summary_large_image
- noscript fallback

**src/pwa.ts:**
- registerPWA(): serviceWorker support detection, controllerchange listener, online/offline events dispatch custom arep:online/offline
- setupInstallPrompt(): beforeinstallprompt preventDefault + deferredPrompt, appinstalled listener
- isStandalone(): matchMedia display-mode standalone or navigator.standalone
- isOnline(): navigator.onLine

**src/main.tsx:**
- import registerPWA and call, console log dev mode

**Offline Strategy:**
- App Shell cached via precache (index.html, js, css, icons)
- API cached via runtimeCaching NetworkFirst/StaleWhileRevalidate
- Offline detection via navigator.onLine + events → banner
- Outbox pattern: localStorage key arep_outbox, type create_property, payload, created_at, id. Functions getOutbox, addToOutbox, removeFromOutbox, clearOutbox
- When offline, createProperty goes to outbox, shows alert "آفلاین — در صف ذخیره شد"
- When online, banner "X آیتم در صف" + sync button → tries to create via API, then clear
- offline.html fallback page

**Frontend PWA UI (App.tsx):**
- Offline banner red when !online + outbox count
- Update available banner dark blue when SW update
- Install prompt banner white + gold border when beforeinstallprompt available and not standalone
- Outbox sync banner yellow when outboxCount>0 && online
- Footer: PWA installed? online? SW status, deep links, outbox count

### Public Platform

**Backend: app/api/v1/public.py**
- Router prefix /public, tags public, NO auth dependency
- _public_property_to_dict(): Public DTO only — id, code, title, description, property_type, transaction_type, status, price, rent_price, deposit, areas, rooms, bedrooms, bathrooms, floor, has_parking/elevator/warehouse/balcony, city/district/city_code/district_code/neighborhood/public_lat/lng, usages, primary_image, images[:10], created_at/updated_at — NO owner_name, owner_phone, exact_address, legal_info
- _public_property_to_list_item(): lightweight for search — id, code, title, type, transaction, price, rent_price, areas, rooms, parking/elevator, city/district/codes, primary_image, created_at
- _base_public_query(): select Property where is_deleted false and status published, options selectinload location/usages/media — NO tenant filter (public across all orgs)
- GET /public/properties: list with filters property_type, transaction_type, city_code, district_code, min_price, max_price, min_area, max_area, has_parking, has_elevator, rooms, q LIKE title/description/code, pagination limit/offset, order id desc, returns ok(data, page_meta)
- GET /public/properties/by-code/{code}: detail by code, 404 if not published
- GET /public/properties/{id}: detail by id, 404 if not published
- GET /public/og/{code}: returns HTMLResponse with OG tags + JSON-LD structured data for RealEstateListing, title, description 160 chars, image, price, city/district, url /p/{code}, twitter card, style simple card, script redirect to SPA if not crawler (bot check via userAgent), 404 HTML if not found

**SEO:**
- OG: og:type website, site_name املاک علی‌بابا, title, description price + city, image primary_image, url /p/{code}
- Twitter: card summary_large_image, title, description, image
- JSON-LD: @context schema.org, @type RealEstateListing, name, description, url, image, offers price/IRR, address locality/region
- index.html has default OG, dynamic OG updated via JS in SPA for public detail
- Deep Links: /p/{code} for property, /d/{code} for deal (future) — frontend parsePublicPath() regex /\/p\/([^\/\?]+)/ and /\/d\/

**Frontend Public View (App.tsx):**
- parsePublicPath() checks pathname /p/CODE, /d/CODE, or ?view=public&code=...
- isPublicView = type p && code present → shows public page without auth, no session needed
- loadPublic(): publicListProperties limit 20
- loadPublicDetail(code): publicGetByCode, updates document.title and meta description/og:title/og:description/og:image dynamically
- Public UI: header with title + link to app "/", offline banner, loading, detail card with image, code, city/district, title, price, description, badges type/transaction/area, share Telegram button (t.me/share/url), copy link button, deep link info, list of published properties with image 60x60, code, city, price, link /p/{code}
- Authenticated tabs include new "عمومی" tab showing public properties + OG HTML link + /p/{code} links
- Properties list shows /p/{code} link for each
- Deals list shows /d/{code} link (future)

**Tests:**
- tests/test_public.py: 2 tests — test_public_properties (create published + draft, public list only published, by-code published OK, draft 404, by-id OK, OG HTML contains og:title and ld+json, OG draft 404), test_public_search_filters (filter by property_type villa, filter by q شمال) — total 42 passed (40+2)

## Alternatives

- **Workbox InjectManifest vs generateSW:** generateSW chosen for simplicity, precache + runtimeCaching کافی است، InjectManifest برای custom SW logic آینده
- **Public API with tenant filter:** رد شد — public باید across all orgs باشد برای www، tenant isolation فقط برای private API
- **SSR for OG:** رد شد — فعلا HTMLResponse ساده با OG tags کافی است، SSR پیچیده برای Local-First (بند 99 Performance)
- **Offline with IndexedDB:** فعلا localStorage outbox ساده کافی است، IndexedDB برای آینده با sync بیشتر
- **Separate repo for public www:** رد شد — یک codebase per بند Local-First → PWA → Android/iOS → Public Web → Multi-Tenant

## Consequences

**مثبت:**
- PWA installable: manifest, icons 72-512, theme #1B3A5C, standalone, rtl fa
- Service Worker: precache 36 entries, runtime cache api 5min + public 1h, autoUpdate
- Offline: detection + banner + outbox + offline.html fallback
- Public Platform: no auth, only published, Public DTO no private fields, filters, pagination
- SEO: OG + Twitter + JSON-LD RealEstateListing, dynamic meta update in SPA, /public/og/{code} returns crawler-friendly HTML + redirect to SPA for users
- Deep Links: /p/{code} and /d/{code} — بند 62
- Tests: 2 new public, total 42 passed
- Frontend build: vite build success, dist with sw.js, workbox, manifest.webmanifest
- Icons: generated 512 base + resized 192,180,144,96,72,48,32 + pwa-192/512 + apple-touch-icon + favicon

**منفی:**
- Offline outbox فقط create_property — بقیه operations (person, visit, deal) هنوز offline نیستند
- Public images از file_path نسبی — برای OG crawler باید absolute URL باشد (TODO: base URL)
- No SSR — crawlerها OG را از /public/og/{code} می‌گیرند نه از SPA /p/{code}، اما /p/{code} SPA هم OG dynamic دارد برای JS crawlers
- Service Worker devOptions enabled true — در dev هم SW فعال است (ممکن است cache مزاحم شود، اما برای تست PWA لازم است)
- No push notifications yet — PWA ready for future push adapter

**Future:**
- IndexedDB for offline storage + background sync
- Public www separate deployment with Nginx serving /p/{code} → /public/og/{code} for crawlers, / → SPA
- Push notifications via Service Worker
- Public search page with map, filters, SEO pagination
- Deal public page /d/{code} if deal should be public
- Absolute image URLs for OG
- Lighthouse PWA audit 100
