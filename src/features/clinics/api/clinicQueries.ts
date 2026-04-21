import { supabase } from "../../../lib/supabase";
import { isOperationalMarket, type MarketStatus } from "../../../lib/locationMarkets";
import type {
  ClinicLocationLinkRow,
  ClinicLocationSummary,
  ClinicMemberSummary,
  ClinicMembershipRow,
  ClinicRow,
  ClinicServiceCatalogRow,
  ClinicSettingsRow,
  ClinicWorkspaceState,
} from "../types";

type ProfileRow = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  role: string | null;
  active_location_id: string | null;
  active_clinic_id?: string | null;
};

type LocationRow = {
  id: string;
  name: string;
  city: string | null;
  state: string | null;
  is_placeholder: boolean;
  market_status: MarketStatus;
  display_priority: number;
};

type ServiceRow = {
  service_key: string | null;
  name: string;
  category: string | null;
  service_group: string | null;
  location_id: string | null;
};

const STAFF_ROLE_OPTIONS = ["super_admin", "location_admin", "provider", "clinical_staff", "billing", "front_desk"] as const;
const CLINIC_SELECT = "id,name,slug,status,brand_name,support_email,support_phone,default_timezone,is_placeholder,market_status,display_priority,created_at,updated_at";
const LOCATION_SELECT = "id,name,city,state,is_placeholder,market_status,display_priority";

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === "string" && error.trim()) return error;
  return fallback;
}

export function isMissingClinicFoundationError(error: unknown) {
  const message = getErrorMessage(error, "").toLowerCase();
  return (
    message.includes("active_clinic_id") ||
    message.includes("clinic_") ||
    message.includes("public.clinics") ||
    message.includes("does not exist") ||
    message.includes("schema cache")
  );
}

function slugifyClinic(input: string) {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
}

function dedupeById<T extends { id: string }>(rows: T[]) {
  const seen = new Set<string>();
  return rows.filter((row) => {
    if (seen.has(row.id)) return false;
    seen.add(row.id);
    return true;
  });
}

async function loadProfileClinicState(userId: string) {
  const { data, error } = await supabase.from("profiles").select("id,active_clinic_id").eq("id", userId).maybeSingle();
  if (error) throw error;
  return (data as ProfileRow | null) ?? null;
}

async function loadClinicLocationSummaries(clinicIds: string[], options?: { includePlaceholders?: boolean }) {
  if (clinicIds.length === 0) return [];

  const { data: linkRows, error: linkError } = await supabase
    .from("clinic_locations")
    .select("id,clinic_id,location_id,is_primary,created_at")
    .in("clinic_id", clinicIds);

  if (linkError) throw linkError;

  const links = ((linkRows as ClinicLocationLinkRow[] | null) ?? []).filter((row) => row.location_id);
  const locationIds = Array.from(new Set(links.map((row) => row.location_id)));
  if (locationIds.length === 0) return [];

  const { data: locationRows, error: locationError } = await supabase
    .from("locations")
    .select(LOCATION_SELECT)
    .in("id", locationIds);

  if (locationError) throw locationError;

  const map = new Map<string, LocationRow>();
  for (const location of (locationRows as LocationRow[] | null) ?? []) {
    map.set(location.id, location);
  }

  return links
    .map<ClinicLocationSummary | null>((row) => {
      const location = map.get(row.location_id);
      if (!location) return null;
      if (!options?.includePlaceholders && !isOperationalMarket(location)) return null;
      return {
        ...row,
        location_name: location.name ?? row.location_id,
        city: location.city ?? null,
        state: location.state ?? null,
        is_placeholder: location.is_placeholder,
        market_status: location.market_status,
        display_priority: location.display_priority,
      };
    })
    .filter((row): row is ClinicLocationSummary => row !== null);
}

