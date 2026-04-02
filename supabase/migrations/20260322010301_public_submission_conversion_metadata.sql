alter table public.public_vital_ai_submissions
  add column if not exists lead_type text,
  add column if not exists urgency_level text,
  add column if not exists value_level text;

alter table public.public_vital_ai_submissions
  drop constraint if exists public_vital_ai_submissions_urgency_level_check;

alter table public.public_vital_ai_submissions
  add constraint public_vital_ai_submissions_urgency_level_check
  check (urgency_level is null or urgency_level in ('low', 'medium', 'high'));

alter table public.public_vital_ai_submissions
  drop constraint if exists public_vital_ai_submissions_value_level_check;

alter table public.public_vital_ai_submissions
  add constraint public_vital_ai_submissions_value_level_check
  check (value_level is null or value_level in ('low', 'medium', 'high'));

create index if not exists idx_public_vital_ai_submissions_conversion_priority
  on public.public_vital_ai_submissions (urgency_level, value_level, created_at desc);
