/**
 * Typed payloads for the AREP API (see API_CONTRACT.md + backend schemas).
 * Only fields the frontend actually consumes are required; the rest are optional.
 */

export type ID = number;
export type ISODate = string;

export type QueryParams = Record<string, string | number | boolean | undefined | null>;

// ---------- Organizations ----------
export type OrganizationSummary = { id: ID; name: string; slug: string; is_owner: boolean };
export type Organization = {
  id: ID;
  name: string;
  slug: string;
  city_code?: string | null;
  phone?: string | null;
  is_active?: boolean;
  version?: number;
  created_at?: ISODate;
  updated_at?: ISODate;
};

// ---------- Properties ----------
export type PropertyType =
  | "residential" | "apartment" | "villa" | "garden" | "commercial"
  | "office" | "administrative" | "land" | "industrial" | "mixed_use";
export type TransactionType = "sale" | "rent" | "exchange" | "partnership";
export type PropertyStatus =
  | "draft" | "pending_review" | "changes_requested" | "rejected" | "approved" | "published"
  | "reserved" | "sold" | "rented" | "archived";

export type PropertyListItem = {
  id: ID;
  code: string;
  title: string;
  property_type: string;
  transaction_type: string;
  status: string;
  price: number | null;
  rent_price?: number | null;
  land_area?: number | null;
  built_area: number | null;
  rooms?: number | null;
  has_parking?: boolean;
  has_elevator?: boolean;
  city: string | null;
  district: string | null;
  city_code?: string | null;
  district_code?: string | null;
  primary_image?: string | null;
  deposit?: number | null;
  created_at?: ISODate;
};

export type PropertyMedia = {
  id: ID;
  file_path: string;
  file_name: string;
  file_type: string;
  mime_type: string | null;
  is_primary: boolean;
  sort_order: number;
};

export type RegistrantType = "owner" | "intermediary" | "agent" | "office_staff";

export type PropertyLocation = {
  city: string | null;
  city_code: string | null;
  district: string | null;
  district_code: string | null;
  neighborhood?: string | null;
  public_lat?: number | null;
  public_lng?: number | null;
  exact_address?: string | null;
  postal_code?: string | null;
};

export type PropertyDetail = PropertyListItem & {
  description: string | null;
  version: number;
  bedrooms?: number | null;
  bathrooms?: number | null;
  floor_number?: number | null;
  total_floors?: number | null;
  year_built?: number | null;
  deposit?: number | null;
  has_warehouse?: boolean;
  has_balcony?: boolean;
  owner_name?: string | null;
  owner_phone?: string | null;
  location?: PropertyLocation | null;
  usages?: { usage_type: string; is_primary: boolean }[];
  updated_at?: ISODate;
  registrant_type?: RegistrantType | string;
  useful_area?: number | null;
  floor_area?: number | null;
  currency?: string;
  is_exchangeable?: boolean;
  exchange_description?: string | null;
  owner_share?: number | null;
  builder_share?: number | null;
  partnership_description?: string | null;
  owner_person_id?: ID | null;
  legal_info?: string | null;
  /** JSON-encoded amenities object (backend column amenities_json). */
  amenities_json?: string | null;
  media?: PropertyMedia[];
  /** Review trail (official inventory). */
  created_by?: ID | null;
  approved_by?: ID | null;
  approved_at?: ISODate | null;
  review_note?: string | null;
};

export type PropertyReviewAction = "approve" | "reject" | "request_changes";
export type PropertyReviewPayload = {
  action: PropertyReviewAction;
  note?: string | null;
  publish?: boolean;
  version?: number;
};