async function loadClinicLocationSummariesByLocationIds(locationIds: string[], options?: { includePlaceholders?: boolean }) {
  if (locationIds.length === 0) return [];

  const { data: linkRows, error: linkError } = await supabase
    .from("clinic_locations")
    .select("id,clinic_id,location_id,is_primary,created_at")
    .in("location_id", locationIds);

  if (linkError) throw linkError;

  const links = ((linkRows as ClinicLocationLinkRow[] | null) ?? []).filter((row) => row.location_id);
  if (links.length === 0) return [];

  const uniqueLocationIds = Array.from(new Set(links.map((row) => row.location_id)));
  const { data: locationRows, error: locationError } = await supabase
    .from("locations")
    .select(LOCATION_SELECT)
    .in("id", uniqueLocationIds);

  if (locationError) throw locationError;

  const map = new Map<string, LocationRow>();
  for (const location of (locationRows as LocationRow[] | null) ?? []) {
    map.set(location.id, location);
  }

  return links
    .map<ClinicLocationSummary | null>((row) => {
      const location = map.get(row.location_id);
      if (!location) return null;
      if (!options?.includePlaceholders && !isOperationalMarket(location)) return null;
      return {
        ...row,
        location_name: location.name ?? row.location_id,
        city: location.city ?? null,
        state: location.state ?? null,
        is_placeholder: location.is_placeholder,
        market_status: location.market_status,
        display_priority: location.display_priority,
      };
    })
    .filter((row): row is ClinicLocationSummary => row !== null);
}

export async function loadClinicWorkspace(args: {
  userId: string | null;
  role: string | null;
  activeLocationId: string | null;
}): Promise<ClinicWorkspaceState> {
  if (!args.userId || !args.role) {
    return {
      available: false,
      clinics: [],
      memberships: [],
      locations: [],
      activeClinicId: null,
      activeClinicRole: null,
    };
  }

  try {
    const profileState = await loadProfileClinicState(args.userId);

    if (args.role === "patient") {
      const locationMatches = args.activeLocationId
        ? await loadClinicLocationSummariesByLocationIds([args.activeLocationId])
        : [];
      const activeClinicId = profileState?.active_clinic_id ?? locationMatches[0]?.clinic_id ?? null;
      if (!activeClinicId) {
        return {
          available: false,
          clinics: [],
          memberships: [],
          locations: [],
          activeClinicId: null,
          activeClinicRole: null,
        };
      }

      const { data: clinicRows, error: clinicError } = await supabase
        .from("clinics")
        .select(CLINIC_SELECT)
        .eq("id", activeClinicId)
        .order("name");

      if (clinicError) throw clinicError;

      const clinics = ((clinicRows as ClinicRow[] | null) ?? []).filter((clinic) => !clinic.is_placeholder);
      const locations = await loadClinicLocationSummaries([activeClinicId]);

      return {
        available: clinics.length > 0,
        clinics,
        memberships: [],
        locations,
        activeClinicId,
        activeClinicRole: "patient",
      };
    }

    if (args.role === "super_admin") {
      const [{ data: clinicRows, error: clinicError }, { data: membershipRows, error: membershipError }] = await Promise.all([
        supabase.from("clinics").select(CLINIC_SELECT).order("display_priority").order("name"),
        // memberships must remain complete even when placeholder clinic records exist
        supabase
          .from("clinic_users")
          .select("id,clinic_id,user_id,role,is_active,invited_by,created_at")
          .eq("user_id", args.userId)
          .eq("is_active", true),
      ]);

      if (clinicError) throw clinicError;
      if (membershipError) throw membershipError;

      const clinics = ((clinicRows as ClinicRow[] | null) ?? []).filter((clinic) => !clinic.is_placeholder);
      const memberships = (membershipRows as ClinicMembershipRow[] | null) ?? [];
      const locations = await loadClinicLocationSummaries(clinics.map((clinic) => clinic.id));

      const locationClinicId =
        args.activeLocationId != null
          ? locations.find((row) => row.location_id === args.activeLocationId)?.clinic_id ?? null
          : null;
      const activeClinicId =
        (profileState?.active_clinic_id && clinics.some((clinic) => clinic.id === profileState.active_clinic_id)
          ? profileState.active_clinic_id
          : null) ??
        locationClinicId ??
        clinics[0]?.id ??
        null;
      const activeClinicRole =
        memberships.find((membership) => membership.clinic_id === activeClinicId)?.role ?? args.role ?? null;

      return {
        available: true,
        clinics,
        memberships,
        locations,
        activeClinicId,
        activeClinicRole,
      };
    }

    const { data: membershipRows, error: membershipError } = await supabase
      .from("clinic_users")
      .select("id,clinic_id,user_id,role,is_active,invited_by,created_at")
      .eq("user_id", args.userId)
      .eq("is_active", true);

    if (membershipError) throw membershipError;

    const memberships = (membershipRows as ClinicMembershipRow[] | null) ?? [];
    const clinicIds = Array.from(new Set(memberships.map((membership) => membership.clinic_id)));
    if (clinicIds.length === 0) {
      return {
        available: true,
        clinics: [],
        memberships,
        locations: [],
        activeClinicId: null,
        activeClinicRole: null,
      };
    }

    const { data: clinicRows, error: clinicError } = await supabase
      .from("clinics")
      .select(CLINIC_SELECT)
      .in("id", clinicIds)
      .order("name");

    if (clinicError) throw clinicError;

    const clinics = ((clinicRows as ClinicRow[] | null) ?? []).filter((clinic) => !clinic.is_placeholder);
    const locations = await loadClinicLocationSummaries(clinicIds);
    const locationClinicId =
      args.activeLocationId != null
        ? locations.find((row) => row.location_id === args.activeLocationId)?.clinic_id ?? null
        : null;
    const activeClinicId =
      (profileState?.active_clinic_id && clinicIds.includes(profileState.active_clinic_id)
        ? profileState.active_clinic_id
        : null) ??
      locationClinicId ??
      clinicIds[0] ??
      null;
    const activeClinicRole = memberships.find((membership) => membership.clinic_id === activeClinicId)?.role ?? null;

    return {
      available: true,
      clinics,
      memberships,
      locations,
      activeClinicId,
      activeClinicRole,
    };
  } catch (error: unknown) {
    if (isMissingClinicFoundationError(error)) {
      return {
        available: false,
        clinics: [],
        memberships: [],
        locations: [],
        activeClinicId: null,
        activeClinicRole: null,
      };
    }
    throw error;
  }
}

