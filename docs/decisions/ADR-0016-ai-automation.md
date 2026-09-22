# ADR-0016: AI / Automation — AI Adapter + Persian NLP + Auto Matching

**Date:** 2026-09-21
**Status:** Accepted
**Phase:** 14 AI / Automation

## Context

- ROADMAP Phase 14 requires: AI Adapter provider قابل تعویض (OpenAI/Gemini/Claude/Local/Mock), Natural Language Search فارسی → Structured Query, Auto matching Request↔Property with score 0-1 + reasons, AI-ready Architecture Core جدا از AI.
- Constraints: Local-First deterministic mock for tests, no external API required, fallback if no API key, tenant-aware, permissions ai:search/match/suggest/manage.
- Existing: Property search via structured filters, CustomerRequest model with area_min/max budget_min/max rooms, TenantRepository isolation.

## Decision

### AI Adapter Abstract

- `app/modules/ai/adapter.py` — `AIProvider` abstract with `parse_search_query(text) -> ParsedSearchQuery`, `suggest_description(property_data) -> str`, `match_score(request_data, property_data) -> (float, list[str])`.
- Providers:
  - `MockProvider`: Rule-based Persian deterministic, no external API. Normalizes Persian digits ۰-۹→0-9, extracts property_type (آپارتمان→apartment, ویلا→villa, زمین→land, تجاری→commercial, اداری→office), transaction_type (فروش→sale, اجاره→rent, معاوضه→exchange), city (اصفهان→ISF, تهران→THR, شیراز→SHZ, مشهد→MSH, تبریز→TBZ), district (مرداویج→MJ, شهرک غرب→SHG, سعادت آباد→SAD, ولیعصر→VAL, جردن→JOR, زعفرانیه→ZAF), area (120 متری, 100 متر, از X متر, تا X متر), rooms/bedrooms (2 خوابه, 3 خواب, 2 اتاق), amenities (پارکینگ→has_parking, آسانسور→has_elevator, انباری→has_warehouse, بالکن→has_balcony), price (تا 20 میلیارد→max_price 20e9, از 10 میلیارد→min_price, میلیون handling). Confidence 0.5 + 0.08*filled fields capped 0.95. Match score 0.3 base + type match +0.2, transaction +0.15, city +0.15, district +0.1, area range +0.15, budget +0.15, rooms +0.1, amenities +0.05 each. Suggest description template Persian.
  - `OpenAIProvider`, `GeminiProvider`, `ClaudeProvider`, `LocalProvider`: Each tries to use API if key present else fallback to MockProvider logic (no network in tests). OpenAI uses gpt-4o-mini prompt for JSON parse, Gemini gemini-pro, Claude claude-3-haiku.
  - Factory `get_provider(name=None)` reads `AI_PROVIDER` env (mock, openai, gemini, claude, local) or explicit use_provider param from API, returns instance. `list_providers()` returns current, available, details with has_key flag.
- Settings: `AI_PROVIDER=mock` default, `OPENAI_API_KEY`, `GEMINI_API_KEY`, `CLAUDE_API_KEY`, `ANTHROPIC_API_KEY` optional in `app/core/config.py` + `.env.example`.

### AI Service

- `app/modules/ai/service.py` — `AIService` tenant-aware (requires `get_tenant_context`, `get_db`).
- `parse_search_query(text)`: validates length 2-1000, gets provider, calls `parse_search_query`, builds `filters` dict (property_type, transaction_type, city_code, district_code, min_price, max_price, min_area, max_area, rooms, has_parking, has_elevator) — q NOT included to avoid restrictive LIKE search (found bug where q caused 0 results). Returns parsed object + filters.
- `match_request_to_properties(request_id, limit)`: Gets request via `CustomerRequestRepository.get`, builds request_data mapping actual fields `area_min→min_area, area_max→max_area, budget_min→min_budget, budget_max→max_budget, rooms→min_rooms, person_id`, searches properties via `PropertyRepository.search` with same property_type/city_code filters (limit 50), scores each via provider.match_score, returns list sorted desc where matched or score>=0.4.
- `match_property_to_requests(property_id, limit)`: Reverse, gets property with location codes via `_get_property_with_location`, lists requests via `CustomerRequestRepository.list` (50), scores, returns >=0.4 sorted.
- `suggest_description(property_id)`: Builds prop_data and calls provider.suggest_description.