export type PropertyCreatePayload = {
  title: string;
  description?: string | null;
  property_type: PropertyType;
  transaction_type: TransactionType;
  status?: PropertyStatus;
  built_area?: number | null;
  price?: number | null;
  rooms?: number | null;
  has_parking?: boolean;
  has_elevator?: boolean;
  has_warehouse?: boolean;
  has_balcony?: boolean;
  owner_name?: string | null;
  owner_phone?: string | null;
  location?: Partial<PropertyLocation>;
  usages?: { usage_type: string; is_primary: boolean }[];
  registrant_type?: RegistrantType;
  land_area?: number | null;
  useful_area?: number | null;
  floor_area?: number | null;
  bedrooms?: number | null;
  bathrooms?: number | null;
  floor_number?: number | null;
  total_floors?: number | null;
  year_built?: number | null;
  rent_price?: number | null;
  deposit?: number | null;
  is_exchangeable?: boolean;
  exchange_description?: string | null;
  owner_share?: number | null;
  builder_share?: number | null;
  partnership_description?: string | null;
  owner_person_id?: ID | null;
  amenities?: Record<string, boolean> | null;
  legal_info?: string | null;
};

export type PropertyUpdatePayload = Partial<PropertyCreatePayload> & { version: number };

export type PublicProperty = PropertyListItem & {
  description: string | null;
  deposit?: number | null;
  useful_area?: number | null;
  bedrooms?: number | null;
  bathrooms?: number | null;
  floor_number?: number | null;
  total_floors?: number | null;
  has_warehouse?: boolean;
  has_balcony?: boolean;
  neighborhood?: string | null;
  public_lat?: number | null;
  public_lng?: number | null;
  usages?: { usage_type: string; is_primary: boolean }[];
  images: string[];
  year_built?: number | null;
  is_exchangeable?: boolean;
  amenities?: string[];
  updated_at?: ISODate;
};

// ---------- CRM ----------
export type PersonRole =
  | "owner" | "buyer" | "tenant" | "seller" | "investor" | "landlord" | "developer" | "intermediary";

export type Person = {
  id: ID;
  first_name: string;
  last_name: string | null;
  phone: string | null;
  email?: string | null;
  national_id?: string | null;
  notes?: string | null;
  display_name: string;
  roles: { role: string }[];
  version?: number;
  created_at?: ISODate;
};

export type PersonCreatePayload = {
  first_name: string;
  last_name?: string | null;
  phone?: string | null;
  email?: string | null;
  national_id?: string | null;
  notes?: string | null;
  roles?: PersonRole[];
};

export type CustomerRequest = {
  id: ID;
  person_id: ID;
  transaction_type: string | null;
  property_type: string | null;
  city_code: string | null;
  district_code?: string | null;
  budget_min: number | null;
  budget_max: number | null;
  area_min?: number | null;
  area_max?: number | null;
  rooms?: number | null;
  special_requirements?: string | null;
  status: string;
  version?: number;
  created_at?: ISODate;
};

export type CustomerRequestCreatePayload = {
  person_id: ID;
  transaction_type?: string | null;
  property_type?: string | null;
  city_code?: string | null;
  district_code?: string | null;
  city?: string | null;
  district?: string | null;
  budget_min?: number | null;
  budget_max?: number | null;
  area_min?: number | null;
  area_max?: number | null;
  rooms?: number | null;
  special_requirements?: string | null;
};

export type Favorite = { id: ID; property_id: ID; user_id?: ID; created_at?: ISODate };

export type SavedSearch = { id: ID; name: string; query_json?: string; is_active?: boolean; version?: number };
export type SavedSearchMatch = {
  id: ID;
  code: string;
  title: string;
  property_type: string;
  price: number | null;
  city_code: string | null;
};

// ---------- Visits ----------
export type Visit = {
  id: ID;
  property_id: ID;
  customer_id: ID;
  agent_id?: ID | null;
  visit_date: string;
  visit_time: string | null;
  status: string;
  notes?: string | null;
  version?: number;
  created_at?: ISODate;
};

export type VisitUpdatePayload = Partial<VisitCreatePayload> & {
  follow_up_notes?: string | null;
  result?: string | null;
  version: number;
};

