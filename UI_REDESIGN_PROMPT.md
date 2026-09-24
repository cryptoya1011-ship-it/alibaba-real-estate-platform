# 🎨 UI/UX FULL REDESIGN BRIEF — AREP (Alibaba Real-Estate Platform)

> 🇮 **نکته برای کاربر:** این فایل + زیپ پروژه را به هوش مصنوعی بدهید. این بریف طوری نوشته شده که AI نتواند هیچ قابلیتی را حذف یا خراب کند و فقط رابط گرافیکی را مدرن کند.
>
> **Note for the AI:** You are a world-class product designer + senior React architect. Your ONLY job is to completely redesign the frontend UI/UX of this project to a premium, modern, 2026-grade experience — in BOTH the tenant/admin panel and the user/public side — with **zero feature loss and zero backend changes**. Read this entire brief, then read the repo, then implement.

---

## 1. PROJECT CONTEXT

- **AREP** = multi-tenant real-estate CRM/platform (Persian 🇮🇷, **RTL**, Local-First PWA).
- Monorepo layout:
  - `backend/` — FastAPI + SQLAlchemy + Alembic. **DO NOT MODIFY. EVER.**
  - `frontend/` — React 18 + TypeScript + Vite + vite-plugin-pwa. **THIS IS YOUR CANVAS.**
  - `docs/`, `API_CONTRACT.md`, `UI_UX.md`, `ARCHITECTURE.md` — read them.
- Current frontend is a **single 1440-line `App.tsx` with inline styles and `alert()` calls** — functional but visually poor. Keep ALL of its behavior; replace ALL of its look and structure.
- Primary device: **Android phone (≈360–412 px wide, Chrome, possibly inside Termux)** → mobile-first is mandatory. Secondary: desktop ≥1280 px.

### Read these files BEFORE writing any code (in this order):
1. `README.md`, `UI_UX.md`, `API_CONTRACT.md`
2. `frontend/src/api.ts` ← **single source of truth for every API call & the response envelope `{success, data, error, meta}`**
3. `frontend/src/App.tsx` ← **single source of truth for the feature inventory (§4)**
4. `frontend/src/telegram.ts`, `frontend/src/pwa.ts`, `frontend/vite.config.ts`, `frontend/index.html`, `frontend/public/` (manifest, icons, offline.html)

---

## 2. HARD CONSTRAINTS (violating ANY = failure)

1. **Backend is frozen.** No changes to `backend/`, `nginx/`, `docker-compose.yml`, `scripts/`, `docs/` (except adding ONE new file `docs/UI_REDESIGN_NOTES.md`, see §8).
2. **All network calls go through `frontend/src/api.ts`.** Keep its exported function names/signatures (you may add helpers, types, and refactors that preserve behavior). Envelope, `ApiError`, JWT in localStorage, Idempotency-Key headers, and the offline **Outbox** (`arep_outbox` in localStorage) must keep working.
3. **Feature parity is law.** Every item in §4 must exist and work after your redesign. When beauty conflicts with a feature, the feature wins.
4. **PWA must stay alive:** keep `vite-plugin-pwa` config, `manifest`, icons, `offline.html`, service worker registration. Keep `vite.config.ts` dev-server `host: 0.0.0.0` and the `/api → http://127.0.0.1:8000` proxy.
5. **Telegram Web App support stays:** keep `telegram.ts`, the Telegram script tag in `index.html`, and the login flow: inside Telegram → `loginTelegram(initData)`; outside → `devLogin(1000001)`.
6. **RTL + Persian everywhere:** `<html dir="rtl" lang="fa">`, ALL UI copy in Persian, numbers/dates via `fa-IR` locale (tabular digits for prices), **Vazirmatn** font (self-host woff2 or CDN with graceful fallback). No LTR leaks except codes/IDs/slug (render those in a `dir="ltr"` mono span).
7. **`npm run build` (`tsc -b && vite build`) must pass with ZERO TypeScript errors.** `npm run dev` must boot and talk to the backend.
8. **No `window.alert/confirm/prompt` anywhere.** Use toasts + dialogs. No inline `style={{...}}` hacks — everything via the design system.
9. Do not touch `.git`. Do not commit unless explicitly asked by the human.

