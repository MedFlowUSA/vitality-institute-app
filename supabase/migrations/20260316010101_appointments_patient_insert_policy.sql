alter table public.appointments enable row level security;

drop policy if exists "appointments patient self insert" on public.appointments;

create policy "appointments patient self insert"
  on public.appointments
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.patients p
      where p.id = appointments.patient_id
        and p.profile_id = auth.uid()
    )
  );
