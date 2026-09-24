import { vi } from "vitest";

/* ── envelope helpers ────────────────────────────────────────────────── */
export const okRes = (data: unknown) => ({
  ok: true,
  status: 200,
  json: async () => ({ success: true, data, meta: null, error: null }),
});

export const errRes = (code: string, message: string, status = 400) => ({
  ok: false,
  status,
  json: async () => ({ success: false, data: null, meta: null, error: { code, message, details: [] } }),
});

/* ── fixtures ────────────────────────────────────────────────────────── */
export const ORG = { id: 1, name: "املاک علی‌بابا اصفهان", slug: "alibaba-isf", is_owner: true };

export const sessionNoOrg = {
  access_token: "token-no-org",
  expires_at: "2030-01-01T00:00:00",
  user: { id: 1, telegram_id: 1000001, display_name: "Dev", is_super_admin: true },
  organization_id: null,
  branch_id: null,
  roles: [],
  permissions: [],
  organizations: [],
};

export const sessionWithOrg = {
  ...sessionNoOrg,
  access_token: "token-with-org",
  organization_id: 1,
  branch_id: 1,
  roles: ["organization_admin"],
  permissions: ["property:read", "property:create", "customer:read"],
  organizations: [ORG],
};

export const PROPERTIES = [
  {
    id: 1,
    code: "AREP-ISF-MJ-AP-S-2609-00001",
    title: "آپارتمان ۱۲۰ متری مرداویج با پارکینگ",
    property_type: "apartment",
    transaction_type: "sale",
    price: 15_000_000_000,
    built_area: 120,
    city: "اصفهان",
    district: "مرداویج",
    status: "published",
    primary_image: null,
  },
  {
    id: 2,
    code: "AREP-ISF-MJ-VI-S-2609-00002",
    title: "ویلا دوبلکس با استخر",
    property_type: "villa",
    transaction_type: "sale",
    price: 48_000_000_000,
    built_area: 300,
    city: "اصفهان",
    district: "مرداویج",
    status: "draft",
    primary_image: null,
  },
];

export const PERSONS = [
  { id: 1, first_name: "رضا", last_name: "محمدی", phone: "09131112233", display_name: "رضا محمدی", roles: [{ role: "buyer" }] },
];

export const VISITS = [
  { id: 1, property_id: 1, customer_id: 1, visit_date: "2026-10-01", visit_time: "10:00:00", status: "scheduled" },
];

export const DEALS = [
  {
    id: 1,
    code: "DL-2609-00001",
    title: "معامله آپارتمان مرداویج",
    status: "qualification",
    customer_id: 1,
    property_id: 1,
    amount: 15_000_000_000,
    commission_total: 750_000_000,
    version: 2,
  },
];

export const NOTIFICATIONS = [
  { id: 1, title: "بازدید جدید ثبت شد", body: "بازدید برای رضا محمدی", priority: "important", is_read: false, created_at: "2026-09-24T14:00:40" },
];

export const PUBLIC_PROPERTY = {
  id: 1,
  code: "AREP-ISF-MJ-AP-S-2609-00001",
  title: "آپارتمان ۱۲۰ متری مرداویج با پارکینگ",
  description: "ملکی خوش‌نقشه در قلب مرداویج با دسترسی عالی.",
  property_type: "apartment",
  transaction_type: "sale",
  price: 15_000_000_000,
  built_area: 120,
  city: "اصفهان",
  district: "مرداویج",
  primary_image: null,
  images: [],
  created_at: "2026-09-24T14:00:36",
};

export const ROLES = [
  { id: 1, organization_id: null, code: "agent", title: "agent", is_system: true, permissions: ["property:read"] },
  { id: 9, organization_id: 1, code: "sales_manager", title: "مدیر فروش", is_system: false, permissions: ["property:read", "deal:update"] },
];

export const INVITATIONS = [
  {
    id: 1,
    organization_id: 1,
    invited_telegram_id: 555001,
    invited_phone: null,
    role_code: "agent",
    status: "pending",
    created_at: "2026-09-24T14:00:45",
  },
];

