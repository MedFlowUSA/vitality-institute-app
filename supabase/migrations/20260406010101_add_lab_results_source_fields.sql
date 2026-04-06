alter table public.lab_results
  add column if not exists lab_source text,
  add column if not exists lab_source_other text;

comment on column public.lab_results.lab_source is 'Reported lab source for patient-submitted lab results.';
comment on column public.lab_results.lab_source_other is 'Free-text lab source name when Other local lab is selected.';
