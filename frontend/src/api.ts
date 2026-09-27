/** API client. Every response uses the {success, data, meta, error} envelope. */
import type {
  AdminGlobalStats,
  AdminOrgStats,
  AdminUser,
  AIDescription,
  AIMatch,
  AIParsed,
  AIProviders,
  AISearchResult,
  CustomerRequest,
  CustomerRequestCreatePayload,
  Deal,
  DealCreatePayload,
  DealHistoryEntry,
  DealUpdatePayload,
  Favorite,
  IntegrationLog,
  IntegrationProviders,
  IntegrationResult,
  Invitation,
  InvitationCreatePayload,
  NotificationItem,
  Organization,
  Person,
  PersonCreatePayload,
  PropertyCreatePayload,
  PropertyDetail,
  PropertyListItem,
  PropertyUpdatePayload,
  PublicProperty,
  QueryParams,
  Role,
  RoleCreatePayload,
  RoleUpdatePayload,
  SavedSearch,
  Visit,
  VisitCreatePayload,
} from "./lib/types";

const BASE = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? "/api/v1";

export type Envelope<T> = {
  success: boolean;
  data: T | null;
  meta: unknown;
  error: { code: string; message: string; details: unknown[] } | null;
};

export class ApiError extends Error {
  constructor(
    public code: string,
    message: string,
    public status: number,
    public details: unknown[] = [],
  ) {
    super(message);
  }
}

// ---- Token handling (memory + localStorage so the session survives reloads) ----
const TOKEN_KEY = "arep_token";
let accessToken: string | null = (() => {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
})();

export const setToken = (token: string | null) => {
  accessToken = token;
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* storage unavailable (private mode) — memory only */
  }
};

export const getToken = () => accessToken;

// ---- Global 401 listener (session expired / permissions_version bumped) ----
type UnauthorizedListener = (err: ApiError) => void;
const unauthorizedListeners = new Set<UnauthorizedListener>();
export function onUnauthorized(listener: UnauthorizedListener) {
  unauthorizedListeners.add(listener);
  return () => {
    unauthorizedListeners.delete(listener);
  };
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers ?? {});
  headers.set("Content-Type", "application/json");
  if (accessToken) headers.set("Authorization", `Bearer ${accessToken}`);

  let response: Response;
  try {
    response = await fetch(`${BASE}${path}`, { ...options, headers });
  } catch {
    throw new ApiError("NETWORK_ERROR", "اتصال به سرور برقرار نشد", 0);
  }

  let body: Envelope<T>;
  try {
    body = (await response.json()) as Envelope<T>;
  } catch {
    throw new ApiError(
      response.status >= 500 || response.status === 0 ? "SERVER_UNAVAILABLE" : "BAD_RESPONSE",
      response.status >= 500 ? "سرور در دسترس نیست؛ کمی بعد دوباره تلاش کنید" : "پاسخ نامعتبر از سرور",
      response.status,
    );
  }

  if (!response.ok || !body.success || body.data === null) {
    const err = new ApiError(
      body.error?.code ?? "UNKNOWN",
      body.error?.message ?? "خطای نامشخص",
      response.status,
      body.error?.details ?? [],
    );
    if (response.status === 401 && accessToken) unauthorizedListeners.forEach((l) => l(err));
    throw err;
  }
  return body.data;
}

/** Serialize a params object into a query string, skipping empty values. */
function toQuery(params: QueryParams): string {
  const qs = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== "") qs.set(k, String(v));
  });
  const q = qs.toString();
  return q ? `?${q}` : "";
}

export type Session = {
  access_token: string;
  expires_at: string;
  user: { id: number; telegram_id: number | null; display_name: string; is_super_admin: boolean };
  organization_id: number | null;
  branch_id: number | null;
  roles: string[];
  permissions: string[];
  organizations: { id: number; name: string; slug: string; is_owner: boolean }[];
};

