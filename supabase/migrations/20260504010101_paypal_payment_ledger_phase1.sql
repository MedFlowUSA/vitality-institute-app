create table if not exists public.payment_transactions (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid null references public.patients(id) on delete set null,
  appointment_id uuid null references public.appointments(id) on delete set null,
  service_id uuid null references public.services(id) on delete set null,
  provider_id uuid null references public.profiles(id) on delete set null,
  clinic_id uuid null references public.clinics(id) on delete set null,
  location_id uuid null references public.locations(id) on delete set null,
  payment_provider text not null default 'paypal',
  provider_transaction_id text,
  gross_amount_cents integer not null check (gross_amount_cents >= 0),
  platform_fee_cents integer not null default 0 check (platform_fee_cents >= 0),
  processing_fee_cents integer not null default 0 check (processing_fee_cents >= 0),
  net_amount_cents integer not null check (net_amount_cents >= 0),
  currency text not null default 'USD',
  payment_status text not null default 'pending',
  checkout_status text not null default 'pending',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.provider_revenue_split_rules (
  id uuid primary key default gen_random_uuid(),
  provider_id uuid null references public.profiles(id) on delete cascade,
  clinic_id uuid null references public.clinics(id) on delete cascade,
  service_id uuid null references public.services(id) on delete cascade,
  service_category text null,
  physician_percentage numeric(5,2) not null check (physician_percentage >= 0 and physician_percentage <= 100),
  vitality_percentage numeric(5,2) not null check (vitality_percentage >= 0 and vitality_percentage <= 100),
  active boolean not null default true,
  effective_start_date date not null default current_date,
  effective_end_date date null,
  notes text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint provider_revenue_split_rules_percent_sum_check
    check (round((physician_percentage + vitality_percentage)::numeric, 2) = 100.00),
  constraint provider_revenue_split_rules_effective_window_check
    check (effective_end_date is null or effective_end_date >= effective_start_date)
);

create table if not exists public.provider_payout_ledger (
  id uuid primary key default gen_random_uuid(),
  payment_transaction_id uuid not null references public.payment_transactions(id) on delete cascade,
  provider_id uuid not null references public.profiles(id) on delete cascade,
  clinic_id uuid null references public.clinics(id) on delete set null,
  service_id uuid null references public.services(id) on delete set null,
  gross_amount_cents integer not null check (gross_amount_cents >= 0),
  net_amount_cents integer not null check (net_amount_cents >= 0),
  physician_percentage numeric(5,2) not null check (physician_percentage >= 0 and physician_percentage <= 100),
  vitality_percentage numeric(5,2) not null check (vitality_percentage >= 0 and vitality_percentage <= 100),
  physician_share_cents integer not null check (physician_share_cents >= 0),
  vitality_share_cents integer not null check (vitality_share_cents >= 0),
  payout_status text not null default 'pending'
    check (payout_status in ('pending', 'approved', 'paid', 'held', 'refunded', 'disputed', 'canceled')),
  payout_method text null,
  payout_reference text null,
  paid_at timestamptz null,
  admin_notes text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint provider_payout_ledger_payment_provider_unique unique (payment_transaction_id, provider_id),
  constraint provider_payout_ledger_percent_sum_check
    check (round((physician_percentage + vitality_percentage)::numeric, 2) = 100.00),
  constraint provider_payout_ledger_share_sum_check
    check (physician_share_cents + vitality_share_cents = net_amount_cents)
);

create table if not exists public.payment_events (
  id uuid primary key default gen_random_uuid(),
  payment_transaction_id uuid null references public.payment_transactions(id) on delete set null,
  event_type text not null,
  event_payload jsonb not null default '{}'::jsonb,
  actor_user_id uuid null references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists payment_transactions_patient_idx
  on public.payment_transactions (patient_id, created_at desc);

create index if not exists payment_transactions_provider_idx
  on public.payment_transactions (provider_id, created_at desc);

create index if not exists payment_transactions_clinic_location_idx
  on public.payment_transactions (clinic_id, location_id, created_at desc);

create index if not exists payment_transactions_status_idx
  on public.payment_transactions (payment_status, checkout_status, created_at desc);

create unique index if not exists payment_transactions_provider_txn_idx
  on public.payment_transactions (payment_provider, provider_transaction_id)
  where provider_transaction_id is not null;

create index if not exists provider_revenue_split_rules_scope_idx
  on public.provider_revenue_split_rules (clinic_id, provider_id, service_id, active, effective_start_date desc);

create index if not exists provider_revenue_split_rules_category_idx
  on public.provider_revenue_split_rules (service_category, active, effective_start_date desc);

create index if not exists provider_payout_ledger_provider_status_idx
  on public.provider_payout_ledger (provider_id, payout_status, created_at desc);

create index if not exists provider_payout_ledger_clinic_idx
  on public.provider_payout_ledger (clinic_id, created_at desc);

create index if not exists payment_events_transaction_idx
  on public.payment_events (payment_transaction_id, created_at desc);

create index if not exists payment_events_type_idx
  on public.payment_events (event_type, created_at desc);

drop trigger if exists payment_transactions_touch_updated_at on public.payment_transactions;
create trigger payment_transactions_touch_updated_at
before update on public.payment_transactions
for each row
execute function public.touch_clinic_updated_at();

drop trigger if exists provider_revenue_split_rules_touch_updated_at on public.provider_revenue_split_rules;
create trigger provider_revenue_split_rules_touch_updated_at
before update on public.provider_revenue_split_rules
for each row
execute function public.touch_clinic_updated_at();

drop trigger if exists provider_payout_ledger_touch_updated_at on public.provider_payout_ledger;
create trigger provider_payout_ledger_touch_updated_at
before update on public.provider_payout_ledger
for each row
execute function public.touch_clinic_updated_at();

create or replace function public.user_is_location_admin(uid uuid)
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
      and p.role = 'location_admin'
  );
$$;

create or replace function public.user_can_manage_financial_scope(
  uid uuid,
  target_clinic_id uuid,
  target_location_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    public.user_is_super_admin(uid)
    or (
      public.user_is_location_admin(uid)
      and (
        (target_clinic_id is not null and public.user_can_manage_clinic(uid, target_clinic_id))
        or (target_location_id is not null and public.user_has_location_access(uid, target_location_id))
      )
    );
$$;

create or replace function public.resolve_provider_revenue_split_rule(
  target_provider_id uuid,
  target_clinic_id uuid,
  target_service_id uuid,
  target_service_category text default null,
  target_effective_date date default current_date
)
returns table (
  rule_id uuid,
  provider_id uuid,
  clinic_id uuid,
  service_id uuid,
  service_category text,
  physician_percentage numeric,
  vitality_percentage numeric,
  notes text,
  resolution_source text
)
language sql
stable
security definer
set search_path = public
as $$
  with candidates as (
    select
      rule.*,
      case
        when rule.provider_id = target_provider_id and rule.service_id = target_service_id then 600
        when rule.provider_id = target_provider_id
          and rule.service_id is null
          and rule.service_category is not null
          and lower(rule.service_category) = lower(coalesce(target_service_category, '')) then 550
        when rule.provider_id is null
          and rule.clinic_id = target_clinic_id
          and rule.service_id = target_service_id then 500
        when rule.provider_id is null
          and rule.clinic_id = target_clinic_id
          and rule.service_id is null
          and rule.service_category is not null
          and lower(rule.service_category) = lower(coalesce(target_service_category, '')) then 450
        when rule.provider_id = target_provider_id
          and rule.service_id is null
          and rule.service_category is null then 400
        when rule.provider_id is null
          and rule.clinic_id = target_clinic_id
          and rule.service_id is null
          and rule.service_category is null then 300
        when rule.provider_id is null
          and rule.clinic_id is null
          and rule.service_id = target_service_id then 250
        when rule.provider_id is null
          and rule.clinic_id is null
          and rule.service_id is null
          and rule.service_category is not null
          and lower(rule.service_category) = lower(coalesce(target_service_category, '')) then 200
        when rule.provider_id is null
          and rule.clinic_id is null
          and rule.service_id is null
          and rule.service_category is null then 100
        else 0
      end as priority,
      case
        when rule.provider_id = target_provider_id and rule.service_id = target_service_id then 'provider_service'
        when rule.provider_id = target_provider_id
          and rule.service_id is null
          and rule.service_category is not null
          and lower(rule.service_category) = lower(coalesce(target_service_category, '')) then 'provider_service_category'
        when rule.provider_id is null
          and rule.clinic_id = target_clinic_id
          and rule.service_id = target_service_id then 'clinic_service'
        when rule.provider_id is null
          and rule.clinic_id = target_clinic_id
          and rule.service_id is null
          and rule.service_category is not null
          and lower(rule.service_category) = lower(coalesce(target_service_category, '')) then 'clinic_service_category'
        when rule.provider_id = target_provider_id
          and rule.service_id is null
          and rule.service_category is null then 'provider_default'
        when rule.provider_id is null
          and rule.clinic_id = target_clinic_id
          and rule.service_id is null
          and rule.service_category is null then 'clinic_default'
        when rule.provider_id is null
          and rule.clinic_id is null
          and rule.service_id = target_service_id then 'global_service'
        when rule.provider_id is null
          and rule.clinic_id is null
          and rule.service_id is null
          and rule.service_category is not null
          and lower(rule.service_category) = lower(coalesce(target_service_category, '')) then 'global_service_category'
        when rule.provider_id is null
          and rule.clinic_id is null
          and rule.service_id is null
          and rule.service_category is null then 'global_default'
        else 'none'
      end as resolution_source
    from public.provider_revenue_split_rules rule
    where rule.active = true
      and rule.effective_start_date <= target_effective_date
      and (rule.effective_end_date is null or rule.effective_end_date >= target_effective_date)
      and (rule.provider_id is null or rule.provider_id = target_provider_id)
      and (rule.clinic_id is null or rule.clinic_id = target_clinic_id)
      and (rule.service_id is null or rule.service_id = target_service_id)
      and (
        rule.service_category is null
        or lower(rule.service_category) = lower(coalesce(target_service_category, ''))
      )
  )
  select
    id as rule_id,
    provider_id,
    clinic_id,
    service_id,
    service_category,
    physician_percentage,
    vitality_percentage,
    notes,
    resolution_source
  from candidates
  where priority > 0
  order by priority desc, effective_start_date desc, updated_at desc, created_at desc
  limit 1;
$$;

create or replace function public.log_provider_payout_status_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.payment_events (
      payment_transaction_id,
      event_type,
      event_payload,
      actor_user_id
    )
    values (
      new.payment_transaction_id,
      'provider_payout_ledger_created',
      jsonb_build_object(
        'payout_ledger_id', new.id,
        'provider_id', new.provider_id,
        'payout_status', new.payout_status,
        'physician_share_cents', new.physician_share_cents,
        'vitality_share_cents', new.vitality_share_cents
      ),
      auth.uid()
    );
    return new;
  end if;

  if new.payout_status is distinct from old.payout_status
    or new.paid_at is distinct from old.paid_at
    or new.payout_reference is distinct from old.payout_reference
    or new.payout_method is distinct from old.payout_method then
    insert into public.payment_events (
      payment_transaction_id,
      event_type,
      event_payload,
      actor_user_id
    )
    values (
      new.payment_transaction_id,
      'provider_payout_status_changed',
      jsonb_build_object(
        'payout_ledger_id', new.id,
        'from_status', old.payout_status,
        'to_status', new.payout_status,
        'payout_method', new.payout_method,
        'payout_reference', new.payout_reference,
        'paid_at', new.paid_at,
        'admin_notes', new.admin_notes
      ),
      auth.uid()
    );
  end if;

  return new;
end;
$$;

create or replace function public.log_provider_revenue_split_rule_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.payment_events (
      payment_transaction_id,
      event_type,
      event_payload,
      actor_user_id
    )
    values (
      null,
      'provider_revenue_split_rule_created',
      jsonb_build_object(
        'split_rule_id', new.id,
        'provider_id', new.provider_id,
        'clinic_id', new.clinic_id,
        'service_id', new.service_id,
        'service_category', new.service_category,
        'physician_percentage', new.physician_percentage,
        'vitality_percentage', new.vitality_percentage,
        'active', new.active,
        'effective_start_date', new.effective_start_date,
        'effective_end_date', new.effective_end_date,
        'notes', new.notes
      ),
      auth.uid()
    );
    return new;
  end if;

  insert into public.payment_events (
    payment_transaction_id,
    event_type,
    event_payload,
    actor_user_id
  )
  values (
    null,
    'provider_revenue_split_rule_updated',
    jsonb_build_object(
      'split_rule_id', new.id,
      'provider_id', new.provider_id,
      'clinic_id', new.clinic_id,
      'service_id', new.service_id,
      'service_category', new.service_category,
      'physician_percentage', new.physician_percentage,
      'vitality_percentage', new.vitality_percentage,
      'active', new.active,
      'effective_start_date', new.effective_start_date,
      'effective_end_date', new.effective_end_date,
      'notes', new.notes
    ),
    auth.uid()
  );

  return new;
end;
$$;

drop trigger if exists provider_payout_ledger_payment_events_trigger on public.provider_payout_ledger;
create trigger provider_payout_ledger_payment_events_trigger
after insert or update on public.provider_payout_ledger
for each row
execute function public.log_provider_payout_status_change();

drop trigger if exists provider_revenue_split_rules_payment_events_trigger on public.provider_revenue_split_rules;
create trigger provider_revenue_split_rules_payment_events_trigger
after insert or update on public.provider_revenue_split_rules
for each row
execute function public.log_provider_revenue_split_rule_change();

alter table public.payment_transactions enable row level security;
alter table public.provider_revenue_split_rules enable row level security;
alter table public.provider_payout_ledger enable row level security;
alter table public.payment_events enable row level security;

drop policy if exists payment_transactions_select_admin_policy on public.payment_transactions;
create policy payment_transactions_select_admin_policy
on public.payment_transactions
for select
using (
  public.user_can_manage_financial_scope(auth.uid(), clinic_id, location_id)
);

drop policy if exists payment_transactions_select_patient_policy on public.payment_transactions;
create policy payment_transactions_select_patient_policy
on public.payment_transactions
for select
using (
  checkout_status = 'completed'
  and exists (
    select 1
    from public.patients patient_owner
    where patient_owner.id = payment_transactions.patient_id
      and patient_owner.profile_id = auth.uid()
  )
);

drop policy if exists provider_revenue_split_rules_select_policy on public.provider_revenue_split_rules;
create policy provider_revenue_split_rules_select_policy
on public.provider_revenue_split_rules
for select
using (
  public.user_is_super_admin(auth.uid())
  or (
    clinic_id is not null
    and public.user_can_manage_financial_scope(auth.uid(), clinic_id, null)
  )
);

drop policy if exists provider_revenue_split_rules_write_policy on public.provider_revenue_split_rules;
create policy provider_revenue_split_rules_write_policy
on public.provider_revenue_split_rules
for all
using (
  public.user_is_super_admin(auth.uid())
  or (
    clinic_id is not null
    and public.user_can_manage_financial_scope(auth.uid(), clinic_id, null)
  )
)
with check (
  public.user_is_super_admin(auth.uid())
  or (
    clinic_id is not null
    and public.user_can_manage_financial_scope(auth.uid(), clinic_id, null)
  )
);

drop policy if exists provider_payout_ledger_select_policy on public.provider_payout_ledger;
create policy provider_payout_ledger_select_policy
on public.provider_payout_ledger
for select
using (
  provider_id = auth.uid()
  or public.user_can_manage_financial_scope(
    auth.uid(),
    clinic_id,
    (
      select pt.location_id
      from public.payment_transactions pt
      where pt.id = provider_payout_ledger.payment_transaction_id
    )
  )
);

drop policy if exists provider_payout_ledger_write_policy on public.provider_payout_ledger;
create policy provider_payout_ledger_write_policy
on public.provider_payout_ledger
for update
using (
  public.user_can_manage_financial_scope(
    auth.uid(),
    clinic_id,
    (
      select pt.location_id
      from public.payment_transactions pt
      where pt.id = provider_payout_ledger.payment_transaction_id
    )
  )
)
with check (
  public.user_can_manage_financial_scope(
    auth.uid(),
    clinic_id,
    (
      select pt.location_id
      from public.payment_transactions pt
      where pt.id = provider_payout_ledger.payment_transaction_id
    )
  )
);

drop policy if exists payment_events_select_policy on public.payment_events;
create policy payment_events_select_policy
on public.payment_events
for select
using (
  public.user_is_super_admin(auth.uid())
  or exists (
    select 1
    from public.payment_transactions pt
    where pt.id = payment_events.payment_transaction_id
      and public.user_can_manage_financial_scope(auth.uid(), pt.clinic_id, pt.location_id)
  )
);