export async function saveActiveClinic(userId: string, clinicId: string | null) {
  const { error } = await supabase.from("profiles").update({ active_clinic_id: clinicId }).eq("id", userId);
  if (error) throw error;
}

export async function listAllLocations(options?: { includePlaceholders?: boolean }) {
  const { data, error } = await supabase
    .from("locations")
    .select(LOCATION_SELECT)
    .order("display_priority")
    .order("name");

  if (error) throw error;
  const rows = (data as LocationRow[] | null) ?? [];
  return options?.includePlaceholders ? rows : rows.filter((row) => isOperationalMarket(row));
}

export async function listClinics(options?: { includePlaceholders?: boolean }) {
  const { data, error } = await supabase
    .from("clinics")
    .select(CLINIC_SELECT)
    .order("display_priority")
    .order("name");

  if (error) throw error;
  const rows = (data as ClinicRow[] | null) ?? [];
  return options?.includePlaceholders ? rows : rows.filter((clinic) => !clinic.is_placeholder);
}

export async function getClinic(clinicId: string) {
  const { data, error } = await supabase
    .from("clinics")
    .select(CLINIC_SELECT)
    .eq("id", clinicId)
    .maybeSingle();

  if (error) throw error;
  return (data as ClinicRow | null) ?? null;
}

