alter table public.public_vital_ai_submissions
  add column if not exists booking_request_id uuid references public.booking_requests(id) on delete set null,
  add column if not exists service_id uuid references public.services(id) on delete set null,
  add column if not exists notes text;

create index if not exists idx_public_vital_ai_submissions_booking_request
  on public.public_vital_ai_submissions (booking_request_id);

create index if not exists idx_public_vital_ai_submissions_service
  on public.public_vital_ai_submissions (service_id, created_at desc);

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
