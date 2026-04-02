create table if not exists public.booking_requests (
  id uuid primary key default gen_random_uuid(),
  location_id uuid references public.locations(id) on delete set null,
  service_id uuid references public.services(id) on delete set null,
  requested_start timestamptz not null,
  notes text,
  source text not null default 'public_booking',
  status text not null default 'new'
    check (status in ('new', 'intake_started', 'account_created', 'reviewed', 'scheduled', 'closed')),
  patient_id uuid references public.patients(id) on delete set null,
  email text,
  phone text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_booking_requests_status_created
  on public.booking_requests (status, created_at desc);

create index if not exists idx_booking_requests_requested_start
  on public.booking_requests (requested_start desc);

create index if not exists idx_booking_requests_patient
  on public.booking_requests (patient_id, created_at desc);

alter table public.booking_requests enable row level security;

drop policy if exists "booking requests public insert" on public.booking_requests;
create policy "booking requests public insert"
  on public.booking_requests
  for insert
  to anon, authenticated
  with check (true);

drop policy if exists "booking requests staff read" on public.booking_requests;
create policy "booking requests staff read"
  on public.booking_requests
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

drop policy if exists "booking requests staff update" on public.booking_requests;
create policy "booking requests staff update"
  on public.booking_requests
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