export async function createClinic(input: {
  name: string;
  slug?: string;
  status?: string;
  brandName?: string;
  supportEmail?: string;
  supportPhone?: string;
  defaultTimezone?: string;
  primaryLocationId?: string | null;
  additionalLocationIds?: string[];
  actorUserId?: string | null;
}) {
  const slug = slugifyClinic(input.slug?.trim() || input.name);
  if (!slug) throw new Error("Clinic slug could not be generated.");

  const { data, error } = await supabase
    .from("clinics")
    .insert({
      name: input.name.trim(),
      slug,
      status: input.status ?? "active",
      brand_name: input.brandName?.trim() || input.name.trim(),
      support_email: input.supportEmail?.trim() || null,
      support_phone: input.supportPhone?.trim() || null,
      default_timezone: input.defaultTimezone?.trim() || "America/Los_Angeles",
      is_placeholder: false,
      market_status: "live",
      display_priority: 100,
    })
    .select(CLINIC_SELECT)
    .single();

  if (error) throw error;

  const clinic = data as ClinicRow;
  const { error: settingsError } = await supabase.from("clinic_settings").upsert(
    {
      clinic_id: clinic.id,
      intake_enabled: true,
      labs_enabled: true,
      ai_protocol_enabled: false,
      fulfillment_enabled: false,
      telehealth_enabled: true,
      default_programs_json: ["glp1", "trt", "wellness", "peptides", "wound-care"],
    },
    { onConflict: "clinic_id" }
  );
  if (settingsError) throw settingsError;

  const allLocationIds = dedupeById(
    [
      ...(input.primaryLocationId ? [{ id: input.primaryLocationId }] : []),
      ...((input.additionalLocationIds ?? []).map((locationId) => ({ id: locationId }))),
    ]
  ).map((row) => row.id);

  for (const locationId of allLocationIds) {
    const { error: linkError } = await supabase.from("clinic_locations").upsert(
      {
        clinic_id: clinic.id,
        location_id: locationId,
        is_primary: locationId === input.primaryLocationId,
      },
      { onConflict: "clinic_id,location_id" }
    );
    if (linkError) throw linkError;
  }

  if (input.actorUserId) {
    await logClinicAuditEvent({
      clinicId: clinic.id,
      actorUserId: input.actorUserId,
      eventType: "clinic_created",
      payload: {
        name: clinic.name,
        slug: clinic.slug,
        primaryLocationId: input.primaryLocationId ?? null,
        additionalLocationIds: allLocationIds.filter((locationId) => locationId !== input.primaryLocationId),
      },
    });
  }

  return clinic;
}

export async function updateClinic(
  clinicId: string,
  input: {
    name: string;
    slug: string;
    status: string;
    brandName?: string;
    supportEmail?: string;
    supportPhone?: string;
    defaultTimezone?: string;
  }
) {
  const { data, error } = await supabase
    .from("clinics")
    .update({
      name: input.name.trim(),
      slug: slugifyClinic(input.slug || input.name),
      status: input.status,
      brand_name: input.brandName?.trim() || input.name.trim(),
      support_email: input.supportEmail?.trim() || null,
      support_phone: input.supportPhone?.trim() || null,
      default_timezone: input.defaultTimezone?.trim() || "America/Los_Angeles",
    })
    .eq("id", clinicId)
    .select(CLINIC_SELECT)
    .single();

  if (error) throw error;
  return data as ClinicRow;
}

export async function listClinicLocations(clinicId: string) {
  return loadClinicLocationSummaries([clinicId]);
}

export async function linkClinicLocation(clinicId: string, locationId: string, isPrimary = false) {
  if (isPrimary) {
    const { error: unsetError } = await supabase.from("clinic_locations").update({ is_primary: false }).eq("clinic_id", clinicId);
    if (unsetError) throw unsetError;
  }

  const { error } = await supabase
    .from("clinic_locations")
    .upsert({ clinic_id: clinicId, location_id: locationId, is_primary: isPrimary }, { onConflict: "clinic_id,location_id" });

  if (error) throw error;
}

export async function removeClinicLocation(clinicId: string, locationId: string) {
  const { error } = await supabase.from("clinic_locations").delete().eq("clinic_id", clinicId).eq("location_id", locationId);
  if (error) throw error;
}

export async function listClinicMembers(clinicId: string) {
  const { data: membershipRows, error: membershipError } = await supabase
    .from("clinic_users")
    .select("id,clinic_id,user_id,role,is_active,invited_by,created_at")
    .eq("clinic_id", clinicId)
    .order("created_at");

  if (membershipError) throw membershipError;

  const memberships = (membershipRows as ClinicMembershipRow[] | null) ?? [];
  const userIds = Array.from(new Set(memberships.map((membership) => membership.user_id)));
  if (userIds.length === 0) return [] as ClinicMemberSummary[];

  const { data: profileRows, error: profileError } = await supabase
    .from("profiles")
    .select("id,first_name,last_name,role,active_location_id")
    .in("id", userIds)
    .order("first_name");

  if (profileError) throw profileError;

  const profileMap = new Map<string, ProfileRow>();
  for (const profile of (profileRows as ProfileRow[] | null) ?? []) {
    profileMap.set(profile.id, profile);
  }

  return memberships.map((membership) => {
    const profile = profileMap.get(membership.user_id);
    return {
      ...membership,
      first_name: profile?.first_name ?? null,
      last_name: profile?.last_name ?? null,
      active_location_id: profile?.active_location_id ?? null,
    };
  });
}

