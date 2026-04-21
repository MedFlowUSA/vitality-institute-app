create or replace function public.clinic_scope_is_staff(uid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = uid
      and p.role in ('super_admin', 'location_admin', 'provider', 'clinical_staff', 'billing', 'front_desk')
  );
$$;

create or replace function public.resolve_clinic_id_from_location(target_location_id uuid)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select cl.clinic_id
  from public.clinic_locations cl
  where cl.location_id = target_location_id
  order by cl.is_primary desc, cl.created_at asc
  limit 1;
$$;

create or replace function public.resolve_profile_active_clinic_id(target_user_id uuid)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select p.active_clinic_id
  from public.profiles p
  where p.id = target_user_id
  limit 1;
$$;

create or replace function public.user_has_location_access(uid uuid, target_location_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    target_location_id is null
    or public.user_is_super_admin(uid)
    or exists (
      select 1
      from public.user_locations ul
      where ul.user_id = uid
        and ul.location_id = target_location_id
    )
    or exists (
      select 1
      from public.profiles p
      where p.id = uid
        and p.active_location_id = target_location_id
    )
    or exists (
      select 1
      from public.patients patient_owner
      where patient_owner.profile_id = uid
        and patient_owner.location_id = target_location_id
    );
$$;

create or replace function public.user_can_access_clinic(uid uuid, target_clinic_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    public.user_is_super_admin(uid)
    or exists (
      select 1
      from public.clinic_users cu
      where cu.user_id = uid
        and cu.clinic_id = target_clinic_id
        and cu.is_active = true
    )
    or exists (
      select 1
      from public.profiles p
      where p.id = uid
        and p.active_clinic_id = target_clinic_id
    );
$$;

alter table if exists public.patients
  add column if not exists clinic_id uuid references public.clinics(id) on delete set null;

alter table if exists public.patient_visits
  add column if not exists clinic_id uuid references public.clinics(id) on delete set null;

alter table if exists public.intake_submissions
  add column if not exists clinic_id uuid references public.clinics(id) on delete set null;

alter table if exists public.intake_submissions
  add column if not exists location_id uuid references public.locations(id) on delete set null;

alter table if exists public.vital_ai_sessions
  add column if not exists clinic_id uuid references public.clinics(id) on delete set null;

alter table if exists public.vital_ai_sessions
  add column if not exists location_id uuid references public.locations(id) on delete set null;

alter table if exists public.vital_ai_responses
  add column if not exists clinic_id uuid references public.clinics(id) on delete set null;

alter table if exists public.vital_ai_responses
  add column if not exists location_id uuid references public.locations(id) on delete set null;

alter table if exists public.vital_ai_files
  add column if not exists clinic_id uuid references public.clinics(id) on delete set null;

alter table if exists public.vital_ai_files
  add column if not exists location_id uuid references public.locations(id) on delete set null;

alter table if exists public.vital_ai_profiles
  add column if not exists clinic_id uuid references public.clinics(id) on delete set null;

alter table if exists public.vital_ai_profiles
  add column if not exists location_id uuid references public.locations(id) on delete set null;

alter table if exists public.vital_ai_leads
  add column if not exists clinic_id uuid references public.clinics(id) on delete set null;

alter table if exists public.vital_ai_leads
  add column if not exists location_id uuid references public.locations(id) on delete set null;

alter table if exists public.vital_ai_review_tasks
  add column if not exists clinic_id uuid references public.clinics(id) on delete set null;

alter table if exists public.vital_ai_review_tasks
  add column if not exists location_id uuid references public.locations(id) on delete set null;

alter table if exists public.public_vital_ai_submissions
  add column if not exists clinic_id uuid references public.clinics(id) on delete set null;

do $$
begin
  if exists (
    select 1
    from information_schema.tables
    where table_schema = 'public'
      and table_name = 'intake_answers'
  ) then
    execute 'alter table public.intake_answers add column if not exists clinic_id uuid references public.clinics(id) on delete set null';
    execute 'alter table public.intake_answers add column if not exists location_id uuid references public.locations(id) on delete set null';
  end if;

  if exists (
    select 1
    from information_schema.tables
    where table_schema = 'public'
      and table_name = 'intake_uploads'
  ) then
    execute 'alter table public.intake_uploads add column if not exists clinic_id uuid references public.clinics(id) on delete set null';
    execute 'alter table public.intake_uploads add column if not exists location_id uuid references public.locations(id) on delete set null';
  end if;

  if exists (
    select 1
    from information_schema.tables
    where table_schema = 'public'
      and table_name = 'uploads'
  ) then
    execute 'alter table public.uploads add column if not exists clinic_id uuid references public.clinics(id) on delete set null';
    execute 'alter table public.uploads add column if not exists location_id uuid references public.locations(id) on delete set null';
  end if;
end $$;

create index if not exists idx_patients_clinic on public.patients (clinic_id);
create index if not exists idx_patient_visits_clinic_location on public.patient_visits (clinic_id, location_id, created_at desc);
create index if not exists idx_intake_submissions_clinic_location on public.intake_submissions (clinic_id, location_id, created_at desc);
create index if not exists idx_vital_ai_sessions_clinic_location on public.vital_ai_sessions (clinic_id, location_id, updated_at desc);
create index if not exists idx_vital_ai_responses_clinic_location on public.vital_ai_responses (clinic_id, location_id, updated_at desc);
create index if not exists idx_vital_ai_files_clinic_location on public.vital_ai_files (clinic_id, location_id, created_at desc);
create index if not exists idx_vital_ai_profiles_clinic_location on public.vital_ai_profiles (clinic_id, location_id, created_at desc);
create index if not exists idx_vital_ai_leads_clinic_location on public.vital_ai_leads (clinic_id, location_id, created_at desc);
create index if not exists idx_vital_ai_review_tasks_clinic_location on public.vital_ai_review_tasks (clinic_id, location_id, created_at desc);
create index if not exists idx_public_vital_ai_submissions_clinic_location on public.public_vital_ai_submissions (clinic_id, preferred_location_id, created_at desc);

update public.profiles p
set
  active_location_id = coalesce(p.active_location_id, patient_scope.location_id),
  active_clinic_id = coalesce(p.active_clinic_id, public.resolve_clinic_id_from_location(patient_scope.location_id))
from (
  select distinct on (patient.profile_id)
    patient.profile_id,
    patient.location_id
  from public.patients patient
  where patient.profile_id is not null
    and patient.location_id is not null
  order by patient.profile_id, patient.id
) as patient_scope
where p.id = patient_scope.profile_id
  and (
    p.active_location_id is null
    or p.active_clinic_id is null
  );

update public.patients patient
set clinic_id = coalesce(
  patient.clinic_id,
  public.resolve_clinic_id_from_location(patient.location_id),
  public.resolve_profile_active_clinic_id(patient.profile_id)
)
where patient.clinic_id is null;

update public.intake_submissions intake
set clinic_id = coalesce(
  intake.clinic_id,
  public.resolve_clinic_id_from_location(intake.location_id),
  patient.clinic_id
)
from public.patients patient
where patient.id = intake.patient_id
  and intake.clinic_id is null;

update public.patient_visits visit_row
set clinic_id = coalesce(
  visit_row.clinic_id,
  public.resolve_clinic_id_from_location(visit_row.location_id),
  patient.clinic_id
)
from public.patients patient
where patient.id = visit_row.patient_id
  and visit_row.clinic_id is null;

update public.vital_ai_sessions session_row
set
  location_id = coalesce(session_row.location_id, patient.location_id),
  clinic_id = coalesce(
    session_row.clinic_id,
    public.resolve_clinic_id_from_location(coalesce(session_row.location_id, patient.location_id)),
    patient.clinic_id,
    public.resolve_profile_active_clinic_id(session_row.profile_id)
  )
from public.patients patient
where patient.id = session_row.patient_id
  and (
    session_row.location_id is null
    or session_row.clinic_id is null
  );

update public.vital_ai_sessions session_row
set clinic_id = coalesce(
  session_row.clinic_id,
  public.resolve_clinic_id_from_location(session_row.location_id),
  public.resolve_profile_active_clinic_id(session_row.profile_id)
)
where session_row.clinic_id is null;

update public.vital_ai_responses response_row
set
  clinic_id = coalesce(response_row.clinic_id, session_row.clinic_id),
  location_id = coalesce(response_row.location_id, session_row.location_id)
from public.vital_ai_sessions session_row
where session_row.id = response_row.session_id
  and (
    response_row.clinic_id is null
    or response_row.location_id is null
  );

update public.vital_ai_files file_row
set
  clinic_id = coalesce(file_row.clinic_id, session_row.clinic_id),
  location_id = coalesce(file_row.location_id, session_row.location_id)
from public.vital_ai_sessions session_row
where session_row.id = file_row.session_id
  and (
    file_row.clinic_id is null
    or file_row.location_id is null
  );

update public.vital_ai_profiles profile_row
set
  clinic_id = coalesce(profile_row.clinic_id, session_row.clinic_id),
  location_id = coalesce(profile_row.location_id, session_row.location_id)
from public.vital_ai_sessions session_row
where session_row.id = profile_row.session_id
  and (
    profile_row.clinic_id is null
    or profile_row.location_id is null
  );

update public.vital_ai_leads lead_row
set
  clinic_id = coalesce(lead_row.clinic_id, session_row.clinic_id),
  location_id = coalesce(lead_row.location_id, session_row.location_id)
from public.vital_ai_sessions session_row
where session_row.id = lead_row.session_id
  and (
    lead_row.clinic_id is null
    or lead_row.location_id is null
  );

update public.vital_ai_review_tasks task_row
set
  clinic_id = coalesce(task_row.clinic_id, session_row.clinic_id),
  location_id = coalesce(task_row.location_id, session_row.location_id)
from public.vital_ai_sessions session_row
where session_row.id = task_row.session_id
  and (
    task_row.clinic_id is null
    or task_row.location_id is null
  );

update public.public_vital_ai_submissions submission_row
set clinic_id = coalesce(
  submission_row.clinic_id,
  public.resolve_clinic_id_from_location(submission_row.preferred_location_id)
)
where submission_row.clinic_id is null;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'intake_answers'
      and column_name = 'submission_id'
  ) then
    execute $sql$
      update public.intake_answers answer_row
      set
        clinic_id = coalesce(answer_row.clinic_id, intake.clinic_id),
        location_id = coalesce(answer_row.location_id, intake.location_id)
      from public.intake_submissions intake
      where intake.id = answer_row.submission_id
        and (answer_row.clinic_id is null or answer_row.location_id is null)
    $sql$;
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'intake_answers'
      and column_name = 'intake_submission_id'
  ) then
    execute $sql$
      update public.intake_answers answer_row
      set
        clinic_id = coalesce(answer_row.clinic_id, intake.clinic_id),
        location_id = coalesce(answer_row.location_id, intake.location_id)
      from public.intake_submissions intake
      where intake.id = answer_row.intake_submission_id
        and (answer_row.clinic_id is null or answer_row.location_id is null)
    $sql$;
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'intake_uploads'
      and column_name = 'submission_id'
  ) then
    execute $sql$
      update public.intake_uploads upload_row
      set
        clinic_id = coalesce(upload_row.clinic_id, intake.clinic_id),
        location_id = coalesce(upload_row.location_id, intake.location_id)
      from public.intake_submissions intake
      where intake.id = upload_row.submission_id
        and (upload_row.clinic_id is null or upload_row.location_id is null)
    $sql$;
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'intake_uploads'
      and column_name = 'intake_submission_id'
  ) then
    execute $sql$
      update public.intake_uploads upload_row
      set
        clinic_id = coalesce(upload_row.clinic_id, intake.clinic_id),
        location_id = coalesce(upload_row.location_id, intake.location_id)
      from public.intake_submissions intake
      where intake.id = upload_row.intake_submission_id
        and (upload_row.clinic_id is null or upload_row.location_id is null)
    $sql$;
  end if;