export const AI_PROVIDERS = {
  current: "mock",
  available: ["mock", "openai", "gemini", "claude", "local"],
  details: { mock: { type: "rule-based", requires_api_key: false, has_key: true } },
};

export const INT_PROVIDERS = {
  current: { telegram: "mock", sms: "mock", payment: "mock", maps: "mock", listings: ["divar", "sheypoor"] },
  available: { telegram: ["mock"], sms: ["mock"], listings: ["divar"], payment: ["mock"], maps: ["mock"] },
  details: { telegram: { provider: "mock", has_key: false }, sms: { provider: "mock", has_key: false } },
};

export const INT_LOGS = [
  { id: 3, provider: "payment_mock", action: "create_payment", status: "success", created_at: "2026-09-24T14:00:44", external_id: "pay_1" },
];

export const ADMIN_STATS = { organizations: 1, users: 1, branches: 1, properties: 2, persons: 1, visits: 1, deals: 1 };
export const ADMIN_ORGS = [{ id: 1, name: "املاک علی‌بابا اصفهان", slug: "alibaba-isf", city_code: "ISF", is_active: true }];
export const ADMIN_USERS = [{ id: 1, first_name: "Dev", last_name: null, telegram_id: 1000001, phone: null, is_super_admin: true }];

/* ── fetch mock ──────────────────────────────────────────────────────── */
export type RouteMap = Record<string, unknown>;

export function installFetchMock(overrides: RouteMap = {}) {
  const routes: RouteMap = {
    "POST /auth/dev-login": sessionWithOrg,
    "POST /auth/telegram": sessionWithOrg,
    "POST /auth/select-organization": sessionWithOrg,
    "POST /organizations": ORG,
    "GET /properties": PROPERTIES,
    "GET /persons": PERSONS,
    "GET /visits": VISITS,
    "GET /deals": DEALS,
    "GET /favorites": [],
    "GET /notifications": NOTIFICATIONS,
    "GET /notifications/unread-count": { unread_count: 1 },
    "GET /public/properties": [PUBLIC_PROPERTY],
    "GET /public/properties/by-code/AREP-ISF-MJ-AP-S-2609-00001": PUBLIC_PROPERTY,
    "GET /organizations/1/roles": ROLES,
    "GET /organizations/1/invitations": INVITATIONS,
    "GET /ai/providers": AI_PROVIDERS,
    "GET /integrations/providers": INT_PROVIDERS,
    "GET /integrations/logs": INT_LOGS,
    "GET /admin/organizations": ADMIN_ORGS,
    "GET /admin/users": ADMIN_USERS,
    "GET /admin/stats": ADMIN_STATS,
    "GET /admin/organizations/1/stats": { members_count: 1, branches_count: 1, properties_count: 2, persons_count: 1, visits_count: 1, deals_count: 1 },
    "GET /customer-requests": [{ id: 1, person_id: 1, property_type: "apartment" }],
    ...overrides,
  };

  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
    const path = url.replace(/^https?:\/\/[^/]+/, "").replace(/^\/api\/v1/, "").split("?")[0];
    const method = (init?.method ?? "GET").toUpperCase();
    const key = `${method} ${path}`;
    if (key in routes) return okRes(routes[key]);
    // any unmatched write endpoint succeeds with a generic payload
    if (method === "POST" || method === "PATCH") {
      if (path.startsWith("/properties")) return okRes({ ...PROPERTIES[0], id: 99, code: "AREP-ISF-MJ-AP-S-2609-00099" });
      if (path.startsWith("/persons")) return okRes(PERSONS[0]);
      if (path.startsWith("/deals")) return okRes(DEALS[0]);
      if (path.startsWith("/visits")) return okRes(VISITS[0]);
      return okRes({ ok: true });
    }
    if (method === "DELETE") return okRes({ ok: true });
    console.warn(`[mock-api] unmatched route: ${key}`);
    return errRes("NOT_FOUND", `unmocked route ${key}`, 404);
  });

  // @ts-expect-error test shim
  global.fetch = fetchMock;
  return fetchMock;
}
