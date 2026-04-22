create table if not exists public.clinic_provider_profiles (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  specialty text,
  credentials text,
  npi text,
  license_number text,
  contact_phone text,
  contact_email text,
  bio text,
  accepting_new_patients boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (clinic_id, user_id)
);

create index if not exists clinic_provider_profiles_clinic_idx
  on public.clinic_provider_profiles (clinic_id, updated_at desc);

create index if not exists clinic_provider_profiles_user_idx
  on public.clinic_provider_profiles (user_id);

drop trigger if exists clinic_provider_profiles_touch_updated_at on public.clinic_provider_profiles;
create trigger clinic_provider_profiles_touch_updated_at
before update on public.clinic_provider_profiles
for each row
execute function public.touch_clinic_updated_at();

alter table public.clinic_provider_profiles enable row level security;

drop policy if exists clinic_provider_profiles_select_policy on public.clinic_provider_profiles;
create policy clinic_provider_profiles_select_policy
on public.clinic_provider_profiles
for select
using (public.user_can_access_clinic(auth.uid(), clinic_id));

drop policy if exists clinic_provider_profiles_write_policy on public.clinic_provider_profiles;
create policy clinic_provider_profiles_write_policy
on public.clinic_provider_profiles
for all
using (public.user_can_manage_clinic(auth.uid(), clinic_id))
with check (public.user_can_manage_clinic(auth.uid(), clinic_id));