end $$;

create or replace function public.apply_vital_ai_session_scope_defaults()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  patient_location_id uuid;
  patient_clinic_id uuid;
begin
  if new.patient_id is not null then
    select patient.location_id, patient.clinic_id
    into patient_location_id, patient_clinic_id
    from public.patients patient
    where patient.id = new.patient_id
    limit 1;
  end if;

  if new.location_id is null then
    new.location_id := patient_location_id;
  end if;

  if new.clinic_id is null and new.location_id is not null then
    new.clinic_id := public.resolve_clinic_id_from_location(new.location_id);
  end if;

  if new.clinic_id is null then
    new.clinic_id := coalesce(patient_clinic_id, public.resolve_profile_active_clinic_id(new.profile_id));
  end if;

  return new;
end;
$$;

create or replace function public.apply_vital_ai_related_scope_defaults()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  source_session record;
begin
  select session_row.clinic_id, session_row.location_id
  into source_session
  from public.vital_ai_sessions session_row
  where session_row.id = new.session_id
  limit 1;

  if new.clinic_id is null then
    new.clinic_id := source_session.clinic_id;
  end if;

  if new.location_id is null then
    new.location_id := source_session.location_id;
  end if;

  return new;
end;
$$;

create or replace function public.apply_patient_visit_scope_defaults()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  patient_clinic_id uuid;
begin
  if new.clinic_id is null and new.location_id is not null then
    new.clinic_id := public.resolve_clinic_id_from_location(new.location_id);
  end if;

  if new.clinic_id is null and new.patient_id is not null then
    select patient.clinic_id
    into patient_clinic_id
    from public.patients patient
    where patient.id = new.patient_id
    limit 1;

    new.clinic_id := patient_clinic_id;
  end if;

  return new;
