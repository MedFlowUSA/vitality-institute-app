create table if not exists public.clinics (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  status text not null default 'active' check (status in ('draft', 'active', 'inactive', 'archived')),
  brand_name text,
  support_email text,
  support_phone text,
  default_timezone text not null default 'America/Los_Angeles',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.clinic_locations (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  location_id uuid not null references public.locations(id) on delete cascade,
  is_primary boolean not null default false,
  created_at timestamptz not null default now(),
  unique (clinic_id, location_id)
);

create table if not exists public.clinic_users (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null,
  is_active boolean not null default true,
  invited_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (clinic_id, user_id)
);

create table if not exists public.clinic_settings (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null unique references public.clinics(id) on delete cascade,
  intake_enabled boolean not null default true,
  labs_enabled boolean not null default true,
  ai_protocol_enabled boolean not null default false,
  fulfillment_enabled boolean not null default false,
  telehealth_enabled boolean not null default true,
  default_programs_json jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.clinic_services (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  service_key text not null,
  is_enabled boolean not null default true,
  pricing_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (clinic_id, service_key)
);

create table if not exists public.clinic_audit_events (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  actor_user_id uuid references public.profiles(id) on delete set null,
  event_type text not null,
  payload_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.profiles
  add column if not exists active_clinic_id uuid references public.clinics(id) on delete set null;

alter table public.services
  add column if not exists service_key text;

create index if not exists clinic_locations_clinic_idx on public.clinic_locations (clinic_id);
create index if not exists clinic_locations_location_idx on public.clinic_locations (location_id);
create index if not exists clinic_users_clinic_idx on public.clinic_users (clinic_id);
create index if not exists clinic_users_user_idx on public.clinic_users (user_id);
create index if not exists clinic_services_clinic_idx on public.clinic_services (clinic_id);
create index if not exists clinic_audit_events_clinic_idx on public.clinic_audit_events (clinic_id, created_at desc);

create or replace function public.touch_clinic_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists clinics_touch_updated_at on public.clinics;
create trigger clinics_touch_updated_at
before update on public.clinics
for each row
execute function public.touch_clinic_updated_at();

drop trigger if exists clinic_settings_touch_updated_at on public.clinic_settings;
create trigger clinic_settings_touch_updated_at
before update on public.clinic_settings
for each row
execute function public.touch_clinic_updated_at();

drop trigger if exists clinic_services_touch_updated_at on public.clinic_services;
create trigger clinic_services_touch_updated_at
before update on public.clinic_services
for each row
execute function public.touch_clinic_updated_at();

create or replace function public.user_is_super_admin(uid uuid)
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
      and p.role = 'super_admin'
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
    );
$$;

create or replace function public.user_can_manage_clinic(uid uuid, target_clinic_id uuid)
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
        and cu.role in ('super_admin', 'location_admin')
    );
$$;

create or replace function public.current_user_clinic_ids()
returns table (clinic_id uuid)
language sql
stable
security definer
set search_path = public
as $$
  select cu.clinic_id
  from public.clinic_users cu
  where cu.user_id = auth.uid()
    and cu.is_active = true
  union
  select c.id
  from public.clinics c
  where public.user_is_super_admin(auth.uid());
$$;

with normalized_services as (
  select
    s.id,
    lower(regexp_replace(coalesce(nullif(s.service_group, ''), nullif(s.category, ''), nullif(s.name, ''), s.id::text), '[^a-z0-9]+', '-', 'g')) as base_key
  from public.services s
),
deduped as (
  select
    id,
    case
      when row_number() over (partition by base_key order by id) = 1 then base_key
      else base_key || '-' || row_number() over (partition by base_key order by id)
    end as resolved_key
  from normalized_services
)
update public.services s
set service_key = d.resolved_key
from deduped d
where s.id = d.id
  and (s.service_key is null or btrim(s.service_key) = '');

do $$
declare
  flagship_clinic_id uuid;
begin
  insert into public.clinics (
    name,
    slug,
    status,
    brand_name,
    support_email,
    support_phone,
    default_timezone
  )
  values (
    'Vitality Institute',
    'vitality-institute',
    'active',
    'Vitality Institute',
    null,
    null,
    'America/Los_Angeles'
  )
  on conflict (slug) do update
  set
    name = excluded.name,
    brand_name = excluded.brand_name,
    status = excluded.status,
    default_timezone = excluded.default_timezone,
    updated_at = now()
  returning id into flagship_clinic_id;

  insert into public.clinic_locations (clinic_id, location_id, is_primary)
  select
    flagship_clinic_id,
    l.id,
    case
      when row_number() over (order by l.name nulls last, l.id) = 1 then true
      else false
    end
  from public.locations l
  where not exists (
    select 1
    from public.clinic_locations cl
    where cl.clinic_id = flagship_clinic_id
      and cl.location_id = l.id
  );

  insert into public.clinic_settings (
    clinic_id,
    intake_enabled,
    labs_enabled,
    ai_protocol_enabled,
    fulfillment_enabled,
    telehealth_enabled,
    default_programs_json
  )
  values (
    flagship_clinic_id,
    true,
    true,
    false,
    false,
    true,
    '["glp1","trt","wellness","peptides","wound-care"]'::jsonb
  )
  on conflict (clinic_id) do nothing;

  insert into public.clinic_users (clinic_id, user_id, role, is_active, invited_by)
  select
    flagship_clinic_id,
    p.id,
    coalesce(p.role, 'provider'),
    coalesce((to_jsonb(p) ->> 'is_active')::boolean, true),
    null
  from public.profiles p
  where p.role in ('super_admin', 'location_admin', 'provider', 'clinical_staff', 'billing', 'front_desk')
  on conflict (clinic_id, user_id) do update
  set
    role = excluded.role,
    is_active = excluded.is_active;

  update public.profiles p
  set active_clinic_id = flagship_clinic_id
  where p.active_clinic_id is null
    and p.role in ('super_admin', 'location_admin', 'provider', 'clinical_staff', 'billing', 'front_desk');

  insert into public.clinic_services (clinic_id, service_key, is_enabled, pricing_json)
  select
    flagship_clinic_id,
    s.service_key,
    true,
    jsonb_build_object(
      'price_marketing_cents', s.price_marketing_cents,
      'price_regular_cents', s.price_regular_cents,
      'requires_consult', s.requires_consult,
      'visit_type', s.visit_type
    )
  from (
    select distinct on (service_key)
      service_key,
      price_marketing_cents,
      price_regular_cents,
      requires_consult,
      visit_type
    from public.services
    where service_key is not null
    order by service_key, location_id nulls first, id
  ) s
  on conflict (clinic_id, service_key) do nothing;
end $$;

alter table public.clinics enable row level security;
alter table public.clinic_locations enable row level security;
alter table public.clinic_users enable row level security;
alter table public.clinic_settings enable row level security;
alter table public.clinic_services enable row level security;
alter table public.clinic_audit_events enable row level security;

drop policy if exists clinics_select_policy on public.clinics;
create policy clinics_select_policy
on public.clinics
for select
using (public.user_can_access_clinic(auth.uid(), id));

drop policy if exists clinics_insert_policy on public.clinics;
create policy clinics_insert_policy
on public.clinics
for insert
with check (public.user_is_super_admin(auth.uid()));

drop policy if exists clinics_update_policy on public.clinics;
create policy clinics_update_policy
on public.clinics
for update
using (public.user_can_manage_clinic(auth.uid(), id))
with check (public.user_can_manage_clinic(auth.uid(), id));

drop policy if exists clinic_locations_select_policy on public.clinic_locations;
create policy clinic_locations_select_policy
on public.clinic_locations
for select
using (public.user_can_access_clinic(auth.uid(), clinic_id));

drop policy if exists clinic_locations_write_policy on public.clinic_locations;
create policy clinic_locations_write_policy
on public.clinic_locations
for all
using (public.user_can_manage_clinic(auth.uid(), clinic_id))
with check (public.user_can_manage_clinic(auth.uid(), clinic_id));

drop policy if exists clinic_users_select_policy on public.clinic_users;
create policy clinic_users_select_policy
on public.clinic_users
for select
using (public.user_can_access_clinic(auth.uid(), clinic_id));

drop policy if exists clinic_users_write_policy on public.clinic_users;
create policy clinic_users_write_policy
on public.clinic_users
for all
using (public.user_can_manage_clinic(auth.uid(), clinic_id))
with check (public.user_can_manage_clinic(auth.uid(), clinic_id));

drop policy if exists clinic_settings_select_policy on public.clinic_settings;
create policy clinic_settings_select_policy
on public.clinic_settings
for select
using (public.user_can_access_clinic(auth.uid(), clinic_id));

drop policy if exists clinic_settings_write_policy on public.clinic_settings;
create policy clinic_settings_write_policy
on public.clinic_settings
for all
using (public.user_can_manage_clinic(auth.uid(), clinic_id))
with check (public.user_can_manage_clinic(auth.uid(), clinic_id));

drop policy if exists clinic_services_select_policy on public.clinic_services;
create policy clinic_services_select_policy
on public.clinic_services
for select
using (public.user_can_access_clinic(auth.uid(), clinic_id));

drop policy if exists clinic_services_write_policy on public.clinic_services;
create policy clinic_services_write_policy
on public.clinic_services
for all
using (public.user_can_manage_clinic(auth.uid(), clinic_id))
with check (public.user_can_manage_clinic(auth.uid(), clinic_id));

drop policy if exists clinic_audit_events_select_policy on public.clinic_audit_events;
create policy clinic_audit_events_select_policy
on public.clinic_audit_events
for select
using (public.user_can_access_clinic(auth.uid(), clinic_id));

drop policy if exists clinic_audit_events_insert_policy on public.clinic_audit_events;
create policy clinic_audit_events_insert_policy
on public.clinic_audit_events
for insert
with check (
  public.user_can_manage_clinic(auth.uid(), clinic_id)
  and (actor_user_id is null or actor_user_id = auth.uid())
);