export type VisitCreatePayload = {
  property_id: ID;
  customer_id: ID;
  visit_date: string;
  visit_time?: string | null;
  status?: string;
  notes?: string | null;
};

// ---------- Deals ----------
export type DealStatus =
  | "lead" | "qualification" | "property_match" | "visit" | "negotiation"
  | "agreement" | "closed_won" | "closed_lost" | "archived";

export type Deal = {
  id: ID;
  code: string;
  title: string;
  status: DealStatus | string;
  customer_id: ID;
  property_id?: ID | null;
  agent_id?: ID | null;
  amount: number | null;
  commission_total: number | null;
  version?: number;
  created_at?: ISODate;
};

export type DealCreatePayload = {
  title: string;
  customer_id: ID;
  property_id?: ID | null;
  amount?: number | null;
  commission_total?: number | null;
  commission_agent_share?: number | null;
  commission_office_share?: number | null;
  status?: DealStatus;
  notes?: string | null;
};

export type DealUpdatePayload = {
  status?: DealStatus;
  title?: string;
  amount?: number | null;
  notes?: string | null;
  loss_reason?: string | null;
  version: number;
};

export type DealHistoryEntry = {
  id: ID;
  deal_id?: ID;
  from_status: string | null;
  to_status: string;
  changed_by: ID | null;
  notes: string | null;
  created_at: ISODate;
};

// ---------- Notifications ----------
export type NotificationItem = {
  id: ID;
  title: string;
  body: string | null;
  priority: "normal" | "important" | "critical" | string;
  channel?: string;
  is_read: boolean;
  entity_type?: string | null;
  entity_id?: ID | null;
  created_at: ISODate;
};

// ---------- Team / Roles ----------
export type Invitation = {
  id: ID;
  organization_id: ID;
  invited_telegram_id: number | null;
  invited_phone: string | null;
  role_code: string;
  status: "pending" | "accepted" | "revoked" | "expired" | string;
  created_at: ISODate;
  /** One-time token lifetime; null for legacy invitations. */
  expires_at?: ISODate | null;
  token?: string;
};

export type InvitationCreatePayload = {
  invited_telegram_id?: number;
  invited_phone?: string;
  role_code: string;
  /** 1–30, default 7 on the server. */
  expires_in_days?: number;
};

export type Role = {
  id: ID;
  organization_id: ID | null;
  code: string;
  title: string;
  is_system: boolean;
  permissions: string[];
  version?: number;
};

export type RoleCreatePayload = { code: string; title: string; permission_codes: string[] };
export type RoleUpdatePayload = { title?: string; permission_codes?: string[]; version?: number };

// ---------- Admin ----------
export type AdminGlobalStats = {
  organizations: number;
  users: number;
  branches: number;
  properties: number;
  persons: number;
  visits: number;
  deals: number;
};

export type AdminOrgStats = {
  organization_id: ID;
  name?: string;
  slug?: string;
  members_count: number;
  branches_count: number;
  properties_count: number;
  persons_count: number;
  visits_count: number;
  deals_count: number;
};

export type AdminUser = {
  id: ID;
  telegram_id: number | null;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  is_active?: boolean;
  is_super_admin: boolean;
  created_at?: ISODate;
};

// ---------- AI ----------
export type AIProviderDetail = {
  type: string;
  requires_api_key: boolean;
  /** false = the connection is not written yet (never faked). */
  implemented?: boolean;
  has_key?: boolean;
  persian?: boolean;
  description?: string;
  env?: string;
};
export type AIProviders = {
  /** Engine actually in use. */
  current: string;
  /** Engine chosen in settings (may not be implemented yet). */
  requested?: string;
  note?: string | null;
  available: string[];
  details: Record<string, AIProviderDetail>;
};

