create table if not exists public.protocol_templates (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid null references public.clinics(id) on delete cascade,
  service_line text not null check (service_line in ('glp1', 'trt', 'wellness', 'peptides', 'general_consult', 'wound_care')),
  name text not null,
  config_json jsonb not null default '{}'::jsonb,
  is_active boolean not null default true,
  template_version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.ai_protocol_assessments (
  id uuid primary key default gen_random_uuid(),
  vital_ai_session_id uuid not null unique references public.vital_ai_sessions(id) on delete cascade,
  vital_ai_profile_id uuid null references public.vital_ai_profiles(id) on delete set null,
  patient_id uuid null references public.patients(id) on delete set null,
  intake_submission_id uuid null references public.intake_submissions(id) on delete set null,
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  location_id uuid null references public.locations(id) on delete set null,
  service_line text not null check (service_line in ('glp1', 'trt', 'wellness', 'peptides', 'general_consult', 'wound_care')),
  recommendation_type text not null default 'candidate_review'
    check (recommendation_type in ('candidate_review', 'missing_information', 'follow_up_needed')),
  raw_output_json jsonb not null default '{}'::jsonb,
  structured_output_json jsonb not null default '{}'::jsonb,
  model_key text not null,
  model_version text not null,
  status text not null default 'generated'
    check (status in ('generated', 'reviewed', 'archived', 'error')),
  provider_review_required boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_protocol_templates_service_line on public.protocol_templates (service_line, is_active, clinic_id);
create index if not exists idx_ai_protocol_assessments_clinic_location on public.ai_protocol_assessments (clinic_id, location_id, created_at desc);
create index if not exists idx_ai_protocol_assessments_patient on public.ai_protocol_assessments (patient_id, created_at desc);
create index if not exists idx_ai_protocol_assessments_status on public.ai_protocol_assessments (status, created_at desc);

create or replace function public.touch_protocol_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists protocol_templates_touch_updated_at on public.protocol_templates;
create trigger protocol_templates_touch_updated_at
before update on public.protocol_templates
for each row
execute function public.touch_protocol_updated_at();

drop trigger if exists ai_protocol_assessments_touch_updated_at on public.ai_protocol_assessments;
create trigger ai_protocol_assessments_touch_updated_at
before update on public.ai_protocol_assessments
for each row
execute function public.touch_protocol_updated_at();

insert into public.protocol_templates (clinic_id, service_line, name, config_json, is_active, template_version)
select
  null,
  seed.service_line,
  seed.name,
  seed.config_json,
  true,
  1
from (
  values
    (
      'glp1',
      'Global GLP-1 Protocol Template',
      jsonb_build_object(
        'label', 'GLP-1 metabolic review',
        'suggested_program', 'Physician-reviewed GLP-1 metabolic program',
        'suggested_medications', jsonb_build_array('GLP-1 candidacy review'),
        'suggested_dosage', 'Start-low escalation if approved by physician',
        'suggested_frequency', 'Weekly if approved',
        'suggested_duration', '12-week starter review',
        'required_labs', jsonb_build_array('A1c', 'CMP', 'baseline weight/BMI'),
        'follow_up_recommendations', jsonb_build_array(
          'Confirm contraindications and medication history.',
          'Review baseline metabolic labs before any prescribing decision.',
          'Provider approval required before final order routing.'
        )
      )
    ),
    (
      'trt',
      'Global TRT Protocol Template',
      jsonb_build_object(
        'label', 'TRT / hormone optimization review',
        'suggested_program', 'Physician-reviewed TRT optimization pathway',
        'suggested_medications', jsonb_build_array('Testosterone therapy candidacy review'),
        'suggested_dosage', 'Conservative starting dose if approved',
        'suggested_frequency', 'Weekly or biweekly per physician review',
        'suggested_duration', '8-12 week reassessment cycle',
        'required_labs', jsonb_build_array('Total testosterone', 'Free testosterone', 'CBC', 'CMP', 'PSA if clinically indicated'),
        'follow_up_recommendations', jsonb_build_array(
          'Review symptom cluster, prior hormone history, and fertility considerations.',
          'Verify baseline labs before treatment planning.',
          'Clinical decision remains with licensed physician.'
        )
      )
    ),
    (
      'wellness',
      'Global Wellness Protocol Template',
      jsonb_build_object(
        'label', 'Wellness optimization review',
        'suggested_program', 'Physician-reviewed wellness consultation',
        'suggested_medications', jsonb_build_array(),
        'suggested_dosage', null,
        'suggested_frequency', null,
        'suggested_duration', 'Initial consult plus lab-guided follow-up',
        'required_labs', jsonb_build_array('CBC', 'CMP', 'thyroid panel', 'Vitamin D if clinically indicated'),
        'follow_up_recommendations', jsonb_build_array(
          'Review symptoms, stress, sleep, recovery, and relevant lab history.',
          'Clarify whether peptide or hormone pathways are more appropriate after physician review.',
          'Provider approval required before any treatment plan is finalized.'
        )
      )
    ),
    (
      'peptides',
      'Global Peptide Protocol Template',
      jsonb_build_object(
        'label', 'Peptide-support review',
        'suggested_program', 'Physician-reviewed peptide consult pathway',
        'suggested_medications', jsonb_build_array('Peptide therapy candidacy review'),
        'suggested_dosage', 'Program-specific dosing only after physician review',
        'suggested_frequency', 'Varies by peptide and physician plan',
        'suggested_duration', 'Initial consult plus program-specific reassessment',
        'required_labs', jsonb_build_array('CBC', 'CMP', 'goal-specific baseline labs'),
        'follow_up_recommendations', jsonb_build_array(
          'Review intended goal, prior peptide exposure, and medication/allergy history.',
          'Confirm required baseline labs before treatment planning.',
          'Provider approval required before fulfillment or ordering.'
        )
      )
    ),
    (
      'general_consult',
      'Global General Consult Protocol Template',
      jsonb_build_object(
        'label', 'General physician consultation',
        'suggested_program', 'Physician-reviewed consultation',
        'suggested_medications', jsonb_build_array(),
        'suggested_dosage', null,
        'suggested_frequency', null,
        'suggested_duration', 'Initial consult',
        'required_labs', jsonb_build_array(),
        'follow_up_recommendations', jsonb_build_array(
          'Route case to physician review for service-line determination.',
          'Request missing clinical history or labs if needed.',
          'Clinical decision remains with licensed physician.'
        )
      )
    ),
    (
      'wound_care',
      'Global Wound Care Protocol Template',
      jsonb_build_object(
        'label', 'Wound-care provider review',
        'suggested_program', 'Provider-side wound-care review',
        'suggested_medications', jsonb_build_array(),
        'suggested_dosage', null,
        'suggested_frequency', null,
        'suggested_duration', 'Initial wound evaluation plus reassessment cadence',
        'required_labs', jsonb_build_array('Wound photos', 'vascular review if clinically indicated'),
        'follow_up_recommendations', jsonb_build_array(
          'Review wound images, symptom progression, and infection concern.',
          'Escalate urgent concerns for earlier physician review.',
          'Provider approval required before any advanced treatment plan is finalized.'
        )
      )
    )
) as seed(service_line, name, config_json)
where not exists (
  select 1
  from public.protocol_templates existing
  where existing.clinic_id is null
    and existing.service_line = seed.service_line
    and existing.name = seed.name
);

alter table public.protocol_templates enable row level security;
alter table public.ai_protocol_assessments enable row level security;

drop policy if exists protocol_templates_select_policy on public.protocol_templates;
create policy protocol_templates_select_policy
on public.protocol_templates
for select
to authenticated
using (
  is_active = true
  and (
    clinic_id is null
    or public.user_can_access_clinic(auth.uid(), clinic_id)
  )
);

drop policy if exists protocol_templates_write_policy on public.protocol_templates;
create policy protocol_templates_write_policy
on public.protocol_templates
for all
to authenticated
using (
  public.user_is_super_admin(auth.uid())
  or (clinic_id is not null and public.user_can_manage_clinic(auth.uid(), clinic_id))
)
with check (
  public.user_is_super_admin(auth.uid())
  or (clinic_id is not null and public.user_can_manage_clinic(auth.uid(), clinic_id))
);

drop policy if exists ai_protocol_assessments_select_policy on public.ai_protocol_assessments;
create policy ai_protocol_assessments_select_policy
on public.ai_protocol_assessments
for select
to authenticated
using (public.user_can_access_vital_ai_session(auth.uid(), vital_ai_session_id));

drop policy if exists ai_protocol_assessments_insert_policy on public.ai_protocol_assessments;
create policy ai_protocol_assessments_insert_policy
on public.ai_protocol_assessments
for insert
to authenticated
with check (public.user_can_access_vital_ai_session(auth.uid(), vital_ai_session_id));

drop policy if exists ai_protocol_assessments_update_policy on public.ai_protocol_assessments;
create policy ai_protocol_assessments_update_policy
on public.ai_protocol_assessments
for update
to authenticated
using (public.user_can_access_vital_ai_session(auth.uid(), vital_ai_session_id))
with check (public.user_can_access_vital_ai_session(auth.uid(), vital_ai_session_id));