---

## 3. DESIGN VISION — "premium 2026, شیک و مدرن"

### Stack (install & use consistently):
- **Tailwind CSS v4** with CSS-variable **design tokens** (color, radius, shadow, spacing, type scale).
- **shadcn/ui-style** accessible component layer built on **Radix UI** primitives (dialog, dropdown, tabs, switch, select, toast slot).
- **lucide-react** icons • **framer-motion** micro-interactions • **sonner** toasts (RTL-positioned) • **react-hook-form + zod** for every form • **react-router-dom** for routing • **recharts** for admin dashboards • **cmdk** command palette (nice-to-have).

### Visual language:
- NOT an old Bootstrap/antd admin template. NOT glassmorphism-everywhere. NOT default blue/purple.
- Palette: **deep teal/emerald primary** + **warm sand/amber accent** over **dark slate/navy surfaces** (dark mode default) with a polished **light mode** (toggle, persisted, respects `prefers-color-scheme`).
- Soft layered elevation, 14–16px radii on cards, hairline borders (`1px` with `color-mix`), subtle gradient only on primary CTAs, gentle blur on overlays/command-palette only.
- Typography: Vazirmatn variable; clear hierarchy (display 22–28, title 16–18, body 14, caption 12); `font-feature-settings: "tnum"` for prices/metrics.
- Motion: 150–250ms ease-out; button press-scale 0.97; spring tab indicator; staggered list entrance; skeletons that match final layout; honor `prefers-reduced-motion`.
- Mobile shell: sticky top app-bar (org chip + theme + notifications bell with unread badge + offline dot) and a **bottom navigation bar** with 5 primary destinations + a "بیشتر" sheet for the rest; safe-area insets; 44px min tap targets.
- Desktop shell (≥1024px): right-side **sidebar** (RTL!) with grouped nav + topbar with search/command-palette trigger.
- Every list has: **skeleton loading**, **empty state** (icon + Persian hint + CTA), **error state** with retry button, **success toast**.
- Accessibility: visible focus rings, aria-labels on icon buttons, AA contrast in both themes.

---

## 4. FEATURE INVENTORY — parity checklist (verify each one works after redesign)

### 4.1 Auth & organization
- Dev login (`devLogin(1000001)`) & Telegram initData login; session persistence; logout.
- Org **create** (name + slug, idempotency key), org **list**, org **select** (re-issues JWT with organization_id), header shows current org slug + roles; online/offline indicator; unread notifications badge.

### 4.2 Tenant panel — 12 tabs (may become routes/nav items, but ALL must exist)
1. **املاک Properties** — list w/ search & filters (status/type/transaction); create form (title, property_type, transaction_type, area_m2, price_toman, city, district, features like parking/elevator, description); show generated code `AB-…`; copy public link `/p/{code}`; favorite ★ toggle (optimistic); AI suggest description button.
2. **مشتریان CRM** — list; create person (display_name, phone, …); per-person "تطبیق درخواست‌ها" (listRequests → aiMatchRequest).
3. **بازدید Visits** — list; create visit (property + person + datetime); toast mentions notification creation.
4. **معاملات Deals** — list; create deal (title, person_id, amount); **stage pipeline UI** (lead → … → closed_won/closed_lost) with "مرحله بعد" button using `version` (optimistic locking; on 409 refresh); **history viewer** (`getDealHistory`) shown as a timeline, not `alert()`.
5. **تیم Team** — invitations list; create invitation (telegram_id + role) → **one-time token** shown once in a dialog with copy button; revoke invitation; **accept invitation by token** input.
6. **نقش‌ها Roles** — system + custom roles list; create custom role (code, title, permission checkboxes); delete custom role.
7. **🤖 AI** — providers status chips; parse query (show structured fields); search+execute (results list); match by request / by property (score bars 0–1 + Persian reasons); suggest description.
8. **🔌 یکپارچه Integrations** — providers grid (telegram/sms/divar/sheypoor/payment/maps, configured 🔑 flags); Telegram send (chat_id+text); send property to Telegram; **Deep Link** generator; SMS send; SMS OTP; publish listing to Divar/Sheypoor; create payment (amount+desc → show payment URL as tappable link); geocode address (show coords + OSM link); distance tool; **logs table** with reload.
9. **عمومی Public** — public properties list (no auth), detail view; route `/p/:code` works unauthenticated with beautiful public property page (gallery placeholder, price in Persian digits, features, OSM map link).
10. **★ Favorites** — list; add/remove.
11. **🔔 Notifications** — list with unread highlight; mark-all-read; live badge count.
12. **👑 ادمین Admin** (super-admins only; hide otherwise) — global stats cards + charts (recharts), organizations list w/ per-org stats drill-down, users list, super-admin toggle switch.

