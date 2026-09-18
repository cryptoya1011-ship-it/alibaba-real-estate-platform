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
};
