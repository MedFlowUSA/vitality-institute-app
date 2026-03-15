alter table public.patient_visits
  add column if not exists next_action_type text,
  add column if not exists next_action_due_at timestamptz,
  add column if not exists next_action_notes text,
  add column if not exists follow_up_required boolean not null default false,
  add column if not exists follow_up_mode text not null default 'none',
  add column if not exists requires_labs_before_followup boolean not null default false;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'patient_visits_next_action_type_check'
  ) then
    alter table public.patient_visits
      add constraint patient_visits_next_action_type_check
      check (
        next_action_type is null
        or next_action_type in (
          'none',
          'follow_up_needed',
          'virtual_follow_up',
          'in_person_follow_up',
          'labs_before_followup',
          'staff_outreach',
          'pending_review'
        )
      );
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'patient_visits_follow_up_mode_check'
  ) then
    alter table public.patient_visits
      add constraint patient_visits_follow_up_mode_check
      check (follow_up_mode in ('none', 'virtual', 'in_person'));
  end if;
end $$;

update public.patient_visits
set
  next_action_type = coalesce(next_action_type, 'none'),
  follow_up_mode = coalesce(follow_up_mode, 'none'),
  follow_up_required = coalesce(follow_up_required, false),
  requires_labs_before_followup = coalesce(requires_labs_before_followup, false)
where
  next_action_type is null
  or follow_up_mode is null
  or follow_up_required is null
  or requires_labs_before_followup is null;
