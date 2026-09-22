/** API client. Every response uses the {success, data, meta, error} envelope. */
const BASE = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? "/api/v1";

export type Envelope<T> = {
  success: boolean;
  data: T | null;
  meta: unknown;
  error: { code: string; message: string; details: unknown[] } | null;
};

export class ApiError extends Error {
  constructor(public code: string, message: string, public status: number) {
    super(message);
  }
}

let accessToken: string | null = null;
export const setToken = (token: string | null) => {
  accessToken = token;
};

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers ?? {});
  headers.set("Content-Type", "application/json");
  if (accessToken) headers.set("Authorization", `Bearer ${accessToken}`);

  const response = await fetch(`${BASE}${path}`, { ...options, headers });
  const body = (await response.json()) as Envelope<T>;
  if (!response.ok || !body.success || body.data === null) {
    throw new ApiError(
      body.error?.code ?? "UNKNOWN",
      body.error?.message ?? "خطای نامشخص",
      response.status,
    );
  }
  return body.data;
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
    request<{ id: number; name: string; slug: string }>("/organizations", {
      method: "POST",
      headers: { "Idempotency-Key": idempotencyKey },
      body: JSON.stringify({ name, slug }),
    }),

  // Properties — Phase 5
  listProperties: (params: Record<string, string | number | boolean | undefined> = {}) => {
    const qs = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== "") qs.set(k, String(v));
    });
    const q = qs.toString();
    return request<any[]>(`/properties${q ? `?${q}` : ""}`);
  },
  getProperty: (id: number) => request<any>(`/properties/${id}`),
  getPropertyByCode: (code: string) => request<any>(`/properties/by-code/${code}`),
  createProperty: (payload: any, idempotencyKey: string) =>
    request<any>("/properties", {
      method: "POST",
      headers: { "Idempotency-Key": idempotencyKey },
      body: JSON.stringify(payload),
    }),
  updateProperty: (id: number, payload: any) =>
    request<any>(`/properties/${id}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    }),

  // CRM — Phase 6
  listPersons: (params: Record<string, string | number | undefined> = {}) => {
    const qs = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== "") qs.set(k, String(v));
    });
    const q = qs.toString();
    return request<any[]>(`/persons${q ? `?${q}` : ""}`);
  },
  createPerson: (payload: any) =>
    request<any>("/persons", { method: "POST", body: JSON.stringify(payload) }),
  getPerson: (id: number) => request<any>(`/persons/${id}`),
  updatePerson: (id: number, payload: any) =>
    request<any>(`/persons/${id}`, { method: "PATCH", body: JSON.stringify(payload) }),

  // Customer Requests
  listRequests: (params: Record<string, string | number | undefined> = {}) => {
    const qs = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== "") qs.set(k, String(v));
    });
    const q = qs.toString();
    return request<any[]>(`/customer-requests${q ? `?${q}` : ""}`);
  },
  createRequest: (payload: any) =>
    request<any>("/customer-requests", { method: "POST", body: JSON.stringify(payload) }),

  // Favorites
  listFavorites: () => request<any[]>("/favorites"),
  addFavorite: (propertyId: number) =>
    request<any>("/favorites", { method: "POST", body: JSON.stringify({ property_id: propertyId }) }),
  removeFavorite: (propertyId: number) =>
    request<any>(`/favorites/${propertyId}`, { method: "DELETE" }),

  // Saved Searches
  listSavedSearches: () => request<any[]>("/saved-searches"),
  createSavedSearch: (payload: any) =>
    request<any>("/saved-searches", { method: "POST", body: JSON.stringify(payload) }),
  getSavedSearchMatches: (id: number) => request<any[]>(`/saved-searches/${id}/matches`),

  // Visits & Notifications — Phase 7-8
  listVisits: (params: Record<string, string | number | undefined> = {}) => {
    const qs = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== "") qs.set(k, String(v));
    });
    const q = qs.toString();
    return request<any[]>(`/visits${q ? `?${q}` : ""}`);
  },
  createVisit: (payload: any) =>
    request<any>("/visits", { method: "POST", body: JSON.stringify(payload) }),
  updateVisit: (id: number, payload: any) =>
    request<any>(`/visits/${id}`, { method: "PATCH", body: JSON.stringify(payload) }),

  listNotifications: (params: Record<string, string | boolean | undefined> = {}) => {
    const qs = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== "") qs.set(k, String(v));
    });
    const q = qs.toString();
    return request<any[]>(`/notifications${q ? `?${q}` : ""}`);
  },
  getUnreadCount: () => request<{ unread_count: number }>("/notifications/unread-count"),
  markNotificationRead: (id: number) =>
    request<any>(`/notifications/${id}/read`, { method: "POST" }),
  markAllNotificationsRead: () =>
    request<any>("/notifications/read-all", { method: "POST" }),

  // Deals — Phase 9
  listDeals: (params: Record<string, string | number | undefined> = {}) => {
    const qs = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== "") qs.set(k, String(v));
    });
    const q = qs.toString();
    return request<any[]>(`/deals${q ? `?${q}` : ""}`);
  },
  getDeal: (id: number) => request<any>(`/deals/${id}`),
  getDealByCode: (code: string) => request<any>(`/deals/by-code/${code}`),
  createDeal: (payload: any) =>
    request<any>("/deals", { method: "POST", body: JSON.stringify(payload) }),
  updateDeal: (id: number, payload: any) =>
    request<any>(`/deals/${id}`, { method: "PATCH", body: JSON.stringify(payload) }),
  getDealHistory: (id: number) => request<any[]>(`/deals/${id}/history`),

  // Public — Phase 10-12 (no auth)
  publicListProperties: (params: Record<string, string | number | boolean | undefined> = {}) => {
    const qs = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== "") qs.set(k, String(v));
    });
    const q = qs.toString();
    return request<any[]>(`/public/properties${q ? `?${q}` : ""}`);
  },
  publicGetByCode: (code: string) => request<any>(`/public/properties/by-code/${code}`),
  publicGetById: (id: number) => request<any>(`/public/properties/${id}`),

  // Multi-Tenant Phase 13 — Invitations
  listInvitations: (orgId: number) => request<any[]>(`/organizations/${orgId}/invitations`),
  createInvitation: (orgId: number, payload: any) =>
    request<any>(`/organizations/${orgId}/invitations`, { method: "POST", body: JSON.stringify(payload) }),
  revokeInvitation: (orgId: number, invId: number) =>
    request<any>(`/organizations/${orgId}/invitations/${invId}`, { method: "DELETE" }),
  acceptInvitation: (token: string) =>
    request<any>(`/invitations/accept`, { method: "POST", body: JSON.stringify({ token }) }),

  // Multi-Tenant Phase 13 — Custom Roles
  listRoles: (orgId: number) => request<any[]>(`/organizations/${orgId}/roles`),
  createRole: (orgId: number, payload: any) =>
    request<any>(`/organizations/${orgId}/roles`, { method: "POST", body: JSON.stringify(payload) }),
  getRole: (orgId: number, roleId: number) => request<any>(`/organizations/${orgId}/roles/${roleId}`),
  updateRole: (orgId: number, roleId: number, payload: any) =>
    request<any>(`/organizations/${orgId}/roles/${roleId}`, { method: "PATCH", body: JSON.stringify(payload) }),
  deleteRole: (orgId: number, roleId: number) =>
    request<any>(`/organizations/${orgId}/roles/${roleId}`, { method: "DELETE" }),

  // Multi-Tenant Phase 13 — Admin
  adminListOrgs: (params: Record<string, string | number | undefined> = {}) => {
    const qs = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== "") qs.set(k, String(v));
    });
    const q = qs.toString();
    return request<any[]>(`/admin/organizations${q ? `?${q}` : ""}`);
  },
  adminGetOrgStats: (orgId: number) => request<any>(`/admin/organizations/${orgId}/stats`),
  adminGlobalStats: () => request<any>(`/admin/stats`),
  adminListUsers: (params: Record<string, string | number | undefined> = {}) => {
    const qs = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== "") qs.set(k, String(v));
    });
    const q = qs.toString();
    return request<any[]>(`/admin/users${q ? `?${q}` : ""}`);
  },
  adminToggleSuperAdmin: (userId: number, is_super_admin: boolean) =>
    request<any>(`/admin/users/${userId}/super-admin`, {
      method: "PATCH",
      body: JSON.stringify({ is_super_admin }),
    }),

  // AI Phase 14
  aiListProviders: () => request<any>(`/ai/providers`),
  aiParseSearch: (text: string, use_provider?: string) =>
    request<any>(`/ai/search/parse`, {
      method: "POST",
      body: JSON.stringify({ text, use_provider: use_provider || null }),
    }),
  aiSearchExecute: (text: string, use_provider?: string) =>
    request<any>(`/ai/search/execute`, {
      method: "POST",
      body: JSON.stringify({ text, use_provider: use_provider || null }),
    }),
  aiMatchRequest: (requestId: number, limit: number = 10) =>
    request<any>(`/ai/match/request/${requestId}`, {
      method: "POST",
      body: JSON.stringify({ limit }),
    }),
  aiMatchProperty: (propertyId: number, limit: number = 10) =>
    request<any>(`/ai/match/property/${propertyId}`, {
      method: "POST",
      body: JSON.stringify({ limit }),
    }),
  aiSuggestDescription: (propertyId: number) =>
    request<any>(`/ai/suggest/description/${propertyId}`, { method: "POST" }),

  // Integrations Phase 15
  intListProviders: () => request<any>(`/integrations/providers`),
  intTelegramSend: (chat_id: string, text: string) =>
    request<any>(`/integrations/telegram/send`, { method: "POST", body: JSON.stringify({ chat_id, text }) }),
  intTelegramSendProperty: (propertyId: number, chat_id: string) =>
    request<any>(`/integrations/telegram/send-property/${propertyId}`, { method: "POST", body: JSON.stringify({ chat_id }) }),
  intTelegramDeepLink: (payload: string) =>
    request<any>(`/integrations/telegram/deep-link?payload=${encodeURIComponent(payload)}`),
  intSmsSend: (phone: string, message: string) =>
    request<any>(`/integrations/sms/send`, { method: "POST", body: JSON.stringify({ phone, message }) }),
  intSmsOtp: (phone: string, code?: string) =>
    request<any>(`/integrations/sms/otp`, { method: "POST", body: JSON.stringify({ phone, code: code || null }) }),
  intPublishListing: (platform: string, propertyId: number) =>
    request<any>(`/integrations/listings/publish`, { method: "POST", body: JSON.stringify({ platform, property_id: propertyId }) }),
  intUnpublishListing: (platform: string, external_id: string) =>
    request<any>(`/integrations/listings/unpublish`, { method: "POST", body: JSON.stringify({ platform, external_id }) }),
  intCreatePayment: (amount: number, description: string, callback_url?: string) =>
    request<any>(`/integrations/payment/create`, { method: "POST", body: JSON.stringify({ amount, description, callback_url: callback_url || null }) }),
  intVerifyPayment: (paymentId: string) =>
    request<any>(`/integrations/payment/verify/${paymentId}`),
  intGeocode: (address: string) =>
    request<any>(`/integrations/maps/geocode`, { method: "POST", body: JSON.stringify({ address }) }),
  intReverseGeocode: (lat: number, lng: number) =>
    request<any>(`/integrations/maps/reverse-geocode`, { method: "POST", body: JSON.stringify({ lat, lng }) }),
  intStaticMap: (lat: number, lng: number, zoom: number = 15) =>
    request<any>(`/integrations/maps/static-map?lat=${lat}&lng=${lng}&zoom=${zoom}`),
  intDistance: (lat1: number, lng1: number, lat2: number, lng2: number) =>
    request<any>(`/integrations/maps/distance`, { method: "POST", body: JSON.stringify({ lat1, lng1, lat2, lng2 }) }),
  intListLogs: (params: Record<string, string | number | undefined> = {}) => {
    const qs = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => { if (v !== undefined && v !== null && v !== "") qs.set(k, String(v)); });
    const q = qs.toString();
    return request<any[]>(`/integrations/logs${q ? `?${q}` : ""}`);
  },
};

// Offline outbox — Phase 10
type OutboxItem = { id: string; type: string; payload: any; created_at: string };
const OUTBOX_KEY = "arep_outbox";

export function getOutbox(): OutboxItem[] {
  try {
    return JSON.parse(localStorage.getItem(OUTBOX_KEY) || "[]");
  } catch {
    return [];
  }
}

export function addToOutbox(type: string, payload: any) {
  const items = getOutbox();
  items.push({ id: `${Date.now()}-${Math.random()}`, type, payload, created_at: new Date().toISOString() });
  localStorage.setItem(OUTBOX_KEY, JSON.stringify(items));
  return items;
}

export function removeFromOutbox(id: string) {
  const items = getOutbox().filter((i) => i.id !== id);
  localStorage.setItem(OUTBOX_KEY, JSON.stringify(items));
  return items;
}

export function clearOutbox() {
  localStorage.removeItem(OUTBOX_KEY);
}
