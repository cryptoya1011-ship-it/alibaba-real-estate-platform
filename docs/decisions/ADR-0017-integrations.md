# ADR-0017: Integrations / Advanced Platform — Telegram / SMS / Listings / Payment / Maps

**Date:** 2026-09-21
**Status:** Accepted
**Phase:** 15 Integrations / Advanced Platform

## Context

- ROADMAP Phase 15 requires: Telegram Bot (Login, Notification, Deep Link), SMS, Divar, Sheypoor, Payment, Maps, هر Integration Adapter مستقل, No Vendor Lock-in.
- Constraints: Local-First deterministic mock for tests, no external API required, fallback if no API key, tenant-aware, permissions integration:*, OpenStreetMap به جای Google Maps per ADR-0008 (بدون وابستگی به سرویس‌های تحریم‌شده), Modular Monolith.
- Existing: Telegram initData HMAC validation exists, Notification model has channel in_app/telegram/sms/push/email but only in_app implemented, Property search, AI adapter pattern already proven.

## Decision

### Adapter Pattern — Core جدا از Integration

- `app/modules/integrations/adapter.py` — separate abstract per type, not one god class:
  - `TelegramProvider`: `send_message(chat_id, text, parse_mode, reply_markup)`, `send_property_card(chat_id, property_data)`, `create_deep_link(payload)` → t.me/{bot}?start={payload}
  - `SmsProvider`: `send_sms(phone, message)`, `send_otp(phone, code)`
  - `ListingProvider`: `publish(platform, property_data)`, `unpublish(platform, external_id)`, `get_status(platform, external_id)`
  - `PaymentProvider`: `create_payment(amount, description, callback_url, metadata)`, `verify_payment(payment_id)`
  - `MapsProvider`: `geocode(address)`, `reverse_geocode(lat,lng)`, `get_static_map_url(lat,lng,zoom)`, `calculate_distance(lat1,lng1,lat2,lng2)` haversine