### API

- `app/api/v1/ai.py` — `GET /ai/providers` (auth required), `POST /ai/search/parse` body {text, use_provider?} → {parsed, filters, provider}, `POST /ai/search/execute` parse+search via repo.search + pagination meta, `POST /ai/match/request/{id}` body {limit} → [{property, score, reasons, matched, provider}], `POST /ai/match/property/{id}` → [{request, score, reasons, matched, provider}], `POST /ai/suggest/description/{property_id}` → {suggested_description, provider}.
- Permissions: `ai:search`, `ai:match`, `ai:suggest`, `ai:manage` added to `ALL_PERMISSIONS`, ORG_ADMIN all, BRANCH_ADMIN search/match/suggest, AGENT search/match/suggest. Added to `app/modules/rbac/service.py`.
- Router: Added to `app/api/v1/router.py` at `/api/v1/ai/*`.

### Frontend

- `frontend/src/api.ts`: `aiListProviders`, `aiParseSearch`, `aiSearchExecute`, `aiMatchRequest`, `aiMatchProperty`, `aiSuggestDescription`.
- `frontend/src/App.tsx`: tab `ai` (🤖 AI) purple #6A1B9A/#F3E5F5, states aiQuery (default Persian example), aiParsed, aiResults, aiProviders, aiMatches, aiDesc, loadAIProviders callback called in org useEffect, 5 handlers handleAIParse/handleAISearchExecute/handleAIMatchRequest/handleAIMatchProperty/handleAISuggestDesc, provider chips (current, available, details has_key), natural search input + Parse/Execute buttons, parsed JSON monospaced, results list with match/suggest buttons, auto matching section sample persons/properties (via listRequests), matches list score badge green>=0.7 orange>=0.5 gray else + reasons, aiDesc box.

## Consequences

- Positive: Core جدا از AI — AIService uses adapter interface, provider interchangeable via env, no business logic in API/Frontend. Mock deterministic for tests, no external API required, fallback if no key.
- Positive: Persian NLP rule-based covers common real-estate queries without LLM, confidence metric, filters directly usable in property search.
- Positive: Auto matching with score 0-1 + reasons + matched flag (score>=0.7), tenant-aware, uses existing repositories.
- Negative: Mock provider limited to predefined cities/districts (ISF/THR/SHZ/MSH/TBZ, MJ/SHG/SAD/VAL/JOR/ZAF) — extensible via dict but not exhaustive. Real LLM providers fallback to mock currently (no actual API call to keep tests offline) — future work to implement real API calls with streaming.
- Negative: Property search in execute uses repo.search which may not have FTS — relies on exact filters, q omitted intentionally to avoid 0 results.
- Negative: No embedding/semantic search yet — only keyword rule-based + score heuristic. Future: embedding via OpenAI/Gemini + vector DB.

## Alternatives Considered

- Direct OpenAI SDK in service: rejected, violates AI-ready Architecture (Core جدا از AI), creates vendor lock-in, requires key for tests.
- Separate AI microservice: rejected, Modular Monolith per constraints, one codebase.
- LLM-only parsing: rejected, Local-First requires deterministic mock without internet, fallback mandatory.

## Verification

- `pytest tests/test_ai.py` — 5 passed: providers list, Persian parse apartment 120m Mardavij Isfahan parking elevator up to 15B → property_type apartment city اصفهان district مرداویج has_parking/elevator true max_price 15B + filters, execute search (create apartment ISF 14B + villa THR 50B, search 'آپارتمان در اصفهان تا 15 میلیارد' → finds apartment), match request↔property score>=0.5 both directions, suggest len>20.
- `pytest -k "not test_alembic"` — 51 passed.
- Frontend build: `npm run build` OK, 11 tabs including AI.
- Manual: AI tab provider badges, natural search input default "آپارتمان 120 متری در مرداویج اصفهان با پارکینگ و آسانسور تا 15 میلیارد", Parse shows parsed JSON, Execute shows results, matching buttons show score+reasons.
