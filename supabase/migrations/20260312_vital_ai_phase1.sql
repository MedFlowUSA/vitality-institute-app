create extension if not exists pgcrypto;

create table if not exists public.vital_ai_pathways (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  description text,
  is_active boolean not null default true,
  version integer not null default 1,
  definition_json jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.vital_ai_sessions (
  id uuid primary key default gen_random_uuid(),
  pathway_id uuid not null references public.vital_ai_pathways(id) on delete restrict,
  patient_id uuid references public.patients(id) on delete set null,
  profile_id uuid,
  status text not null default 'draft' check (status in ('draft', 'submitted', 'cancelled')),
  current_step_key text,
  source text,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  last_saved_at timestamptz not null default now(),
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.vital_ai_responses (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.vital_ai_sessions(id) on delete cascade,
  question_key text not null,
  value_json jsonb,
  updated_at timestamptz not null default now(),
  unique (session_id, question_key)
);

create table if not exists public.vital_ai_files (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.vital_ai_sessions(id) on delete cascade,
  patient_id uuid references public.patients(id) on delete set null,
  profile_id uuid,
  bucket text not null,
  path text not null,
  filename text not null,
  content_type text,
  category text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.vital_ai_profiles (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null unique references public.vital_ai_sessions(id) on delete cascade,
  pathway_id uuid not null references public.vital_ai_pathways(id) on delete restrict,
  patient_id uuid references public.patients(id) on delete set null,
  profile_id uuid,
  summary text,
  profile_json jsonb not null,
  risk_flags_json jsonb,
  triage_level text,
  status text not null default 'new' check (status in ('new', 'reviewed', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.vital_ai_leads (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null unique references public.vital_ai_sessions(id) on delete cascade,
  pathway_id uuid not null references public.vital_ai_pathways(id) on delete restrict,
  patient_id uuid references public.patients(id) on delete set null,
  profile_id uuid,
  lead_status text not null default 'new' check (lead_status in ('new', 'contacted', 'scheduled', 'closed')),
  priority text,
  assigned_to uuid,
  next_action_at timestamptz,
  lead_json jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.vital_ai_review_tasks (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.vital_ai_sessions(id) on delete cascade,
  profile_id uuid references public.vital_ai_profiles(id) on delete cascade,
  lead_id uuid references public.vital_ai_leads(id) on delete cascade,
  task_type text not null check (task_type in ('staff_follow_up', 'provider_review')),
  assigned_role text not null,
  status text not null default 'open' check (status in ('open', 'done', 'cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (session_id, task_type)
);

create index if not exists idx_vital_ai_pathways_active on public.vital_ai_pathways (is_active, slug);
create index if not exists idx_vital_ai_sessions_status on public.vital_ai_sessions (status, updated_at desc);
create index if not exists idx_vital_ai_sessions_patient on public.vital_ai_sessions (patient_id, created_at desc);
create index if not exists idx_vital_ai_sessions_profile on public.vital_ai_sessions (profile_id, created_at desc);
create index if not exists idx_vital_ai_responses_session on public.vital_ai_responses (session_id);
create index if not exists idx_vital_ai_files_session on public.vital_ai_files (session_id, created_at desc);
create index if not exists idx_vital_ai_profiles_status on public.vital_ai_profiles (status, created_at desc);
create index if not exists idx_vital_ai_profiles_patient on public.vital_ai_profiles (patient_id, created_at desc);
create index if not exists idx_vital_ai_leads_status on public.vital_ai_leads (lead_status, created_at desc);
create index if not exists idx_vital_ai_leads_patient on public.vital_ai_leads (patient_id, created_at desc);
create index if not exists idx_vital_ai_review_tasks_role on public.vital_ai_review_tasks (assigned_role, status, created_at desc);

insert into storage.buckets (id, name, public)
values
  ('vital-ai-files', 'vital-ai-files', false),
  ('vital-ai-images', 'vital-ai-images', false)
on conflict (id) do nothing;

insert into public.vital_ai_pathways (slug, name, description, version, is_active, definition_json)
values
(
  'general-consult',
  'General Consultation',
  'General consultation intake with basic medical context, visit goals, and optional prior record uploads.',
  1,
  true,
  $${
    "pathwayKey": "general-consult",
    "title": "General Consultation",
    "description": "Tell us about your goals, symptoms, and any records you want your care team to review.",
    "steps": [
      {
        "key": "contact",
        "title": "Contact Information",
        "description": "Confirm your basic information before you continue.",
        "questions": [
          { "key": "first_name", "label": "First name", "type": "text", "required": true },
          { "key": "last_name", "label": "Last name", "type": "text", "required": true },
          { "key": "dob", "label": "Date of birth", "type": "date", "required": true },
          { "key": "phone", "label": "Phone number", "type": "text", "required": true },
          { "key": "email", "label": "Email", "type": "text", "required": true },
          {
            "key": "preferred_contact",
            "label": "Preferred contact method",
            "type": "select",
            "required": true,
            "options": ["phone", "text", "email"]
          }
        ]
      },
      {
        "key": "visit_reason",
        "title": "Visit Reason",
        "description": "Help us understand why you are reaching out.",
        "questions": [
          {
            "key": "visit_type",
            "label": "Visit type",
            "type": "select",
            "required": true,
            "options": ["general consultation", "follow-up"]
          },
          {
            "key": "primary_concern",
            "label": "What is your main reason for reaching out today?",
            "type": "textarea",
            "required": true
          },
          {
            "key": "goals",
            "label": "What would you like to accomplish?",
            "type": "textarea",
            "required": true
          },
          {
            "key": "current_changes",
            "label": "What has changed since your last visit?",
            "type": "textarea",
            "required": true,
            "visibleWhen": [{ "key": "visit_type", "operator": "equals", "value": "follow-up" }]
          }
        ]
      },
      {
        "key": "history",
        "title": "History",
        "description": "Share any medical history or symptoms that will help the provider prepare.",
        "questions": [
          { "key": "symptoms", "label": "Current symptoms", "type": "textarea", "required": true },
          { "key": "medical_history", "label": "Relevant medical history", "type": "textarea", "required": false },
          { "key": "current_medications", "label": "Current medications", "type": "textarea", "required": false },
          { "key": "prior_records_available", "label": "Do you want to upload prior records?", "type": "boolean", "required": true }
        ]
      },
      {
        "key": "uploads",
        "title": "Uploads",
        "description": "Upload any documents that will help the team prepare.",
        "questions": [
          {
            "key": "prior_records",
            "label": "Prior records",
            "type": "file",
            "required": true,
            "category": "intake_attachment",
            "visibleWhen": [{ "key": "prior_records_available", "operator": "equals", "value": true }]
          },
          {
            "key": "photo_id",
            "label": "Photo ID",
            "type": "file",
            "required": false,
            "category": "photo_id"
          }
        ]
      },
      {
        "key": "consent",
        "title": "Consent",
        "description": "Confirm that the information you provided is accurate.",
        "questions": [
          { "key": "consent_ack", "label": "I confirm my intake details are accurate.", "type": "boolean", "required": true },
          { "key": "consent_signature", "label": "Type your full name", "type": "text", "required": true }
        ]
      }
    ]
  }$$::jsonb
),
(
  'wound-care',
  'Wound Care',
  'Wound care intake with wound history, symptom screening, and wound photo uploads.',
  1,
  true,
  $${
    "pathwayKey": "wound-care",
    "title": "Wound Care",
    "description": "Share details about the wound so the care team can review your case before the visit.",
    "steps": [
      {
        "key": "contact",
        "title": "Contact Information",
        "description": "Confirm your basic information before you continue.",
        "questions": [
          { "key": "first_name", "label": "First name", "type": "text", "required": true },
          { "key": "last_name", "label": "Last name", "type": "text", "required": true },
          { "key": "dob", "label": "Date of birth", "type": "date", "required": true },
          { "key": "phone", "label": "Phone number", "type": "text", "required": true },
          { "key": "email", "label": "Email", "type": "text", "required": true }
        ]
      },
      {
        "key": "wound_overview",
        "title": "Wound Overview",
        "description": "Describe the wound that needs to be reviewed.",
        "questions": [
          { "key": "wound_location", "label": "Where is the wound located?", "type": "text", "required": true },
          {
            "key": "wound_duration",
            "label": "How long has it been present?",
            "type": "select",
            "required": true,
            "options": ["less than 1 week", "1-4 weeks", "1-3 months", "more than 3 months"]
          },
          { "key": "multiple_wounds", "label": "Are there multiple wounds?", "type": "boolean", "required": true },
          { "key": "drainage_present", "label": "Is there drainage?", "type": "boolean", "required": true },
          { "key": "infection_concern", "label": "Are you concerned about infection?", "type": "boolean", "required": true },
          { "key": "pain_level", "label": "Pain level (0-10)", "type": "number", "required": true }
        ]
      },
      {
        "key": "wound_details",
        "title": "Wound Details",
        "description": "Provide more detail so the provider can prepare.",
        "questions": [
          { "key": "wound_cause", "label": "What caused the wound?", "type": "textarea", "required": false },
          { "key": "current_dressing", "label": "Current dressing or wound care", "type": "textarea", "required": false },
          { "key": "prior_treatments", "label": "Prior treatments", "type": "textarea", "required": false },
          {
            "key": "secondary_wound_details",
            "label": "Describe any additional wounds",
            "type": "textarea",
            "required": true,
            "visibleWhen": [{ "key": "multiple_wounds", "operator": "equals", "value": true }]
          },
          {
            "key": "drainage_description",
            "label": "Describe the drainage",
            "type": "textarea",
            "required": true,
            "visibleWhen": [{ "key": "drainage_present", "operator": "equals", "value": true }]
          },
          {
            "key": "infection_symptoms",
            "label": "Describe signs or symptoms of infection",
            "type": "textarea",
            "required": true,
            "visibleWhen": [{ "key": "infection_concern", "operator": "equals", "value": true }]
          }
        ]
      },
      {
        "key": "uploads",
        "title": "Photos and Uploads",
        "description": "Upload clear images of the wound and any relevant documents.",
        "questions": [
          {
            "key": "wound_photo",
            "label": "Wound photo",
            "type": "image",
            "required": true,
            "category": "wound_photo"
          },
          {
            "key": "insurance_card",
            "label": "Insurance card",
            "type": "file",
            "required": false,
            "category": "insurance_card"
          },
          {
            "key": "extra_attachment",
            "label": "Additional attachment",
            "type": "file",
            "required": false,
            "category": "intake_attachment"
          }
        ]
      },
      {
        "key": "consent",
        "title": "Consent",
        "description": "Confirm that the information you provided is accurate.",
        "questions": [
          { "key": "consent_ack", "label": "I confirm my intake details are accurate.", "type": "boolean", "required": true },
          { "key": "consent_signature", "label": "Type your full name", "type": "text", "required": true }
        ]
      }
    ]
  }$$::jsonb
)
on conflict (slug) do update
set
  name = excluded.name,
  description = excluded.description,
  version = excluded.version,
  is_active = excluded.is_active,
  definition_json = excluded.definition_json,
  updated_at = now();
