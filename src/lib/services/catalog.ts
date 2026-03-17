import { supabase } from "../supabase";

export type CatalogService = {
  id: string;
  name: string;
  description: string | null;
  category: string | null;
  service_group: string | null;
  location_id: string | null;
  requires_consult: boolean | null;
  pricing_unit: string | null;
  duration_minutes: number | null;
  visit_type: string | null;
  price_marketing_cents: number | null;
  price_regular_cents: number | null;
  is_active?: boolean | null;
};

export type CatalogLocation = {
  id: string;
  name: string | null;
};

const DISPLAY_SELECT =
  "id,name,description,category,service_group,location_id,requires_consult,pricing_unit,duration_minutes,visit_type,price_marketing_cents,price_regular_cents";

const RAW_SELECT =
  "id,name,description,category,service_group,location_id,requires_consult,pricing_unit,duration_minutes,visit_type,price_marketing_cents,price_regular_cents,is_active";

export function fmtMoney(cents: number | null | undefined) {
  if (cents === null || cents === undefined) return null;
  const n = Number(cents);
  if (Number.isNaN(n)) return null;
  return `$${(n / 100).toFixed(2)}`;
}

export function categoryLabel(v: string | null) {
  if (!v) return "Other";
  const normalized = v.toLowerCase();
  if (normalized === "iv_drip") return "IV Therapy";
  if (normalized === "neuromodulator") return "Injectables";
  if (normalized === "consult") return "Consultations";
  if (normalized === "glp1") return "GLP-1";
  if (normalized === "hrt") return "Hormone Therapy";
  if (normalized === "trt") return "TRT";
  if (normalized === "wound_care") return "Wound Care";
  if (normalized === "peptides") return "Peptides";
  if (normalized === "botox") return "Botox";
  return v.replaceAll("_", " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function categoryIcon(cat: string | null) {
  switch (cat) {
    case "iv_therapy":
    case "iv_drip":
      return "Hydration";
    case "injectables":
    case "neuromodulator":
    case "botox":
      return "Injectables";
    case "wound_care":
      return "Wound Care";
    case "hormone_therapy":
    case "hrt":
    case "trt":
      return "Hormones";
    case "wellness":
    case "peptides":
    case "glp1":
      return "Wellness";
    default:
      return "Care";
  }
}

export function serviceDisplayKey(service: Pick<CatalogService, "category" | "service_group">) {
  return service.category ?? service.service_group ?? "other";
}

export function categoryAccent(cat: string | null) {
  switch (cat) {
    case "iv_therapy":
    case "iv_drip":
      return "rgba(56,189,248,0.18)";
    case "injectables":
    case "neuromodulator":
    case "botox":
      return "rgba(244,114,182,0.18)";
    case "wound_care":
      return "rgba(34,197,94,0.18)";
    case "hormone_therapy":
    case "hrt":
    case "trt":
      return "rgba(59,130,246,0.18)";
    case "wellness":
    case "peptides":
    case "glp1":
      return "rgba(250,204,21,0.18)";
    case "consult":
      return "rgba(168,85,247,0.18)";
    default:
      return "rgba(148,163,184,0.18)";
  }
}

export function priceLabel(service: CatalogService) {
  return fmtMoney(service.price_marketing_cents) ?? fmtMoney(service.price_regular_cents);
}

export function pricingUnitLabel(unit: string | null) {
  if (!unit) return "Starting price";
  if (unit === "per_session") return "Per session";
  if (unit === "per_unit") return "Per unit";
  if (unit === "flat") return "Flat rate";
  return unit.replaceAll("_", " ");
}

export function estimatedTiming(service: CatalogService) {
  if (service.duration_minutes) return `${service.duration_minutes} min`;
  if (service.requires_consult) return "Consultation Based";

  const name = service.name.toLowerCase();
  const cat = (service.category ?? service.service_group ?? "").toLowerCase();
  if (name.includes("iv") || cat.includes("iv")) return "30-60 min";
  if (name.includes("botox") || cat.includes("neuromodulator") || cat.includes("aesthetic")) return "15-45 min";
  if (name.includes("wound") || cat.includes("wound")) return "30-60 min";
  if (name.includes("hormone") || name.includes("hrt") || cat.includes("hormone")) return "45-60 min";
  if (name.includes("weight") || name.includes("glp")) return "30-45 min";
  return "Varies by treatment";
}

export function shortBlurb(service: CatalogService) {
  if (service.description?.trim()) return service.description.trim();
  return "Personalized care options designed to support your goals and overall health.";
}

export function idealFor(service: CatalogService) {
  const key = serviceDisplayKey(service);
  switch (key) {
    case "iv_therapy":
    case "iv_drip":
      return "Hydration support, recovery, energy, and wellness optimization.";
    case "injectables":
    case "neuromodulator":
    case "botox":
      return "Targeted aesthetic goals with provider-guided treatment planning.";
    case "wound_care":
      return "Patients needing expert wound evaluation, treatment, and follow-up.";
    case "hormone_therapy":
    case "hrt":
    case "trt":
      return "Hormonal symptom evaluation and tailored management.";
    case "wellness":
    case "peptides":
    case "glp1":
      return "Patients seeking metabolic, peptide, or broader wellness support.";
    case "consult":
      return "Patients who need an initial evaluation before starting treatment.";
    default:
      return "Patients seeking individualized treatment recommendations.";
  }
}

export async function loadCatalogServices() {
  const displayRes = await supabase.from("services_display").select(DISPLAY_SELECT).order("category").order("name");
  if (!displayRes.error && displayRes.data) {
    return { services: (displayRes.data as CatalogService[]) ?? [], dataSource: "services_display" };
  }

  const rawRes = await supabase.from("services").select(RAW_SELECT).eq("is_active", true).order("category").order("name");
  if (rawRes.error) throw rawRes.error;
  return { services: (rawRes.data as CatalogService[]) ?? [], dataSource: "services" };
}

export async function loadCatalogLocations() {
  const { data, error } = await supabase.from("locations").select("id,name").order("name");
  if (error) throw error;
  return (data as CatalogLocation[]) ?? [];
}