export async function listAssignableProfiles() {
  const { data, error } = await supabase
    .from("profiles")
    .select("id,first_name,last_name,role,active_location_id")
    .in("role", [...STAFF_ROLE_OPTIONS])
    .order("first_name");

  if (error) throw error;
  return (data as ProfileRow[] | null) ?? [];
}

export async function addExistingClinicUser(input: {
  clinicId: string;
  userId: string;
  role: string;
  invitedBy?: string | null;
  primaryLocationId?: string | null;
}) {
  const { error } = await supabase.from("clinic_users").upsert(
    {
      clinic_id: input.clinicId,
      user_id: input.userId,
      role: input.role,
      is_active: true,
      invited_by: input.invitedBy ?? null,
    },
    { onConflict: "clinic_id,user_id" }
  );

  if (error) throw error;

  if (input.primaryLocationId) {
    const { error: resetPrimaryError } = await supabase
      .from("user_locations")
      .update({ is_primary: false })
      .eq("user_id", input.userId);

    if (resetPrimaryError) throw resetPrimaryError;

    const { data: existingLocationRow, error: existingLocationError } = await supabase
      .from("user_locations")
      .select("id")
      .eq("user_id", input.userId)
      .eq("location_id", input.primaryLocationId)
      .maybeSingle();

    if (existingLocationError) throw existingLocationError;

    if (existingLocationRow?.id) {
      const { error: updateLocationError } = await supabase
        .from("user_locations")
        .update({ is_primary: true })
        .eq("id", existingLocationRow.id);
      if (updateLocationError) throw updateLocationError;
    } else {
      const { error: insertLocationError } = await supabase
        .from("user_locations")
        .insert({
          user_id: input.userId,
          location_id: input.primaryLocationId,
          is_primary: true,
        });
      if (insertLocationError) throw insertLocationError;
    }
  }
}

export async function createClinicStaffMember(input: {
  clinicId: string;
  firstName: string;
  lastName: string;
  email: string;
  tempPassword: string;
  role: string;
  locationId: string;
}) {
  const { data, error } = await supabase.functions.invoke("create-staff-user", {
    body: {
      first_name: input.firstName.trim(),
      last_name: input.lastName.trim(),
      email: input.email.trim().toLowerCase(),
      temp_password: input.tempPassword,
      role: input.role,
      location_id: input.locationId,
      clinic_id: input.clinicId,
    },
  });

  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return data;
}

export async function getClinicSettings(clinicId: string) {
  const { data, error } = await supabase
    .from("clinic_settings")
    .select("id,clinic_id,intake_enabled,labs_enabled,ai_protocol_enabled,fulfillment_enabled,telehealth_enabled,default_programs_json,created_at,updated_at")
    .eq("clinic_id", clinicId)
    .maybeSingle();

  if (error) throw error;

  if (!data) {
    const fallback = {
      clinic_id: clinicId,
      intake_enabled: true,
      labs_enabled: true,
      ai_protocol_enabled: false,
      fulfillment_enabled: false,
      telehealth_enabled: true,
      default_programs_json: ["glp1", "trt", "wellness", "peptides", "wound-care"],
    };
    const { data: inserted, error: insertError } = await supabase
      .from("clinic_settings")
      .insert(fallback)
      .select("id,clinic_id,intake_enabled,labs_enabled,ai_protocol_enabled,fulfillment_enabled,telehealth_enabled,default_programs_json,created_at,updated_at")
      .single();
    if (insertError) throw insertError;
    return inserted as ClinicSettingsRow;
  }

  return data as ClinicSettingsRow;
}

