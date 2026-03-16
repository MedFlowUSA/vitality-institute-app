-- Vitality Institute App
-- Messaging System Upgrade - conversation foundation
--
-- This is an additive migration intended to evolve the current
-- chat_threads/chat_messages model into a safer conversation system
-- without breaking existing patient/provider chat flows.

create extension if not exists pgcrypto;

alter table if exists public.chat_threads
  add column if not exists conversation_type text not null default 'patient_clinic',
  add column if not exists context_type text null,
  add column if not exists context_id uuid null,
  add column if not exists closed_at timestamptz null,
  add column if not exists closed_by uuid null,
  add column if not exists updated_at timestamptz not null default now();

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'chat_threads'
      and column_name = 'conversation_type'
  ) then
    alter table public.chat_threads
      drop constraint if exists chat_threads_conversation_type_check;

    alter table public.chat_threads
      add constraint chat_threads_conversation_type_check
      check (conversation_type in ('patient_clinic', 'appointment', 'intake', 'care_coordination'));
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'chat_threads'
      and column_name = 'context_type'
  ) then
    alter table public.chat_threads
      drop constraint if exists chat_threads_context_type_check;

    alter table public.chat_threads
      add constraint chat_threads_context_type_check
      check (
        context_type is null or context_type in ('general', 'appointment', 'intake', 'visit', 'labs', 'records')
      );
  end if;
end $$;

alter table if exists public.chat_messages
  add column if not exists visibility text not null default 'patient_visible',
  add column if not exists message_type text not null default 'message',
  add column if not exists reply_to_message_id uuid null,
  add column if not exists mentioned_user_ids uuid[] not null default '{}',
  add column if not exists edited_at timestamptz null,
  add column if not exists metadata_json jsonb not null default '{}'::jsonb;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'chat_messages'
      and column_name = 'visibility'
  ) then
    alter table public.chat_messages
      drop constraint if exists chat_messages_visibility_check;

    alter table public.chat_messages
      add constraint chat_messages_visibility_check
      check (visibility in ('patient_visible', 'internal_only'));
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'chat_messages'
      and column_name = 'message_type'
  ) then
    alter table public.chat_messages
      drop constraint if exists chat_messages_message_type_check;

    alter table public.chat_messages
      add constraint chat_messages_message_type_check
      check (message_type in ('message', 'internal_note', 'system'));
  end if;
end $$;

alter table if exists public.chat_messages
  drop constraint if exists chat_messages_reply_to_message_id_fkey;

alter table if exists public.chat_messages
  add constraint chat_messages_reply_to_message_id_fkey
  foreign key (reply_to_message_id)
  references public.chat_messages(id)
  on delete set null;

update public.chat_messages
set
  visibility = case when coalesce(is_internal, false) then 'internal_only' else 'patient_visible' end,
  message_type = case when coalesce(is_internal, false) then 'internal_note' else 'message' end
where true;

create table if not exists public.chat_thread_participants (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.chat_threads(id) on delete cascade,
  user_id uuid null references auth.users(id) on delete cascade,
  patient_id uuid null references public.patients(id) on delete cascade,
  participant_role text not null default 'staff',
  can_view_internal boolean not null default false,
  can_post_internal boolean not null default false,
  joined_at timestamptz not null default now(),
  last_read_at timestamptz null,
  notifications_muted boolean not null default false,
  unique (thread_id, user_id),
  unique (thread_id, patient_id),
  constraint chat_thread_participants_identity_check
    check ((user_id is not null) <> (patient_id is not null)),
  constraint chat_thread_participants_role_check
    check (participant_role in ('patient', 'staff', 'provider', 'admin'))
);

create table if not exists public.chat_message_mentions (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.chat_messages(id) on delete cascade,
  mentioned_user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  acknowledged_at timestamptz null,
  unique (message_id, mentioned_user_id)
);

create index if not exists idx_chat_threads_patient_id on public.chat_threads(patient_id);
create index if not exists idx_chat_threads_location_status_last_message on public.chat_threads(location_id, status, last_message_at desc);
create index if not exists idx_chat_threads_context on public.chat_threads(context_type, context_id);
create index if not exists idx_chat_messages_thread_created on public.chat_messages(thread_id, created_at);
create index if not exists idx_chat_messages_visibility on public.chat_messages(visibility);
create index if not exists idx_chat_thread_participants_thread on public.chat_thread_participants(thread_id);
create index if not exists idx_chat_thread_participants_user on public.chat_thread_participants(user_id);
create index if not exists idx_chat_thread_participants_patient on public.chat_thread_participants(patient_id);
create index if not exists idx_chat_thread_participants_last_read on public.chat_thread_participants(last_read_at);
create index if not exists idx_chat_message_mentions_user on public.chat_message_mentions(mentioned_user_id, created_at desc);

create index if not exists idx_chat_messages_body_search
  on public.chat_messages
  using gin (to_tsvector('simple', coalesce(body, '')));

-- Backfill patient participants from legacy chat_threads.patient_id.
-- The legacy column is inconsistent across current UI flows and may contain:
--   1. patients.id
--   2. auth.users.id (profile_id)
-- This inserts participant rows for both shapes where resolvable.
insert into public.chat_thread_participants (
  thread_id,
  user_id,
  patient_id,
  participant_role,
  can_view_internal,
  can_post_internal
)
select
  t.id,
  p.profile_id,
  p.id,
  'patient',
  false,
  false
from public.chat_threads t
join public.patients p
  on p.id = t.patient_id
on conflict do nothing;

insert into public.chat_thread_participants (
  thread_id,
  user_id,
  patient_id,
  participant_role,
  can_view_internal,
  can_post_internal
)
select
  t.id,
  p.profile_id,
  p.id,
  'patient',
  false,
  false
from public.chat_threads t
join public.patients p
  on p.profile_id = t.patient_id
on conflict do nothing;

-- Backfill staff/provider/admin participants from historical message senders.
insert into public.chat_thread_participants (
  thread_id,
  user_id,
  participant_role,
  can_view_internal,
  can_post_internal
)
select distinct
  m.thread_id,
  m.sender_id,
  'staff',
  true,
  true
from public.chat_messages m
left join public.chat_thread_participants existing
  on existing.thread_id = m.thread_id
 and existing.user_id = m.sender_id
where existing.id is null;

-- Backfill mentions from any existing mentioned_user_ids arrays.
insert into public.chat_message_mentions (message_id, mentioned_user_id)
select
  m.id,
  mentioned_id
from public.chat_messages m,
  unnest(coalesce(m.mentioned_user_ids, '{}'::uuid[])) as mentioned_id
on conflict do nothing;

-- Recommended follow-up:
-- RLS should migrate from legacy thread.patient_id checks to participant-based checks:
--   patient reads via chat_thread_participants.user_id = auth.uid() and visibility = patient_visible
--   staff/provider/admin reads via assigned location access + can_view_internal
-- This migration intentionally leaves existing policies untouched so the current app keeps working
-- until the UI is switched to participant-aware queries.
