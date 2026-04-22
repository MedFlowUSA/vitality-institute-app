import type { MarketStatus } from "../../lib/locationMarkets";

export type ClinicStatus = "draft" | "active" | "inactive" | "archived";

export type ClinicRow = {
  id: string;
  name: string;
  slug: string;
  status: ClinicStatus;
  brand_name: string | null;
  support_email: string | null;
  support_phone: string | null;
  default_timezone: string | null;
  is_placeholder: boolean;
  market_status: MarketStatus;
  display_priority: number;
  created_at: string;
  updated_at: string;
};

export type ClinicMembershipRow = {
  id: string;
  clinic_id: string;
  user_id: string;
  role: string;
  is_active: boolean;
  invited_by: string | null;
  created_at: string;
};

export type ClinicLocationLinkRow = {
  id: string;
  clinic_id: string;
  location_id: string;
  is_primary: boolean;
  created_at: string;
};

export type ClinicLocationSummary = ClinicLocationLinkRow & {
  location_name: string;
  city: string | null;
  state: string | null;
  is_placeholder: boolean;
  market_status: MarketStatus;
  display_priority: number;
};

export type ClinicSettingsRow = {
  id: string;
  clinic_id: string;
  intake_enabled: boolean;
  labs_enabled: boolean;
  ai_protocol_enabled: boolean;
  fulfillment_enabled: boolean;
  telehealth_enabled: boolean;
  default_programs_json: string[];
  created_at: string;
  updated_at: string;
};

export type ClinicServiceToggleRow = {
  id?: string;
  clinic_id: string;
  service_key: string;
  is_enabled: boolean;
  pricing_json: Record<string, unknown>;
};

export type ClinicServiceCatalogRow = {
  service_key: string;
  label: string;
  category: string | null;
  service_group: string | null;
  location_count: number;
  is_enabled: boolean;
  pricing_json: Record<string, unknown>;
};

export type ClinicMemberSummary = ClinicMembershipRow & {
  first_name: string | null;
  last_name: string | null;
  email?: string | null;
  active_location_id: string | null;
};

export type ClinicProviderProfileRow = {
  id: string;
  clinic_id: string;
  user_id: string;
  specialty: string | null;
  credentials: string | null;
  npi: string | null;
  license_number: string | null;
  contact_phone: string | null;
  contact_email: string | null;
  bio: string | null;
  accepting_new_patients: boolean;
  created_at: string;
  updated_at: string;
};

export type ClinicWorkspaceState = {
  available: boolean;
  clinics: ClinicRow[];
  memberships: ClinicMembershipRow[];
  locations: ClinicLocationSummary[];
  activeClinicId: string | null;
  activeClinicRole: string | null;
};