### 4.3 Offline / PWA
- Offline banner; Outbox queue UI (pending count); **Sync** button replaying queued `createProperty` with their idempotency keys; PWA install prompt button when available.

---

## 5. INFORMATION ARCHITECTURE (suggested routes)

```
/login            → auth (auto-detect Telegram)
/orgs             → org select / create
/app              → shell (topbar + bottom-nav / sidebar)
/app/properties   /app/crm   /app/visits   /app/deals
/app/team         /app/roles /app/ai       /app/integrations
/app/favorites    /app/notifications        /app/admin
/p/:code          → public property page (no auth, own minimal shell)
*                 → 404
```

---

## 6. CODE ARCHITECTURE (frontend/src)

```
lib/        api.ts (kept), format.ts (fa digits, toman, dates), cn.ts, constants.ts
hooks/      useSession, useApi (loading/error/retry), useOnline, useOutbox, useTheme
components/ui/      button, card, input, select, dialog, sheet, tabs, badge, toast, skeleton, empty-state, table, stat-card, score-bar, timeline
components/layout/  AppShell, Topbar, BottomNav, Sidebar, OrgSwitcher, CommandPalette
features/<domain>/  properties/, crm/, visits/, deals/, team/, roles/, ai/, integrations/, public/, favorites/, notifications/, admin/, auth/
```

- Strict TS: type every payload from `API_CONTRACT.md`; ban `any` in new code.
- Persian microcopy: friendly-professional, short labels; errors in Persian with a retry action.

---

## 7. QA — self-verify before delivery

- [ ] `npm run build` passes, zero TS errors.
- [ ] Walk through EVERY §4 item on a 360px viewport AND 1280px, in dark AND light.
- [ ] Offline test: go offline → banner shows → create property → appears in Outbox → go online → Sync → success toast → property in list.
- [ ] No `alert(`, no inline styles, no English UI strings, no LTR text runs.
- [ ] PWA manifest + SW still register; `/p/:code` reachable unauthenticated.

---

## 8. DELIVERABLES

1. Redesigned frontend **in place** in the repo.
2. `docs/UI_REDESIGN_NOTES.md` — your decisions: tokens, palette hex values, component list, route map, what you improved.
3. **Final package:** produce `arep-ui-redesign.zip` of the whole project **excluding** `node_modules/`, `.venv/`, `.git/`, `dist/`, `*.db`, `__pycache__/` (e.g. `zip -r arep-ui-redesign.zip . -x "node_modules/*" "*/node_modules/*" ".git/*" "*/.venv/*" "*/dist/*" "*.db" "*/__pycache__/*"` — adapt to your environment). If the human instead asks for GitHub: create branch `ui/redesign-v1` and push only that branch.
4. Final message: bullet summary of changes + run instructions + explicit confirmation that each §4 item passed.

## 9. ORDER OF WORK

1. Read §1 files. 2. Print a short plan (screens, tokens, components). 3. Build design system + shell. 4. Migrate features domain-by-domain. 5. Run §7 QA. 6. Package §8.

**Remember: you are redesigning the *experience*, not the *product*. The product's behavior is sacred.**
