alter table if exists public.appointments
  add column if not exists visit_type text,
  add column if not exists telehealth_enabled boolean not null default false,
  add column if not exists meeting_url text,
  add column if not exists meeting_provider text not null default 'external_link',
  add column if not exists meeting_status text not null default 'not_started',
  add column if not exists join_window_opens_at timestamptz,
  add column if not exists virtual_instructions text;

update public.appointments
set visit_type = 'in_person'
where visit_type is null
   or visit_type not in ('in_person', 'virtual');

update public.appointments
set telehealth_enabled = (visit_type = 'virtual')
where telehealth_enabled is distinct from (visit_type = 'virtual');

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'appointments_visit_type_check'
  ) then
    alter table public.appointments
      add constraint appointments_visit_type_check
      check (visit_type in ('in_person', 'virtual'));
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'appointments_meeting_status_check'
  ) then
    alter table public.appointments
      add constraint appointments_meeting_status_check
      check (meeting_status in ('not_started', 'ready', 'in_progress', 'completed', 'missed'));
  end if;
end $$;

comment on column public.appointments.visit_type is 'Phase 1 visit mode: in_person or virtual.';
comment on column public.appointments.telehealth_enabled is 'True when the appointment is configured as a virtual visit.';
comment on column public.appointments.meeting_url is 'External meeting link for a virtual appointment.';
comment on column public.appointments.meeting_provider is 'Meeting link provider for Phase 1 virtual visits.';
comment on column public.appointments.meeting_status is 'Provider/staff controlled virtual visit state.';
comment on column public.appointments.join_window_opens_at is 'When the join button becomes active for the patient and provider.';
comment on column public.appointments.virtual_instructions is 'Patient-facing instructions for the scheduled virtual visit.';
