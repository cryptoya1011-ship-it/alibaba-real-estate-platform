# ADR-0019: اتصال‌های صادق — حذف APIهای جعلی

**تاریخ:** 2026-09-27
**وضعیت:** پذیرفته‌شده — جایگزین بخش‌هایی از ADR-0016 و ADR-0017

## زمینه
قانون MASTER PROMPT: «هیچ Integration یا API جعلی؛ Mock فقط در تست؛ وضعیت واقعی اتصال نمایش داده شود».
بررسی کد (گزارش §78) نشان داد:
- `TelegramBotProvider`، `KavenegarSmsProvider`، `DivarListingProvider`، `SheypoorListingProvider`، `ZarinpalPaymentProvider` و `OsmMapsProvider` با وجود نام واقعی، **همان خروجی Mock** را برمی‌گرداندند (`mock_fallback`, `real_api: False`) و صفحهٔ «اتصال‌ها» آن‌ها را «متصل» نشان می‌داد.
- `OpenAIProvider` / `GeminiProvider` / `ClaudeProvider` / `LocalProvider` خروجی موتور قاعده‌محور را با برچسب `[OpenAI]` و `parsed_by: "openai"` برمی‌گرداندند.
- `POST /ai/search/parse` با فیلد `use_provider` مقدار سراسری `AI_PROVIDER` کل پردازه را عوض می‌کرد (هر کاربر می‌توانست تنظیم همه را تغییر دهد).

## تصمیم
1. **سه حالت صریح برای هر اتصال** در `GET /integrations/providers` (`details.*`):
   - `live` — اتصال واقعی پیاده‌سازی شده و تنظیم کامل است.
   - `test` — حالت آزمایشی داخلی (Mock صریح، `provider: "mock"`)؛ هیچ داده‌ای از سیستم خارج نمی‌شود.
   - `unavailable` — ارائه‌دهندهٔ واقعی انتخاب شده ولی پیاده‌سازی نشده یا کلید ندارد؛ `reason` فارسی توضیح می‌دهد.
   به‌علاوه `connected`، `implemented`، `has_key`. کلیدها هرگز برگردانده نمی‌شوند.
2. **تلگرام واقعی:** `TelegramBotProvider` با `httpx` مستقیم به `api.telegram.org` (`getMe`, `sendMessage`). خطای شبکه یا `ok:false` → `502 EXTERNAL_SERVICE_ERROR` بدون URL (URL حاوی توکن است). بدون توکن → `503 INTEGRATION_UNAVAILABLE`. Endpoint جدید `POST /integrations/telegram/validate` (مجوز `integration:manage`).
3. **نقشه واقعی:** `OsmMapsProvider` از Nominatim (`/search`, `/reverse`) با User-Agent و `countrycodes=ir` استفاده می‌کند؛ فاصله با haversine داخلی (`provider: "haversine"`).
4. **پیاده‌نشده‌ها صادقانه خطا می‌دهند:** کاوه‌نگار، دیوار، شیپور و زرین‌پال `implemented=False` و در صورت انتخاب `503` («هنوز پیاده‌سازی نشده»). حالت `mock` آن‌ها همچنان برای آزمایش در دسترس است و با برچسب «حالت آزمایشی» نمایش داده می‌شود.
5. **AI:** کلاس‌های جعلی LLM حذف شدند. `get_provider()` همیشه موتور قاعده‌محور فارسی (`MockProvider`، نمایش: «موتور داخلی») را برمی‌گرداند. `GET /ai/providers` فیلدهای `requested`، `current` (فعال واقعی)، `note` و `implemented` برای هر ارائه‌دهنده را برمی‌گرداند. `use_provider` پذیرفته ولی بی‌اثر است و دیگر تنظیم سراسری را تغییر نمی‌دهد.
6. `tests/conftest.py` همهٔ ارائه‌دهنده‌ها را روی `mock` قفل می‌کند تا تست‌ها به `.env` توسعه‌دهنده و شبکه وابسته نباشند. تست تلگرام واقعی با `httpx.MockTransport` از طریق `adapter.HTTP_TRANSPORT` انجام می‌شود.
7. `httpx>=0.27` به `requirements.txt` (runtime) اضافه شد.

## پیامدها
- صفحهٔ «اتصال‌ها» حالا برای هر سرویس «متصل / حالت آزمایشی / متصل نیست» را درست نشان می‌دهد و دکمهٔ «بررسی اتصال» برای تلگرام دارد.
- اتصال واقعی پیامک/پرداخت/دیوار/شیپور/LLM هر کدام نیازمند Sprint جداگانه با مستندات رسمی API است (قانون «دربارهٔ API خارجی حدس نزن»).