end;
$$;

create or replace function public.apply_intake_submission_scope_defaults()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  patient_clinic_id uuid;
begin
  if new.clinic_id is null and new.location_id is not null then
    new.clinic_id := public.resolve_clinic_id_from_location(new.location_id);
  end if;

  if new.clinic_id is null and new.patient_id is not null then
    select patient.clinic_id
    into patient_clinic_id
    from public.patients patient
    where patient.id = new.patient_id
    limit 1;

    new.clinic_id := patient_clinic_id;
  end if;

  return new;
end;
$$;

create or replace function public.apply_public_vital_ai_submission_scope_defaults()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.clinic_id is null and new.preferred_location_id is not null then
    new.clinic_id := public.resolve_clinic_id_from_location(new.preferred_location_id);
  end if;

  return new;
end;
$$;

drop trigger if exists vital_ai_sessions_apply_scope_defaults on public.vital_ai_sessions;
create trigger vital_ai_sessions_apply_scope_defaults
before insert or update on public.vital_ai_sessions
for each row
execute function public.apply_vital_ai_session_scope_defaults();

drop trigger if exists vital_ai_responses_apply_scope_defaults on public.vital_ai_responses;
create trigger vital_ai_responses_apply_scope_defaults
before insert or update on public.vital_ai_responses
for each row
execute function public.apply_vital_ai_related_scope_defaults();

