alter table if exists public.lab_results
  add column if not exists clinic_id uuid references public.clinics(id) on delete set null;

create index if not exists lab_results_clinic_id_idx on public.lab_results(clinic_id);
create index if not exists lab_results_location_id_idx on public.lab_results(location_id);
create index if not exists lab_results_patient_id_idx on public.lab_results(patient_id);

update public.lab_results lab_result
set location_id = coalesce(lab_result.location_id, appointment.location_id)
from public.appointments appointment
where lab_result.appointment_id = appointment.id
  and lab_result.location_id is null;

update public.lab_results lab_result
set clinic_id = coalesce(
  public.resolve_clinic_id_from_location(lab_result.location_id),
  patient.clinic_id
)
from public.patients patient
where patient.id = lab_result.patient_id
  and lab_result.clinic_id is null;

create or replace function public.apply_lab_result_scope_defaults()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  appointment_location_id uuid;
  patient_location_id uuid;
  patient_clinic_id uuid;
begin
  if new.appointment_id is not null then
    select appointment.location_id
    into appointment_location_id
    from public.appointments appointment
    where appointment.id = new.appointment_id
    limit 1;
  end if;

  if new.patient_id is not null then
    select patient.location_id, patient.clinic_id
    into patient_location_id, patient_clinic_id
    from public.patients patient
    where patient.id = new.patient_id
    limit 1;
  end if;

  if new.location_id is null then
    new.location_id := coalesce(appointment_location_id, patient_location_id);
  end if;

  if new.location_id is not null then
    new.clinic_id := public.resolve_clinic_id_from_location(new.location_id);
  end if;

  if new.clinic_id is null then
    new.clinic_id := coalesce(patient_clinic_id, public.resolve_profile_active_clinic_id(auth.uid()));
  end if;

  return new;
end;
$$;

drop trigger if exists lab_results_apply_scope_defaults on public.lab_results;
create trigger lab_results_apply_scope_defaults
before insert or update on public.lab_results
for each row
execute function public.apply_lab_result_scope_defaults();

alter table public.lab_results enable row level security;

drop policy if exists lab_results_select_policy on public.lab_results;
create policy lab_results_select_policy
on public.lab_results
for select
to authenticated
using (
  exists (
    select 1
    from public.patients patient
    where patient.id = lab_results.patient_id
      and patient.profile_id = auth.uid()
  )
  or (
    public.clinic_scope_is_staff(auth.uid())
    and (lab_results.clinic_id is null or public.user_can_access_clinic(auth.uid(), lab_results.clinic_id))
    and public.user_has_location_access(auth.uid(), lab_results.location_id)
  )
);

drop policy if exists lab_results_insert_policy on public.lab_results;
create policy lab_results_insert_policy
on public.lab_results
for insert
to authenticated
with check (
  exists (
    select 1
    from public.patients patient
    where patient.id = lab_results.patient_id
      and patient.profile_id = auth.uid()
      and (
        lab_results.appointment_id is null
        or exists (
          select 1
          from public.appointments appointment
          where appointment.id = lab_results.appointment_id
            and appointment.patient_id = patient.id
            and (lab_results.location_id is null or appointment.location_id = lab_results.location_id)
        )
      )
      and (
        lab_results.location_id is null
        or exists (
          select 1
          from public.clinic_locations clinic_location
          where clinic_location.location_id = lab_results.location_id
            and clinic_location.clinic_id = coalesce(
              lab_results.clinic_id,
              patient.clinic_id,
              public.resolve_profile_active_clinic_id(auth.uid()),
              public.resolve_clinic_id_from_location(lab_results.location_id)
            )
        )
      )
  )
  or (
    public.clinic_scope_is_staff(auth.uid())
    and (lab_results.clinic_id is null or public.user_can_access_clinic(auth.uid(), lab_results.clinic_id))
    and public.user_has_location_access(auth.uid(), lab_results.location_id)
  )
);

drop policy if exists lab_results_update_policy on public.lab_results;
create policy lab_results_update_policy
on public.lab_results
for update
to authenticated
using (
  public.clinic_scope_is_staff(auth.uid())
  and (lab_results.clinic_id is null or public.user_can_access_clinic(auth.uid(), lab_results.clinic_id))
  and public.user_has_location_access(auth.uid(), lab_results.location_id)
)
with check (
  public.clinic_scope_is_staff(auth.uid())
  and (lab_results.clinic_id is null or public.user_can_access_clinic(auth.uid(), lab_results.clinic_id))
  and public.user_has_location_access(auth.uid(), lab_results.location_id)
);