- Providers per type:
  - Telegram: `MockTelegramProvider` (random message_id, deterministic), `TelegramBotProvider` (uses TELEGRAM_BOT_TOKEN if set, else fallback mock with tag telegram_bot_mock_fallback, real API would be https://api.telegram.org/bot{token}/sendMessage via httpx)
  - SMS: `MockSmsProvider` (message_id mock-{timestamp}), `KavenegarSmsProvider` (KAVENEGAR_API_KEY/SMS_API_KEY, fallback mock)
  - Listings: `MockListingProvider` (external_id platform-code-time, url https://{platform}.ir/v/{external_id}, views random), `DivarListingProvider` (DIVAR_API_KEY, fallback), `SheypoorListingProvider` (SHEYPOOR_API_KEY, fallback)
  - Payment: `MockPaymentProvider` (payment_id pay_{md5 hash 12}, payment_url https://payment.example.com/pay/{id}, amount), `ZarinpalPaymentProvider` (ZARINPAL_API_KEY/PAYMENT_API_KEY, fallback)
  - Maps: `MockMapsProvider` (geocode deterministic md5(address) → lat 32.65 + h%1000/10000, lng 51.66 + h%1000/10000, city detection اصفهان/تهران, confidence 0.85, reverse_geocode fixed مرداویج, static map OSM url https://www.openstreetmap.org/?mlat={lat}&mlon={lng}, distance haversine R=6371km), `OsmMapsProvider` (Nominatim https://nominatim.openstreetmap.org/search free, no key, self-hosted friendly, mock with osm tag for tests)

- Factories: `get_telegram_provider()` via TELEGRAM_PROVIDER env (mock/telegram_bot), `get_sms_provider()` via SMS_PROVIDER (mock/kavenegar), `get_listing_provider(platform)` via DIVAR_PROVIDER/SHEYPOOR_PROVIDER, `get_payment_provider()` via PAYMENT_PROVIDER (mock/zarinpal), `get_maps_provider()` via MAPS_PROVIDER (mock/osm). `get_all_providers_status()` returns current/available/details has_key (telegram_token, sms_key, divar_key, sheypoor_key, payment_key, maps always has_key true with note OSM free).

### Integration Service & Logging

- `app/modules/integrations/service.py` — `IntegrationService` tenant-aware (requires get_tenant_context, get_db), uses factories, logs every external call via `IntegrationLogRepository` (provider, action, entity_type/id, request_payload JSON, response_payload JSON, status success/failed/pending, error_message, external_id/url). Methods validate input (text min 1, phone min 7, amount>0, address min 2, platform in divar/sheypoor), call provider, log, flush.
- Specifics: `send_property_via_telegram` builds prop_data id/code/title/price/property_type and calls provider.send_property_card (card includes /p/{code} deep link). `send_otp` generates random 100000-999999 if code None, returns code only in mock mode (note: in prod don't return). `publish_listing` gets property via PropertyRepository.get, extracts city_code/district_code from location relationship, builds prop_data and calls provider.publish. `create_payment` defaults callback_url https://arep.local/payment/callback. `geocode` deterministic mock. `calculate_distance` haversine.

### Model & Migration

- `IntegrationLog` — TenantEntity, provider String(64), action String(64), entity_type String(64) nullable, entity_id BigInteger nullable, request_payload Text nullable, response_payload Text nullable, status String(16) default success, error_message Text nullable, external_id String(200) nullable, external_url String(500) nullable, indexes org_provider, org_created, provider_status.
- Migration `b2c3d4e5f6a7_add_integrations_phase_15.py` — creates integration_logs table + indexes + RLS ENABLE ROW LEVEL SECURITY + POLICY tenant_isolation FOR ALL USING (bypass=1 OR organization_id::text = current_setting('app.current_org_id')) WITH CHECK same. SQLite no-op for RLS. Added to `models_registry.py` to be included in Base.metadata for tests (create_all). Updated RLS second layer count now 20 tables.

### API

- `app/api/v1/integrations.py` — router prefix /integrations, tags integrations:
  - `GET /providers` — any authenticated user, returns get_all_providers_status()
  - Telegram: `POST /telegram/send` {chat_id, text, parse_mode} perm integration:telegram, `POST /telegram/send-property/{property_id}` {chat_id} perm telegram, `GET /telegram/deep-link?payload` perm any auth (creates t.me link)
  - SMS: `POST /sms/send` {phone, message} perm sms, `POST /sms/otp` {phone, code?} perm sms
  - Listings: `POST /listings/publish` {platform divar/sheypoor, property_id} perm listings, `POST /listings/unpublish` {platform, external_id} perm listings
  - Payment: `POST /payment/create` {amount, description, callback_url?, metadata?} perm payment, `GET /payment/verify/{payment_id}` perm payment
  - Maps: `POST /maps/geocode` {address} perm maps, `POST /maps/reverse-geocode` {lat,lng} perm maps, `GET /maps/static-map?lat=&lng=&zoom=` perm maps, `POST /maps/distance` {lat1,lng1,lat2,lng2} perm maps
  - Logs: `GET /logs?limit&offset&provider&status` perm logs, returns list id/provider/action/entity_type/entity_id/status/external_id/external_url/error_message/created_at + pagination meta

- Permissions: integration:telegram, integration:sms, integration:listings, integration:payment, integration:maps, integration:logs, integration:manage added to ALL_PERMISSIONS, ORG_ADMIN all, BRANCH_ADMIN telegram/sms/listings/maps/logs, AGENT telegram/maps. Added to `app/core/permissions.py` + `SYSTEM_ROLE_PERMISSIONS`.

- Router: Added to `app/api/v1/router.py` at /api/v1/integrations/*

### Frontend

- `frontend/src/api.ts` — intListProviders, intTelegramSend, intTelegramSendProperty, intTelegramDeepLink, intSmsSend, intSmsOtp, intPublishListing, intUnpublishListing, intCreatePayment, intVerifyPayment, intGeocode, intReverseGeocode, intStaticMap, intDistance, intListLogs
- `frontend/src/App.tsx` — tab integrations 🔌 یکپارچه blue #1565C0/#E3F2FD, states intProviders, intTelegramChatId/Text, intSmsPhone/Message, intMapsAddress/Result, intPaymentAmount/Desc, intLogs, intResults, loadIntProviders callback (providers + logs limit 10) called in org useEffect, 8 handlers handleIntTelegramSend, handleIntTelegramSendProperty, handleIntSmsSend, handleIntSmsOtp, handleIntPublish, handleIntPaymentCreate, handleIntGeocode, handleIntDistance, tab button, full section tab==="integrations" with provider status chips current+has_key, 2x2 grid: Telegram (chat_id+text+send+deep-link+property cards for first 2 properties), SMS (phone+message+send+OTP), Listings (Divar/Sheypoor publish per first 3 properties), Payment (amount+desc+create link), Maps section (geocode address input + Geocode button + distance Isfahan-Tehran button + result box with lat/lng/city/address + OSM link), Results list mock deterministic (success badge, provider, url/payment_url), Logs list audit with external_id/url, architecture note.

### Config

- `app/core/config.py` adds TELEGRAM_PROVIDER, TELEGRAM_BOT_USERNAME, SMS_PROVIDER, SMS_API_KEY, KAVENEGAR_API_KEY, DIVAR_PROVIDER, DIVAR_API_KEY, SHEYPOOR_PROVIDER, SHEYPOOR_API_KEY, PAYMENT_PROVIDER, PAYMENT_API_KEY, ZARINPAL_API_KEY, MAPS_PROVIDER, OSM_NOMINATIM_URL
- `.env.example` adds same with mock defaults + comments, OSM free no key

## Consequences

- Positive: Core جدا از Integration — IntegrationService uses adapter factories, no direct external SDK, provider interchangeable via env, mock deterministic for tests, no external API required, fallback if no key, No Vendor Lock-in, OSM instead of Google Maps per ADR-0008, Kavenegar/Zarinpal generic but mock default.
- Positive: Audit via IntegrationLog tenant-aware + RLS, logs every external call with request/response, external_id/url for tracking, filterable.
- Positive: Telegram deep link t.me/{bot}?start={payload} enables Login, Notification, Deep Link per roadmap (property card includes /p/{code}).
- Positive: Maps geocode deterministic mock based on address hash allows testing without Nominatim, OSM provider tag ready for real Nominatim call via httpx in future.
- Negative: Real API calls not yet implemented (httpx calls) — currently mock with provider tag, needs future work to implement actual HTTP calls with retry, timeout, error handling.
- Negative: Listing publish only returns mock external_id/url, no real Divar/Sheypoor API integration yet — adapter structure ready, needs real API docs and keys.
- Negative: Payment create returns mock payment_url, no real Zarinpal flow (request + redirect + verify) — structure ready, needs real implementation.
- Negative: SMS OTP code returned in response only in mock mode (security risk if left in prod) — documented note, should be removed in prod and sent only via SMS.

## Alternatives Considered

- Single IntegrationProvider god class with all methods: rejected, violates Single Responsibility, harder to mock per type, we use separate abstract per domain but central service.
- Direct SDK usage in service (e.g., python-telegram-bot, kavenegar): rejected, creates vendor lock-in, requires keys for tests, violates Core جدا از Integration, we use adapter with fallback.
- Separate microservices for each integration: rejected, Modular Monolith per constraints, one codebase, Local-First.
- Google Maps: rejected per ADR-0008 (sanctioned, requires API key, not self-hosted), we use OpenStreetMap Nominatim free, no key, self-hosted friendly.

## Verification

- `pytest tests/test_integrations.py` — 7 passed: providers list (current/available/details), telegram send mock (success + message_id + deep_link t.me), sms send mock (to phone + otp 6-digit), listings publish mock (create property + publish divar/sheypoor + unpublish), payment mock (create 500k amount + payment_id + payment_url + verify), maps mock (geocode اصفهان مرداویج → lat 30-40 lng 45-60 + reverse + static OSM url + distance Isfahan-Tehran >300km), integration_logs (telegram send creates log, list logs >=1, filter provider).
- `pytest -k "not test_alembic"` — 58 passed (51 previous + 7 new), 1 deselected alembic.
- `alembic upgrade head` — OK on SQLite (RLS no-op for integration_logs), creates table integration_logs, enables RLS on PostgreSQL.
- Frontend: `npm run build` OK, 12 tabs including Integrations 🔌, provider chips, 2x2 grid, maps OSM link, logs.
- Manual: Integrations tab provider status, Telegram send, SMS send, Divar/Sheypoor publish, Payment create, Maps geocode → OSM link, Logs list.