export type AIParsed = {
  q?: string;
  property_type: string | null;
  transaction_type: string | null;
  city_code: string | null;
  district_code: string | null;
  city: string | null;
  district: string | null;
  min_area: number | null;
  max_area: number | null;
  min_price: number | null;
  max_price: number | null;
  rooms: number | null;
  bedrooms: number | null;
  has_parking: boolean | null;
  has_elevator: boolean | null;
  has_warehouse: boolean | null;
  has_balcony: boolean | null;
  parsed_by: string;
  confidence: number;
  filters: Record<string, string | number | boolean>;
};

export type AISearchResult = { parsed: AIParsed; properties: PropertyListItem[] };

export type AIMatch = {
  property?: { id: ID; code: string; title: string; property_type: string; transaction_type: string; price: number | null; built_area: number | null };
  request?: { id: ID; person_id: ID; property_type: string | null; transaction_type: string | null; city_code: string | null; district_code: string | null; budget_min: number | null; budget_max: number | null };
  score: number;
  reasons: string[];
  matched: boolean;
  provider: string;
};

export type AIDescription = {
  property_id: ID;
  code: string;
  title: string;
  suggested_description: string;
  provider: string;
};

// ---------- Integrations ----------
export type IntegrationProviders = {
  current: Record<string, string | string[]>;
  available: Record<string, string[]>;
  details: Record<string, IntegrationProviderStatus>;
};

/** live = real connection · test = built-in test mode, nothing leaves the system · unavailable = chosen but not usable. */
export type IntegrationMode = "live" | "test" | "unavailable";
export type IntegrationProviderStatus = {
  has_key: boolean;
  provider: string;
  note?: string;
  mode?: IntegrationMode;
  connected?: boolean;
  implemented?: boolean;
  reason?: string | null;
};

export type TelegramValidation = {
  success: boolean;
  mode: IntegrationMode;
  provider?: string;
  bot_username?: string | null;
  bot_id?: number | null;
  message?: string;
};

export type IntegrationResult = {
  success: boolean;
  provider?: string;
  mock?: boolean;
  message_id?: number;
  chat_id?: string;
  text?: string;
  deep_link?: string;
  payload?: string;
  to?: string;
  code?: string;
  platform?: string;
  external_id?: string;
  url?: string;
  status?: string;
  payment_id?: string;
  payment_url?: string;
  amount?: number;
  description?: string;
  address?: string;
  lat?: number;
  lng?: number;
  city?: string | null;
  confidence?: number;
  distance_km?: number;
  distance_m?: number;
  verified?: boolean;
  [key: string]: unknown;
};

export type IntegrationLog = {
  id: ID;
  provider: string;
  action: string;
  entity_type: string | null;
  entity_id: ID | null;
  status: "success" | "failed" | string;
  external_id: string | null;
  external_url: string | null;
  error_message: string | null;
  created_at: ISODate;
};

// ---------- Members / Branches / Organization settings ----------
export type MemberRole = { id: ID; code: string; title: string; is_system: boolean };
export type MemberBranch = { id: ID; name: string; code: string; is_default: boolean };
export type Member = {
  user_id: ID;
  telegram_id: number | null;
  telegram_username: string | null;
  display_name: string;
  phone: string | null;
  is_owner: boolean;
  is_active: boolean;
  joined_at: ISODate;
  roles: MemberRole[];
  branches: MemberBranch[];
};

export type Branch = {
  id: ID;
  organization_id: ID;
  name: string;
  code: string;
  address: string | null;
  is_main: boolean;
  is_active: boolean;
  version: number;
};
export type BranchCreatePayload = { name: string; code: string; address?: string | null; is_main?: boolean };
export type BranchUpdatePayload = {
  name?: string;
  address?: string | null;
  is_main?: boolean;
  is_active?: boolean;
  version: number;
};

export type OrganizationUpdatePayload = { name?: string; city_code?: string | null; phone?: string | null; version: number };

export type CustomerRequestUpdatePayload = Partial<Omit<CustomerRequestCreatePayload, "person_id">> & {
  status?: string;
  version: number;
};
