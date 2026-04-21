create or replace function public.user_has_protocol_review_role(uid uuid)
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
      and p.role in ('provider', 'super_admin')
  );
$$;

create or replace function public.user_can_access_protocol_assessment(uid uuid, target_assessment_id uuid)
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
      and assessment.provider_review_required = true
      and public.user_has_protocol_review_role(uid)
      and public.user_can_access_vital_ai_session(uid, assessment.vital_ai_session_id)
  );
$$;

create or replace function public.apply_provider_protocol_review_defaults()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  assessment_clinic_id uuid;
begin
  select assessment.clinic_id
  into assessment_clinic_id
  from public.ai_protocol_assessments assessment
  where assessment.id = new.ai_protocol_assessment_id
  limit 1;

  if assessment_clinic_id is null then
    raise exception 'Protocol assessment % not found for provider review.', new.ai_protocol_assessment_id;
  end if;

  new.clinic_id := assessment_clinic_id;

  if new.signed_at is null then
    new.signed_at := now();
  end if;

  return new;
end;
$$;

drop trigger if exists provider_protocol_reviews_apply_defaults on public.provider_protocol_reviews;
create trigger provider_protocol_reviews_apply_defaults
before insert or update on public.provider_protocol_reviews
for each row
execute function public.apply_provider_protocol_review_defaults();

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'provider_protocol_reviews_signed_at_required'
  ) then
    alter table public.provider_protocol_reviews
      add constraint provider_protocol_reviews_signed_at_required
      check (signed_at is not null);
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'provider_protocol_reviews_final_protocol_object'
  ) then
    alter table public.provider_protocol_reviews
      add constraint provider_protocol_reviews_final_protocol_object
      check (jsonb_typeof(final_protocol_json) = 'object');
  end if;
end $$;

drop policy if exists provider_protocol_reviews_select_policy on public.provider_protocol_reviews;
create policy provider_protocol_reviews_select_policy
on public.provider_protocol_reviews
for select
to authenticated
using (
  public.user_can_access_protocol_assessment(auth.uid(), ai_protocol_assessment_id)
);

drop policy if exists provider_protocol_reviews_insert_policy on public.provider_protocol_reviews;
create policy provider_protocol_reviews_insert_policy
on public.provider_protocol_reviews
for insert
to authenticated
with check (
  provider_id = auth.uid()
  and public.user_can_access_protocol_assessment(auth.uid(), ai_protocol_assessment_id)
);

drop policy if exists provider_protocol_reviews_update_policy on public.provider_protocol_reviews;
create policy provider_protocol_reviews_update_policy
on public.provider_protocol_reviews
for update
to authenticated
using (
  public.user_can_access_protocol_assessment(auth.uid(), ai_protocol_assessment_id)
  and (provider_id = auth.uid() or public.user_is_super_admin(auth.uid()))
)
with check (
  public.user_can_access_protocol_assessment(auth.uid(), ai_protocol_assessment_id)
  and (provider_id = auth.uid() or public.user_is_super_admin(auth.uid()))
);
