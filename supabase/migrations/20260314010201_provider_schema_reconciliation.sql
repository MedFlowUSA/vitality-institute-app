alter table if exists public.patient_intakes
  add column if not exists provider_notes text,
  add column if not exists reviewed_by uuid,
  add column if not exists reviewed_at timestamptz,
  add column if not exists locked_at timestamptz,
  add column if not exists consent_signed_name text,
  add column if not exists consent_signed_at timestamptz,
  add column if not exists wound_data jsonb,
  add column if not exists medications text;

alter table if exists public.patient_visits
  add column if not exists appointment_id uuid,
  add column if not exists intake_id uuid,
  add column if not exists referral_id uuid,
  add column if not exists visit_date timestamptz,
  add column if not exists status text,
  add column if not exists summary text,
  add column if not exists created_at timestamptz default now(),
  add column if not exists updated_at timestamptz default now();

alter table if exists public.patient_visit_notes
  add column if not exists visit_id uuid,
  add column if not exists note_type text default 'note',
  add column if not exists body text,
  add column if not exists created_by uuid,
  add column if not exists created_at timestamptz default now();

alter table if exists public.patient_soap_notes
  add column if not exists provider_profile_id uuid,
  add column if not exists created_by uuid,
  add column if not exists subjective text,
  add column if not exists objective text,
  add column if not exists assessment text,
  add column if not exists plan text,
  add column if not exists is_signed boolean default false,
  add column if not exists is_locked boolean default false,
  add column if not exists locked_at timestamptz,
  add column if not exists signed_at timestamptz,
  add column if not exists signed_by uuid,
  add column if not exists amended_from_id uuid,
  add column if not exists amendment_reason text,
  add column if not exists amendment_at timestamptz,
  add column if not exists amendment_by uuid,
  add column if not exists created_at timestamptz default now(),
  add column if not exists updated_at timestamptz default now();

alter table if exists public.patient_treatment_plans
  add column if not exists status text default 'draft',
  add column if not exists summary text,
  add column if not exists patient_instructions text,
  add column if not exists internal_notes text,
  add column if not exists plan jsonb default '{}'::jsonb,
  add column if not exists signed_by uuid,
  add column if not exists signed_at timestamptz,
  add column if not exists is_locked boolean default false,
  add column if not exists created_at timestamptz default now(),
  add column if not exists updated_at timestamptz default now();
