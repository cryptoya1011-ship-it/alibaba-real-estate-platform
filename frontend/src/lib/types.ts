/** Shared frontend types — mirror of backend DTOs (see API_CONTRACT.md). */

export type PropertyListItem = {
  id: number;
  code: string;
  title: string;
  property_type: string;
  transaction_type?: string;
  price: number | null;
  built_area?: number | null;
  city: string | null;
  district: string | null;
  status?: string;
  primary_image?: string | null;
};

export type PersonItem = {
  id: number;
  first_name: string;
  last_name: string | null;
  phone: string | null;
  display_name: string;
  roles: { role: string }[];
};

export type VisitItem = {
  id: number;
  property_id: number;
  customer_id: number;
  visit_date: string;
  visit_time: string | null;
  status: string;
};

export type DealItem = {
  id: number;
  code: string;
  title: string;
  status: string;
  customer_id: number;
  property_id?: number | null;
  amount: number | null;
  commission_total: number | null;
  version?: number;
};

export type PublicProperty = {
  id: number;
  code: string;
  title: string;
  description: string | null;
  property_type: string;
  transaction_type: string;
  price: number | null;
  built_area: number | null;
  city: string | null;
  district: string | null;
  primary_image: string | null;
  images: string[];
  created_at: string;
};

export type InvitationItem = {
  id: number;
  organization_id: number;
  invited_telegram_id: number | null;
  invited_phone: string | null;
  role_code: string;
  status: string;
  created_at: string;
  token?: string;
};

export type RoleItem = {
  id: number;
  organization_id: number | null;
  code: string;
  title: string;
  is_system: boolean;
  permissions: string[];
};

export type NotificationItem = {
  id: number;
  title: string;
  body: string | null;
  priority: string;
  is_read: boolean;
  created_at?: string;
};

export type MatchItem = {
  score: number;
  matched: boolean;
  provider?: string;
  property?: PropertyListItem | null;
  request?: { id: number; property_type?: string; city_code?: string; budget_max?: number | null } | null;
  reasons: string[];
};
