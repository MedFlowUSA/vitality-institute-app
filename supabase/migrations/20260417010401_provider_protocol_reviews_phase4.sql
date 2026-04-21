create table if not exists public.provider_protocol_reviews (
  id uuid primary key default gen_random_uuid(),
  ai_protocol_assessment_id uuid not null references public.ai_protocol_assessments(id) on delete cascade,
  provider_id uuid not null references public.profiles(id) on delete restrict,
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  decision text not null check (decision in ('approved', 'modified', 'rejected')),
  final_protocol_json jsonb not null default '{}'::jsonb,
  provider_notes text,
  signed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint provider_protocol_reviews_assessment_unique unique (ai_protocol_assessment_id)
);

create index if not exists idx_provider_protocol_reviews_clinic on public.provider_protocol_reviews (clinic_id, created_at desc);
create index if not exists idx_provider_protocol_reviews_provider on public.provider_protocol_reviews (provider_id, created_at desc);
create index if not exists idx_provider_protocol_reviews_decision on public.provider_protocol_reviews (decision, created_at desc);

drop trigger if exists provider_protocol_reviews_touch_updated_at on public.provider_protocol_reviews;
create trigger provider_protocol_reviews_touch_updated_at
before update on public.provider_protocol_reviews
for each row
execute function public.touch_protocol_updated_at();

alter table public.provider_protocol_reviews enable row level security;

drop policy if exists provider_protocol_reviews_select_policy on public.provider_protocol_reviews;
create policy provider_protocol_reviews_select_policy
on public.provider_protocol_reviews
for select
to authenticated
using (
  public.user_can_access_clinic(auth.uid(), clinic_id)
);

drop policy if exists provider_protocol_reviews_insert_policy on public.provider_protocol_reviews;
create policy provider_protocol_reviews_insert_policy
on public.provider_protocol_reviews
for insert
to authenticated
with check (
  provider_id = auth.uid()
  and public.user_can_access_clinic(auth.uid(), clinic_id)
);

drop policy if exists provider_protocol_reviews_update_policy on public.provider_protocol_reviews;
create policy provider_protocol_reviews_update_policy
on public.provider_protocol_reviews
for update
to authenticated
using (
  public.user_can_access_clinic(auth.uid(), clinic_id)
)
with check (
  provider_id = auth.uid()
  and public.user_can_access_clinic(auth.uid(), clinic_id)
);
