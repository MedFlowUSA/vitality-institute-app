import { supabase } from "./supabase";

type AuditWriteArgs = {
  location_id: string;
  event_type: string;
  entity_type?: string | null;
  entity_id?: string | null;
  patient_id?: string | null;
  visit_id?: string | null;
  appointment_id?: string | null;
  metadata?: Record<string, any> | null;
};

export async function auditWrite(args: AuditWriteArgs) {
  const { data, error } = await supabase.rpc("audit_log_write", {
    p_location_id: args.location_id,
    p_event_type: args.event_type,
    p_entity_type: args.entity_type ?? null,
    p_entity_id: args.entity_id ?? null,
    p_patient_id: args.patient_id ?? null,
    p_visit_id: args.visit_id ?? null,
    p_appointment_id: args.appointment_id ?? null,
    p_metadata: args.metadata ?? {},
  });

  if (error) throw error;
  return data as string; // returns uuid
}
