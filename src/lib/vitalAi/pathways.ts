import { supabase } from "../supabase";
import type { VitalAiPathwayRow } from "./types";

export async function loadVitalAiPathways() {
  const { data, error } = await supabase
    .from("vital_ai_pathways")
    .select("id,slug,name,description,is_active,version,definition_json,created_at,updated_at")
    .eq("is_active", true)
    .order("name");

  if (error) throw error;
  return (data as VitalAiPathwayRow[]) ?? [];
}

export async function loadVitalAiPathwayById(pathwayId: string) {
  const { data, error } = await supabase
    .from("vital_ai_pathways")
    .select("id,slug,name,description,is_active,version,definition_json,created_at,updated_at")
    .eq("id", pathwayId)
    .maybeSingle();

  if (error) throw error;
  return (data as VitalAiPathwayRow | null) ?? null;
}
