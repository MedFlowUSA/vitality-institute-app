create or replace function public.user_has_protocol_assessment_access_role(uid uuid)
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
      and p.role in ('super_admin', 'location_admin', 'provider', 'clinical_staff')
  );
$$;

create or replace function public.user_can_read_protocol_assessment(uid uuid, target_assessment_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.ai_protocol_assessments assessment
    where assessment.id = target_assessment_id
      and public.user_has_protocol_assessment_access_role(uid)
      and public.user_can_access_clinic(uid, assessment.clinic_id)
      and public.user_has_location_access(uid, assessment.location_id)
  );
$$;

create or replace function public.user_can_create_protocol_assessment(uid uuid, target_session_id uuid)
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
      and session_row.status = 'submitted'
      and (
        session_row.profile_id = uid
        or patient.profile_id = uid
      )
  );
$$;

create or replace function public.user_can_update_protocol_assessment_workflow(uid uuid, target_assessment_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.ai_protocol_assessments assessment
    where assessment.id = target_assessment_id
      and public.user_has_protocol_review_role(uid)
      and public.user_can_access_clinic(uid, assessment.clinic_id)
      and public.user_has_location_access(uid, assessment.location_id)
  );
$$;

create or replace function public.apply_ai_protocol_assessment_defaults()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  source_session record;
begin
  select
    session_row.clinic_id,
    session_row.location_id,
    session_row.patient_id
  into source_session
  from public.vital_ai_sessions session_row
  where session_row.id = new.vital_ai_session_id
  limit 1;

  if source_session.clinic_id is null then
    raise exception 'Vital AI session % is not available for protocol assessment generation.', new.vital_ai_session_id;
  end if;

  new.clinic_id := source_session.clinic_id;
  new.location_id := source_session.location_id;
  new.patient_id := coalesce(new.patient_id, source_session.patient_id);
  new.status := coalesce(new.status, 'generated');
  new.provider_review_required := true;

  return new;
end;
$$;

create or replace function public.guard_ai_protocol_assessment_immutable_fields()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.vital_ai_session_id is distinct from old.vital_ai_session_id
    or new.vital_ai_profile_id is distinct from old.vital_ai_profile_id
    or new.patient_id is distinct from old.patient_id
    or new.intake_submission_id is distinct from old.intake_submission_id
    or new.clinic_id is distinct from old.clinic_id
    or new.location_id is distinct from old.location_id
    or new.service_line is distinct from old.service_line
    or new.recommendation_type is distinct from old.recommendation_type
    or new.raw_output_json is distinct from old.raw_output_json
    or new.structured_output_json is distinct from old.structured_output_json
    or new.model_key is distinct from old.model_key
    or new.model_version is distinct from old.model_version
    or new.provider_review_required is distinct from old.provider_review_required
    or new.created_at is distinct from old.created_at then
    raise exception 'AI protocol assessment content is immutable after generation.';
  end if;

  return new;
end;
$$;

drop trigger if exists ai_protocol_assessments_apply_defaults on public.ai_protocol_assessments;
create trigger ai_protocol_assessments_apply_defaults
before insert on public.ai_protocol_assessments
for each row
execute function public.apply_ai_protocol_assessment_defaults();

drop trigger if exists ai_protocol_assessments_guard_immutable_fields on public.ai_protocol_assessments;
create trigger ai_protocol_assessments_guard_immutable_fields
before update on public.ai_protocol_assessments
for each row
execute function public.guard_ai_protocol_assessment_immutable_fields();

drop policy if exists ai_protocol_assessments_select_policy on public.ai_protocol_assessments;
create policy ai_protocol_assessments_select_policy
on public.ai_protocol_assessments
for select
to authenticated
using (public.user_can_read_protocol_assessment(auth.uid(), id));

drop policy if exists ai_protocol_assessments_insert_policy on public.ai_protocol_assessments;
create policy ai_protocol_assessments_insert_policy
on public.ai_protocol_assessments
for insert
to authenticated
with check (
  public.user_can_create_protocol_assessment(auth.uid(), vital_ai_session_id)
  and status = 'generated'
  and provider_review_required = true
);

drop policy if exists ai_protocol_assessments_update_policy on public.ai_protocol_assessments;
create policy ai_protocol_assessments_update_policy
on public.ai_protocol_assessments
for update
to authenticated
using (public.user_can_update_protocol_assessment_workflow(auth.uid(), id))
with check (
  public.user_can_update_protocol_assessment_workflow(auth.uid(), id)
  and status in ('generated', 'reviewed', 'archived', 'error')
);