drop trigger if exists vital_ai_files_apply_scope_defaults on public.vital_ai_files;
create trigger vital_ai_files_apply_scope_defaults
before insert or update on public.vital_ai_files
for each row
execute function public.apply_vital_ai_related_scope_defaults();

drop trigger if exists vital_ai_profiles_apply_scope_defaults on public.vital_ai_profiles;
create trigger vital_ai_profiles_apply_scope_defaults
before insert or update on public.vital_ai_profiles
for each row
execute function public.apply_vital_ai_related_scope_defaults();

drop trigger if exists vital_ai_leads_apply_scope_defaults on public.vital_ai_leads;
create trigger vital_ai_leads_apply_scope_defaults
before insert or update on public.vital_ai_leads
for each row
execute function public.apply_vital_ai_related_scope_defaults();

drop trigger if exists vital_ai_review_tasks_apply_scope_defaults on public.vital_ai_review_tasks;
create trigger vital_ai_review_tasks_apply_scope_defaults
before insert or update on public.vital_ai_review_tasks
for each row
execute function public.apply_vital_ai_related_scope_defaults();

drop trigger if exists patient_visits_apply_scope_defaults on public.patient_visits;
create trigger patient_visits_apply_scope_defaults
before insert or update on public.patient_visits
for each row
execute function public.apply_patient_visit_scope_defaults();