export async function saveClinicSettings(
  clinicId: string,
  input: Omit<ClinicSettingsRow, "id" | "clinic_id" | "created_at" | "updated_at">
) {
  const { data, error } = await supabase
    .from("clinic_settings")
    .upsert(
      {
        clinic_id: clinicId,
        intake_enabled: input.intake_enabled,
        labs_enabled: input.labs_enabled,
        ai_protocol_enabled: input.ai_protocol_enabled,
        fulfillment_enabled: input.fulfillment_enabled,
        telehealth_enabled: input.telehealth_enabled,
        default_programs_json: input.default_programs_json,
      },
      { onConflict: "clinic_id" }
    )
    .select("id,clinic_id,intake_enabled,labs_enabled,ai_protocol_enabled,fulfillment_enabled,telehealth_enabled,default_programs_json,created_at,updated_at")
    .single();

  if (error) throw error;
  return data as ClinicSettingsRow;
}

export async function listClinicServiceCatalog(clinicId: string, locationIds: string[]) {
  if (locationIds.length === 0) return [] as ClinicServiceCatalogRow[];

  const serviceQuery = supabase
    .from("services")
    .select("service_key,name,category,service_group,location_id");

  const filteredServiceQuery = locationIds.length > 0 ? serviceQuery.in("location_id", locationIds) : serviceQuery;
  const [{ data: serviceRows, error: serviceError }, { data: toggleRows, error: toggleError }] = await Promise.all([
    filteredServiceQuery,
    supabase.from("clinic_services").select("id,clinic_id,service_key,is_enabled,pricing_json").eq("clinic_id", clinicId),
  ]);

  if (serviceError) throw serviceError;
  if (toggleError) throw toggleError;

  const serviceMap = new Map<string, { label: string; category: string | null; service_group: string | null; locationIds: Set<string> }>();
  for (const service of (serviceRows as ServiceRow[] | null) ?? []) {
    const serviceKey = service.service_key?.trim();
    if (!serviceKey) continue;
    const existing = serviceMap.get(serviceKey) ?? {
      label: service.name,
      category: service.category ?? null,
      service_group: service.service_group ?? null,
      locationIds: new Set<string>(),
    };
    if (!existing.label && service.name) existing.label = service.name;
    if (service.location_id) existing.locationIds.add(service.location_id);
    serviceMap.set(serviceKey, existing);
  }

  const toggleMap = new Map<string, { is_enabled: boolean; pricing_json: Record<string, unknown> }>();
  for (const toggle of (toggleRows as Array<{ service_key: string; is_enabled: boolean; pricing_json: Record<string, unknown> }> | null) ?? []) {
    toggleMap.set(toggle.service_key, {
      is_enabled: toggle.is_enabled,
      pricing_json: toggle.pricing_json ?? {},
    });
  }

  return Array.from(serviceMap.entries())
    .map(([serviceKey, value]) => {
      const toggle = toggleMap.get(serviceKey);
      return {
        service_key: serviceKey,
        label: value.label,
        category: value.category,
        service_group: value.service_group,
        location_count: value.locationIds.size,
        is_enabled: toggle?.is_enabled ?? true,
        pricing_json: toggle?.pricing_json ?? {},
      } satisfies ClinicServiceCatalogRow;
    })
    .sort((a, b) => a.label.localeCompare(b.label));
}

export async function saveClinicServiceToggle(input: {
  clinicId: string;
  serviceKey: string;
  isEnabled: boolean;
  pricingJson?: Record<string, unknown>;
}) {
  const { error } = await supabase.from("clinic_services").upsert(
    {
      clinic_id: input.clinicId,
      service_key: input.serviceKey,
      is_enabled: input.isEnabled,
      pricing_json: input.pricingJson ?? {},
    },
    { onConflict: "clinic_id,service_key" }
  );

  if (error) throw error;
}

export async function logClinicAuditEvent(input: {
  clinicId: string;
  actorUserId?: string | null;
  eventType: string;
  payload?: Record<string, unknown>;
}) {
  const { error } = await supabase.from("clinic_audit_events").insert({
    clinic_id: input.clinicId,
    actor_user_id: input.actorUserId ?? null,
    event_type: input.eventType,
    payload_json: input.payload ?? {},
  });

  if (error) throw error;
}

export { STAFF_ROLE_OPTIONS };
