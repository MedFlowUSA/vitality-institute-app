alter table public.vital_ai_leads
  add column if not exists appointment_id text;