drop trigger if exists intake_submissions_apply_scope_defaults on public.intake_submissions;
create trigger intake_submissions_apply_scope_defaults
before insert or update on public.intake_submissions
for each row
execute function public.apply_intake_submission_scope_defaults();

drop trigger if exists public_vital_ai_submissions_apply_scope_defaults on public.public_vital_ai_submissions;
create trigger public_vital_ai_submissions_apply_scope_defaults
before insert or update on public.public_vital_ai_submissions
for each row
execute function public.apply_public_vital_ai_submission_scope_defaults();

create or replace function public.user_can_access_vital_ai_session(uid uuid, target_session_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.vital_ai_sessions session_row
    left join public.patients patient on patient.id = session_row.patient_id
    where session_row.id = target_session_id
      and (
        session_row.profile_id = uid
        or patient.profile_id = uid
        or (
          public.clinic_scope_is_staff(uid)
          and (session_row.clinic_id is null or public.user_can_access_clinic(uid, session_row.clinic_id))
          and public.user_has_location_access(uid, session_row.location_id)
        )
      )
  );
$$;

alter table public.vital_ai_sessions enable row level security;
alter table public.vital_ai_responses enable row level security;
alter table public.vital_ai_files enable row level security;
alter table public.vital_ai_profiles enable row level security;
alter table public.vital_ai_leads enable row level security;
alter table public.vital_ai_review_tasks enable row level security;
alter table public.public_vital_ai_submissions enable row level security;

drop policy if exists vital_ai_sessions_select_policy on public.vital_ai_sessions;
create policy vital_ai_sessions_select_policy
on public.vital_ai_sessions
for select
to authenticated
using (public.user_can_access_vital_ai_session(auth.uid(), id));

drop policy if exists vital_ai_sessions_insert_policy on public.vital_ai_sessions;
create policy vital_ai_sessions_insert_policy
on public.vital_ai_sessions
for insert
to authenticated
with check (
  profile_id = auth.uid()
  or (
    public.clinic_scope_is_staff(auth.uid())
    and (clinic_id is null or public.user_can_access_clinic(auth.uid(), clinic_id))
    and public.user_has_location_access(auth.uid(), location_id)
  )
);

drop policy if exists vital_ai_sessions_update_policy on public.vital_ai_sessions;
create policy vital_ai_sessions_update_policy
on public.vital_ai_sessions
for update
to authenticated
using (public.user_can_access_vital_ai_session(auth.uid(), id))
with check (public.user_can_access_vital_ai_session(auth.uid(), id));

drop policy if exists vital_ai_responses_select_policy on public.vital_ai_responses;
create policy vital_ai_responses_select_policy
on public.vital_ai_responses
for select
to authenticated
using (public.user_can_access_vital_ai_session(auth.uid(), session_id));

drop policy if exists vital_ai_responses_insert_policy on public.vital_ai_responses;
create policy vital_ai_responses_insert_policy
on public.vital_ai_responses
for insert
to authenticated
with check (public.user_can_access_vital_ai_session(auth.uid(), session_id));

drop policy if exists vital_ai_responses_update_policy on public.vital_ai_responses;
create policy vital_ai_responses_update_policy
on public.vital_ai_responses
for update
to authenticated
using (public.user_can_access_vital_ai_session(auth.uid(), session_id))
with check (public.user_can_access_vital_ai_session(auth.uid(), session_id));

drop policy if exists vital_ai_files_select_policy on public.vital_ai_files;
create policy vital_ai_files_select_policy
on public.vital_ai_files
for select
to authenticated
using (public.user_can_access_vital_ai_session(auth.uid(), session_id));

