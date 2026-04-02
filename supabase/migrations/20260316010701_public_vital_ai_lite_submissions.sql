create table if not exists public.public_vital_ai_submissions (
  id uuid primary key default gen_random_uuid(),
  pathway text not null
    check (pathway in ('wound_care', 'glp1_weight_loss', 'general_consult')),
  status text not null default 'new'
    check (status in ('new', 'reviewed', 'contacted', 'scheduled', 'closed')),
  first_name text not null,
  last_name text not null,
  phone text,
  email text,
  preferred_contact_method text not null default 'email'
    check (preferred_contact_method in ('phone', 'email', 'either')),
  preferred_location_id uuid references public.locations(id) on delete set null,
  answers_json jsonb not null default '{}'::jsonb,
  summary text,
  source text not null default 'public_vital_ai_lite',
  internal_notes text,
  assigned_to uuid references public.profiles(id) on delete set null,
  contacted_at timestamptz,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_public_vital_ai_submissions_status_created
  on public.public_vital_ai_submissions (status, created_at desc);

create index if not exists idx_public_vital_ai_submissions_pathway_created
  on public.public_vital_ai_submissions (pathway, created_at desc);

create index if not exists idx_public_vital_ai_submissions_assigned_to
  on public.public_vital_ai_submissions (assigned_to, created_at desc);

alter table public.public_vital_ai_submissions enable row level security;

drop policy if exists "public vital ai submissions public insert" on public.public_vital_ai_submissions;
create policy "public vital ai submissions public insert"
  on public.public_vital_ai_submissions
  for insert
  to anon, authenticated
  with check (true);

drop policy if exists "public vital ai submissions staff read" on public.public_vital_ai_submissions;
create policy "public vital ai submissions staff read"
  on public.public_vital_ai_submissions
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and p.role in ('super_admin', 'location_admin', 'provider', 'clinical_staff', 'billing', 'front_desk')
    )
  );

drop policy if exists "public vital ai submissions staff update" on public.public_vital_ai_submissions;
create policy "public vital ai submissions staff update"
  on public.public_vital_ai_submissions
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and p.role in ('super_admin', 'location_admin', 'provider', 'clinical_staff', 'billing', 'front_desk')
    )
  )
  with check (
    exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and p.role in ('super_admin', 'location_admin', 'provider', 'clinical_staff', 'billing', 'front_desk')
    )
  );