export const api = {
  health: () => request<{ status: string; env: string }>("/health"),
  loginTelegram: (initData: string, organizationId?: number) =>
    request<Session>("/auth/telegram", {
      method: "POST",
      body: JSON.stringify({ init_data: initData, organization_id: organizationId ?? null }),
    }),
  devLogin: (telegramId: number) =>
    request<Session>("/auth/dev-login", {
      method: "POST",
      body: JSON.stringify({ telegram_id: telegramId, first_name: "Dev" }),
    }),
  selectOrganization: (organizationId: number) =>
    request<Session>("/auth/select-organization", {
      method: "POST",
      body: JSON.stringify({ organization_id: organizationId }),
    }),
  createOrganization: (name: string, slug: string, idempotencyKey: string) =>
    request<Organization>("/organizations", {
      method: "POST",
      headers: { "Idempotency-Key": idempotencyKey },
      body: JSON.stringify({ name, slug }),
    }),
  listOrganizations: () => request<Organization[]>("/organizations"),

  // Properties — Phase 5
  listProperties: (params: QueryParams = {}) => request<PropertyListItem[]>(`/properties${toQuery(params)}`),
  getProperty: (id: number) => request<PropertyDetail>(`/properties/${id}`),
  getPropertyByCode: (code: string) => request<PropertyDetail>(`/properties/by-code/${encodeURIComponent(code)}`),
  createProperty: (payload: PropertyCreatePayload, idempotencyKey: string) =>
    request<PropertyDetail>("/properties", {
      method: "POST",
      headers: { "Idempotency-Key": idempotencyKey },
      body: JSON.stringify(payload),
    }),
  updateProperty: (id: number, payload: PropertyUpdatePayload) =>
    request<PropertyDetail>(`/properties/${id}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    }),

  // CRM — Phase 6
  listPersons: (params: QueryParams = {}) => request<Person[]>(`/persons${toQuery(params)}`),
  createPerson: (payload: PersonCreatePayload) =>
    request<Person>("/persons", { method: "POST", body: JSON.stringify(payload) }),
  getPerson: (id: number) => request<Person>(`/persons/${id}`),
  updatePerson: (id: number, payload: Partial<PersonCreatePayload> & { version: number }) =>
    request<Person>(`/persons/${id}`, { method: "PATCH", body: JSON.stringify(payload) }),

  // Customer Requests
  listRequests: (params: QueryParams = {}) => request<CustomerRequest[]>(`/customer-requests${toQuery(params)}`),
  createRequest: (payload: CustomerRequestCreatePayload) =>
    request<CustomerRequest>("/customer-requests", { method: "POST", body: JSON.stringify(payload) }),

  // Favorites
  listFavorites: () => request<Favorite[]>("/favorites"),
  addFavorite: (propertyId: number) =>
    request<Favorite>("/favorites", { method: "POST", body: JSON.stringify({ property_id: propertyId }) }),
  removeFavorite: (propertyId: number) => request<unknown>(`/favorites/${propertyId}`, { method: "DELETE" }),

  // Saved Searches
  listSavedSearches: () => request<SavedSearch[]>("/saved-searches"),
  createSavedSearch: (payload: { name: string; query: Record<string, unknown>; is_active?: boolean }) =>
    request<SavedSearch>("/saved-searches", { method: "POST", body: JSON.stringify(payload) }),
  getSavedSearchMatches: (id: number) => request<PropertyListItem[]>(`/saved-searches/${id}/matches`),

  // Visits & Notifications — Phase 7-8
  listVisits: (params: QueryParams = {}) => request<Visit[]>(`/visits${toQuery(params)}`),
  createVisit: (payload: VisitCreatePayload) =>
    request<Visit>("/visits", { method: "POST", body: JSON.stringify(payload) }),
  updateVisit: (id: number, payload: Partial<VisitCreatePayload> & { version: number }) =>
    request<Visit>(`/visits/${id}`, { method: "PATCH", body: JSON.stringify(payload) }),

  listNotifications: (params: QueryParams = {}) => request<NotificationItem[]>(`/notifications${toQuery(params)}`),
  getUnreadCount: () => request<{ unread_count: number }>("/notifications/unread-count"),
  markNotificationRead: (id: number) => request<unknown>(`/notifications/${id}/read`, { method: "POST" }),
  markAllNotificationsRead: () => request<unknown>("/notifications/read-all", { method: "POST" }),

  // Deals — Phase 9
  listDeals: (params: QueryParams = {}) => request<Deal[]>(`/deals${toQuery(params)}`),
  getDeal: (id: number) => request<Deal>(`/deals/${id}`),
  getDealByCode: (code: string) => request<Deal>(`/deals/by-code/${encodeURIComponent(code)}`),
  createDeal: (payload: DealCreatePayload) =>
    request<Deal>("/deals", { method: "POST", body: JSON.stringify(payload) }),
  updateDeal: (id: number, payload: DealUpdatePayload) =>
    request<Deal>(`/deals/${id}`, { method: "PATCH", body: JSON.stringify(payload) }),
  getDealHistory: (id: number) => request<DealHistoryEntry[]>(`/deals/${id}/history`),

  // Public — Phase 10-12 (no auth)
  publicListProperties: (params: QueryParams = {}) =>
    request<PublicProperty[]>(`/public/properties${toQuery(params)}`),
  publicGetByCode: (code: string) => request<PublicProperty>(`/public/properties/by-code/${encodeURIComponent(code)}`),
  publicGetById: (id: number) => request<PublicProperty>(`/public/properties/${id}`),

  // Multi-Tenant Phase 13 — Invitations
  listInvitations: (orgId: number) => request<Invitation[]>(`/organizations/${orgId}/invitations`),
  createInvitation: (orgId: number, payload: InvitationCreatePayload) =>
    request<Invitation>(`/organizations/${orgId}/invitations`, { method: "POST", body: JSON.stringify(payload) }),
  revokeInvitation: (orgId: number, invId: number) =>
    request<unknown>(`/organizations/${orgId}/invitations/${invId}`, { method: "DELETE" }),
  acceptInvitation: (token: string) =>
    request<unknown>(`/invitations/accept`, { method: "POST", body: JSON.stringify({ token }) }),

  // Multi-Tenant Phase 13 — Custom Roles
  listRoles: (orgId: number) => request<Role[]>(`/organizations/${orgId}/roles`),
  createRole: (orgId: number, payload: RoleCreatePayload) =>
    request<Role>(`/organizations/${orgId}/roles`, { method: "POST", body: JSON.stringify(payload) }),
  getRole: (orgId: number, roleId: number) => request<Role>(`/organizations/${orgId}/roles/${roleId}`),
  updateRole: (orgId: number, roleId: number, payload: RoleUpdatePayload) =>
    request<Role>(`/organizations/${orgId}/roles/${roleId}`, { method: "PATCH", body: JSON.stringify(payload) }),
  deleteRole: (orgId: number, roleId: number) =>
    request<unknown>(`/organizations/${orgId}/roles/${roleId}`, { method: "DELETE" }),

  // Multi-Tenant Phase 13 — Admin
  adminListOrgs: (params: QueryParams = {}) => request<Organization[]>(`/admin/organizations${toQuery(params)}`),
  adminGetOrgStats: (orgId: number) => request<AdminOrgStats>(`/admin/organizations/${orgId}/stats`),
  adminGlobalStats: () => request<AdminGlobalStats>(`/admin/stats`),
  adminListUsers: (params: QueryParams = {}) => request<AdminUser[]>(`/admin/users${toQuery(params)}`),
  adminToggleSuperAdmin: (userId: number, is_super_admin: boolean) =>
    request<AdminUser>(`/admin/users/${userId}/super-admin`, {
      method: "PATCH",
      body: JSON.stringify({ is_super_admin }),
    }),

  // AI Phase 14
  aiListProviders: () => request<AIProviders>(`/ai/providers`),
  aiParseSearch: (text: string, use_provider?: string) =>
    request<AIParsed>(`/ai/search/parse`, {
      method: "POST",
      body: JSON.stringify({ text, use_provider: use_provider || null }),
    }),
  aiSearchExecute: (text: string, use_provider?: string) =>
    request<AISearchResult>(`/ai/search/execute`, {
      method: "POST",
      body: JSON.stringify({ text, use_provider: use_provider || null }),
    }),
  aiMatchRequest: (requestId: number, limit: number = 10) =>
    request<AIMatch[]>(`/ai/match/request/${requestId}`, {
      method: "POST",
      body: JSON.stringify({ limit }),
    }),
  aiMatchProperty: (propertyId: number, limit: number = 10) =>
    request<AIMatch[]>(`/ai/match/property/${propertyId}`, {
      method: "POST",
      body: JSON.stringify({ limit }),
    }),
  aiSuggestDescription: (propertyId: number) =>
    request<AIDescription>(`/ai/suggest/description/${propertyId}`, { method: "POST" }),

  // Integrations Phase 15
  intListProviders: () => request<IntegrationProviders>(`/integrations/providers`),
  intTelegramSend: (chat_id: string, text: string) =>
    request<IntegrationResult>(`/integrations/telegram/send`, { method: "POST", body: JSON.stringify({ chat_id, text }) }),
  intTelegramSendProperty: (propertyId: number, chat_id: string) =>
    request<IntegrationResult>(`/integrations/telegram/send-property/${propertyId}`, {
      method: "POST",
      body: JSON.stringify({ chat_id }),
    }),
  intTelegramDeepLink: (payload: string) =>
    request<IntegrationResult>(`/integrations/telegram/deep-link?payload=${encodeURIComponent(payload)}`),
  intSmsSend: (phone: string, message: string) =>
    request<IntegrationResult>(`/integrations/sms/send`, { method: "POST", body: JSON.stringify({ phone, message }) }),
  intSmsOtp: (phone: string, code?: string) =>
    request<IntegrationResult>(`/integrations/sms/otp`, {
      method: "POST",
      body: JSON.stringify({ phone, code: code || null }),
    }),
  intPublishListing: (platform: string, propertyId: number) =>
    request<IntegrationResult>(`/integrations/listings/publish`, {
      method: "POST",
      body: JSON.stringify({ platform, property_id: propertyId }),
    }),
  intUnpublishListing: (platform: string, external_id: string) =>
    request<IntegrationResult>(`/integrations/listings/unpublish`, {
      method: "POST",
      body: JSON.stringify({ platform, external_id }),
    }),
  intCreatePayment: (amount: number, description: string, callback_url?: string) =>
    request<IntegrationResult>(`/integrations/payment/create`, {
      method: "POST",
      body: JSON.stringify({ amount, description, callback_url: callback_url || null }),
    }),
  intVerifyPayment: (paymentId: string) => request<IntegrationResult>(`/integrations/payment/verify/${paymentId}`),
  intGeocode: (address: string) =>
    request<IntegrationResult>(`/integrations/maps/geocode`, { method: "POST", body: JSON.stringify({ address }) }),
  intReverseGeocode: (lat: number, lng: number) =>
    request<IntegrationResult>(`/integrations/maps/reverse-geocode`, { method: "POST", body: JSON.stringify({ lat, lng }) }),
  intStaticMap: (lat: number, lng: number, zoom: number = 15) =>
    request<IntegrationResult>(`/integrations/maps/static-map?lat=${lat}&lng=${lng}&zoom=${zoom}`),
  intDistance: (lat1: number, lng1: number, lat2: number, lng2: number) =>
    request<IntegrationResult>(`/integrations/maps/distance`, {
      method: "POST",
      body: JSON.stringify({ lat1, lng1, lat2, lng2 }),
    }),
  intListLogs: (params: QueryParams = {}) => request<IntegrationLog[]>(`/integrations/logs${toQuery(params)}`),
};

// Offline outbox — Phase 10
export type OutboxItem = { id: string; type: string; payload: PropertyCreatePayload; created_at: string };
const OUTBOX_KEY = "arep_outbox";
const OUTBOX_EVENT = "arep:outbox";

function emitOutbox() {
  window.dispatchEvent(new CustomEvent(OUTBOX_EVENT));
}

export function onOutboxChange(listener: () => void) {
  const storage = (e: StorageEvent) => {
    if (e.key === OUTBOX_KEY) listener();
  };
  window.addEventListener(OUTBOX_EVENT, listener);
  window.addEventListener("storage", storage);
  return () => {
    window.removeEventListener(OUTBOX_EVENT, listener);
    window.removeEventListener("storage", storage);
  };
}

export function getOutbox(): OutboxItem[] {
  try {
    return JSON.parse(localStorage.getItem(OUTBOX_KEY) || "[]") as OutboxItem[];
  } catch {
    return [];
  }
}

export function addToOutbox(type: string, payload: PropertyCreatePayload) {
  const items = getOutbox();
  items.push({ id: `${Date.now()}-${Math.random()}`, type, payload, created_at: new Date().toISOString() });
  localStorage.setItem(OUTBOX_KEY, JSON.stringify(items));
  emitOutbox();
  return items;
}

export function removeFromOutbox(id: string) {
  const items = getOutbox().filter((i) => i.id !== id);
  localStorage.setItem(OUTBOX_KEY, JSON.stringify(items));
  emitOutbox();
  return items;
}

export function clearOutbox() {
  localStorage.removeItem(OUTBOX_KEY);
  emitOutbox();
}