drop policy if exists vital_ai_files_insert_policy on public.vital_ai_files;
create policy vital_ai_files_insert_policy
on public.vital_ai_files
for insert
to authenticated
with check (public.user_can_access_vital_ai_session(auth.uid(), session_id));

drop policy if exists vital_ai_files_update_policy on public.vital_ai_files;
create policy vital_ai_files_update_policy
on public.vital_ai_files
for update
to authenticated
using (public.user_can_access_vital_ai_session(auth.uid(), session_id))
with check (public.user_can_access_vital_ai_session(auth.uid(), session_id));

drop policy if exists vital_ai_profiles_select_policy on public.vital_ai_profiles;
create policy vital_ai_profiles_select_policy
on public.vital_ai_profiles
for select
to authenticated
using (public.user_can_access_vital_ai_session(auth.uid(), session_id));

drop policy if exists vital_ai_profiles_insert_policy on public.vital_ai_profiles;
create policy vital_ai_profiles_insert_policy
on public.vital_ai_profiles
for insert
to authenticated
with check (public.user_can_access_vital_ai_session(auth.uid(), session_id));

drop policy if exists vital_ai_profiles_update_policy on public.vital_ai_profiles;
create policy vital_ai_profiles_update_policy
on public.vital_ai_profiles
for update
to authenticated
using (public.user_can_access_vital_ai_session(auth.uid(), session_id))
with check (public.user_can_access_vital_ai_session(auth.uid(), session_id));

drop policy if exists vital_ai_leads_select_policy on public.vital_ai_leads;
create policy vital_ai_leads_select_policy
on public.vital_ai_leads
for select
to authenticated
using (public.user_can_access_vital_ai_session(auth.uid(), session_id));

drop policy if exists vital_ai_leads_insert_policy on public.vital_ai_leads;
create policy vital_ai_leads_insert_policy
on public.vital_ai_leads
for insert
to authenticated
with check (public.user_can_access_vital_ai_session(auth.uid(), session_id));

drop policy if exists vital_ai_leads_update_policy on public.vital_ai_leads;
create policy vital_ai_leads_update_policy
on public.vital_ai_leads
for update
to authenticated
using (public.user_can_access_vital_ai_session(auth.uid(), session_id))
with check (public.user_can_access_vital_ai_session(auth.uid(), session_id));

drop policy if exists vital_ai_review_tasks_select_policy on public.vital_ai_review_tasks;
create policy vital_ai_review_tasks_select_policy
on public.vital_ai_review_tasks
for select
to authenticated
using (public.user_can_access_vital_ai_session(auth.uid(), session_id));

drop policy if exists vital_ai_review_tasks_insert_policy on public.vital_ai_review_tasks;
create policy vital_ai_review_tasks_insert_policy
on public.vital_ai_review_tasks
for insert
to authenticated
with check (public.user_can_access_vital_ai_session(auth.uid(), session_id));

drop policy if exists vital_ai_review_tasks_update_policy on public.vital_ai_review_tasks;
create policy vital_ai_review_tasks_update_policy
on public.vital_ai_review_tasks
for update
to authenticated
using (public.user_can_access_vital_ai_session(auth.uid(), session_id))
with check (public.user_can_access_vital_ai_session(auth.uid(), session_id));

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
    public.clinic_scope_is_staff(auth.uid())
    and (clinic_id is null or public.user_can_access_clinic(auth.uid(), clinic_id))
    and public.user_has_location_access(auth.uid(), preferred_location_id)
  );

drop policy if exists "public vital ai submissions staff update" on public.public_vital_ai_submissions;
create policy "public vital ai submissions staff update"
  on public.public_vital_ai_submissions
  for update
  to authenticated
  using (
    public.clinic_scope_is_staff(auth.uid())
    and (clinic_id is null or public.user_can_access_clinic(auth.uid(), clinic_id))
    and public.user_has_location_access(auth.uid(), preferred_location_id)
  )
  with check (
    public.clinic_scope_is_staff(auth.uid())
    and (clinic_id is null or public.user_can_access_clinic(auth.uid(), clinic_id))
    and public.user_has_location_access(auth.uid(), preferred_location_id)
  );
