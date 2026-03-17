create table if not exists public.contact_inquiries (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text,
  email text,
  preferred_contact_method text not null default 'email'
    check (preferred_contact_method in ('phone', 'email', 'either')),
  reason_for_inquiry text not null,
  message text not null,
  status text not null default 'new'
    check (status in ('new', 'reviewed', 'contacted', 'closed')),
  source text not null default 'public_contact_form',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_contact_inquiries_status_created
  on public.contact_inquiries (status, created_at desc);

alter table public.contact_inquiries enable row level security;

drop policy if exists "contact inquiries public insert" on public.contact_inquiries;
create policy "contact inquiries public insert"
  on public.contact_inquiries
  for insert
  to anon, authenticated
  with check (true);

drop policy if exists "contact inquiries staff read" on public.contact_inquiries;
create policy "contact inquiries staff read"
  on public.contact_inquiries
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

drop policy if exists "contact inquiries staff update" on public.contact_inquiries;
create policy "contact inquiries staff update"
  on public.contact_inquiries
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
