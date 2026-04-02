create table if not exists public.analytics_events (
  id uuid primary key default gen_random_uuid(),
  event_name text not null,
  pathway text null,
  lead_type text null,
  urgency_level text null check (urgency_level in ('low', 'medium', 'high')),
  value_level text null check (value_level in ('low', 'medium', 'high')),
  primary_offer text null,
  secondary_offer text null,
  metadata_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_analytics_events_name_created
  on public.analytics_events (event_name, created_at desc);

create index if not exists idx_analytics_events_lead_created
  on public.analytics_events (lead_type, urgency_level, value_level, created_at desc);

alter table public.analytics_events enable row level security;

drop policy if exists "analytics events public insert" on public.analytics_events;
create policy "analytics events public insert"
  on public.analytics_events
  for insert
  to anon, authenticated
  with check (true);

drop policy if exists "analytics events staff read" on public.analytics_events;
create policy "analytics events staff read"
  on public.analytics_events
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and p.role in ('super_admin', 'location_admin', 'provider', 'clinical_staff', 'front_desk', 'billing')
    )
  );
