-- Vitality Institute App
-- Clinical conversation messaging upgrade

create extension if not exists pgcrypto;

create or replace function public.messaging_is_staff(uid uuid)
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = uid
      and p.role in ('super_admin', 'location_admin', 'provider', 'clinical_staff', 'billing', 'front_desk')
  );
$$;

create or replace function public.messaging_has_location_access(uid uuid, loc uuid)
returns boolean
language sql
stable
as $$
  select
    exists (
      select 1
      from public.profiles p
      where p.id = uid
        and p.role = 'super_admin'
    )
    or exists (
      select 1
      from public.user_locations ul
      where ul.user_id = uid
        and ul.location_id = loc
    )
    or exists (
      select 1
      from public.profiles p
      where p.id = uid
        and p.role = 'location_admin'
        and (p.active_location_id = loc or p.active_location_id is null)
    );
$$;

create or replace function public.messaging_owns_patient(uid uuid, candidate_patient_id uuid)
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.patients p
    where p.id = candidate_patient_id
      and p.profile_id = uid
  );
$$;

create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  legacy_thread_id uuid unique null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  location_id uuid not null references public.locations(id) on delete restrict,
  patient_id uuid not null references public.patients(id) on delete cascade,
  appointment_id uuid null references public.appointments(id) on delete set null,
  intake_submission_id uuid null,
  title text null,
  status text not null default 'open',
  context_type text not null default 'general',
  last_message_at timestamptz null,
  last_message_preview text null,
  metadata_json jsonb not null default '{}'::jsonb,
  constraint conversations_status_check check (status in ('open', 'closed')),
  constraint conversations_context_type_check check (
    context_type in ('general', 'appointment', 'intake', 'visit', 'labs', 'records')
  )
);

create unique index if not exists idx_conversations_appointment_unique
  on public.conversations(appointment_id)
  where appointment_id is not null;

create index if not exists idx_conversations_patient on public.conversations(patient_id, last_message_at desc);
create index if not exists idx_conversations_location_status on public.conversations(location_id, status, last_message_at desc);
create index if not exists idx_conversations_intake on public.conversations(intake_submission_id);

create table if not exists public.conversation_participants (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  participant_role text not null default 'staff',
  can_view_internal boolean not null default false,
  can_post_internal boolean not null default false,
  joined_at timestamptz not null default now(),
  last_read_at timestamptz null,
  notifications_muted boolean not null default false,
  unique (conversation_id, user_id),
  constraint conversation_participants_role_check check (
    participant_role in ('patient', 'staff', 'provider', 'admin', 'system')
  )
);

create index if not exists idx_conversation_participants_user on public.conversation_participants(user_id, last_read_at);
create index if not exists idx_conversation_participants_conversation on public.conversation_participants(conversation_id);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  legacy_message_id uuid unique null,
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_user_id uuid null references auth.users(id) on delete set null,
  sender_patient_id uuid null references public.patients(id) on delete set null,
  visibility text not null default 'patient_visible',
  message_type text not null default 'message',
  body text not null default '',
  created_at timestamptz not null default now(),
  edited_at timestamptz null,
  reply_to_message_id uuid null references public.messages(id) on delete set null,
  metadata_json jsonb not null default '{}'::jsonb,
  constraint messages_visibility_check check (visibility in ('patient_visible', 'staff_internal', 'system')),
  constraint messages_type_check check (message_type in ('message', 'internal_note', 'system'))
);

create index if not exists idx_messages_conversation_created on public.messages(conversation_id, created_at);
create index if not exists idx_messages_visibility on public.messages(visibility);
create index if not exists idx_messages_body_search
  on public.messages using gin (to_tsvector('simple', coalesce(body, '')));

create table if not exists public.message_mentions (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.messages(id) on delete cascade,
  mentioned_user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  acknowledged_at timestamptz null,
  unique (message_id, mentioned_user_id)
);

create index if not exists idx_message_mentions_user on public.message_mentions(mentioned_user_id, created_at desc);

create table if not exists public.message_attachments (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.messages(id) on delete cascade,
  patient_file_id uuid null references public.patient_files(id) on delete set null,
  file_name text not null,
  file_url text null,
  mime_type text null,
  created_at timestamptz not null default now()
);

create index if not exists idx_message_attachments_message on public.message_attachments(message_id);

insert into public.conversations (
  legacy_thread_id,
  location_id,
  patient_id,
  appointment_id,
  intake_submission_id,
  title,
  status,
  context_type,
  last_message_at,
  last_message_preview
)
select
  t.id,
  t.location_id,
  coalesce(patient_by_id.id, patient_by_profile.id),
  t.appointment_id,
  t.intake_submission_id,
  nullif(t.subject, ''),
  case when coalesce(t.status, 'open') in ('open', 'closed') then t.status else 'open' end,
  case
    when t.appointment_id is not null then 'appointment'
    when t.intake_submission_id is not null then 'intake'
    else 'general'
  end,
  t.last_message_at,
  null
from public.chat_threads t
left join public.patients patient_by_id
  on patient_by_id.id = t.patient_id
left join public.patients patient_by_profile
  on patient_by_profile.profile_id = t.patient_id
where coalesce(patient_by_id.id, patient_by_profile.id) is not null
on conflict (legacy_thread_id) do nothing;

insert into public.conversation_participants (
  conversation_id,
  user_id,
  participant_role,
  can_view_internal,
  can_post_internal,
  last_read_at
)
select
  c.id,
  p.profile_id,
  'patient',
  false,
  false,
  c.last_message_at
from public.conversations c
join public.patients p
  on p.id = c.patient_id
where p.profile_id is not null
on conflict (conversation_id, user_id) do nothing;

insert into public.conversation_participants (
  conversation_id,
  user_id,
  participant_role,
  can_view_internal,
  can_post_internal
)
select distinct
  c.id,
  m.sender_id,
  case
    when profile.role = 'provider' then 'provider'
    when profile.role in ('super_admin', 'location_admin') then 'admin'
    else 'staff'
  end,
  true,
  true
from public.chat_messages m
join public.conversations c
  on c.legacy_thread_id = m.thread_id
left join public.profiles profile
  on profile.id = m.sender_id
where m.sender_id is not null
on conflict (conversation_id, user_id) do nothing;

insert into public.messages (
  legacy_message_id,
  conversation_id,
  sender_user_id,
  sender_patient_id,
  visibility,
  message_type,
  body,
  created_at,
  metadata_json
)
select
  m.id,
  c.id,
  m.sender_id,
  patient_sender.id,
  case when coalesce(m.is_internal, false) then 'staff_internal' else 'patient_visible' end,
  case when coalesce(m.is_internal, false) then 'internal_note' else 'message' end,
  coalesce(m.body, ''),
  m.created_at,
  '{}'::jsonb
from public.chat_messages m
join public.conversations c
  on c.legacy_thread_id = m.thread_id
left join public.patients patient_sender
  on patient_sender.profile_id = m.sender_id
on conflict (legacy_message_id) do nothing;

insert into public.message_attachments (
  message_id,
  patient_file_id,
  file_name,
  file_url,
  mime_type
)
select
  new_message.id,
  legacy.attachment_file_id,
  legacy.attachment_name,
  legacy.attachment_url,
  null
from public.chat_messages legacy
join public.messages new_message
  on new_message.legacy_message_id = legacy.id
where legacy.attachment_name is not null
on conflict do nothing;

update public.conversations c
set
  last_message_preview = latest.body,
  last_message_at = latest.created_at,
  updated_at = now()
from lateral (
  select body, created_at
  from public.messages m
  where m.conversation_id = c.id
  order by m.created_at desc
  limit 1
) latest
where c.last_message_preview is distinct from latest.body
   or c.last_message_at is distinct from latest.created_at;

alter table public.conversations enable row level security;
alter table public.conversation_participants enable row level security;
alter table public.messages enable row level security;
alter table public.message_mentions enable row level security;
alter table public.message_attachments enable row level security;

drop policy if exists conversations_select_policy on public.conversations;
create policy conversations_select_policy
  on public.conversations
  for select
  using (
    public.messaging_has_location_access(auth.uid(), location_id)
    or public.messaging_owns_patient(auth.uid(), patient_id)
    or exists (
      select 1
      from public.conversation_participants cp
      where cp.conversation_id = conversations.id
        and cp.user_id = auth.uid()
    )
  );

drop policy if exists conversations_insert_policy on public.conversations;
create policy conversations_insert_policy
  on public.conversations
  for insert
  with check (
    (public.messaging_is_staff(auth.uid()) and public.messaging_has_location_access(auth.uid(), location_id))
    or public.messaging_owns_patient(auth.uid(), patient_id)
  );

drop policy if exists conversations_update_policy on public.conversations;
create policy conversations_update_policy
  on public.conversations
  for update
  using (
    public.messaging_has_location_access(auth.uid(), location_id)
    or public.messaging_owns_patient(auth.uid(), patient_id)
    or exists (
      select 1
      from public.conversation_participants cp
      where cp.conversation_id = conversations.id
        and cp.user_id = auth.uid()
    )
  )
  with check (
    public.messaging_has_location_access(auth.uid(), location_id)
    or public.messaging_owns_patient(auth.uid(), patient_id)
    or exists (
      select 1
      from public.conversation_participants cp
      where cp.conversation_id = conversations.id
        and cp.user_id = auth.uid()
    )
  );

drop policy if exists conversation_participants_select_policy on public.conversation_participants;
create policy conversation_participants_select_policy
  on public.conversation_participants
  for select
  using (
    user_id = auth.uid()
    or exists (
      select 1
      from public.conversations c
      where c.id = conversation_participants.conversation_id
        and public.messaging_has_location_access(auth.uid(), c.location_id)
    )
  );

drop policy if exists conversation_participants_insert_policy on public.conversation_participants;
create policy conversation_participants_insert_policy
  on public.conversation_participants
  for insert
  with check (
    user_id = auth.uid()
    or exists (
      select 1
      from public.conversations c
      where c.id = conversation_participants.conversation_id
        and public.messaging_has_location_access(auth.uid(), c.location_id)
    )
  );

drop policy if exists conversation_participants_update_policy on public.conversation_participants;
create policy conversation_participants_update_policy
  on public.conversation_participants
  for update
  using (
    user_id = auth.uid()
    or exists (
      select 1
      from public.conversations c
      where c.id = conversation_participants.conversation_id
        and public.messaging_has_location_access(auth.uid(), c.location_id)
    )
  )
  with check (
    user_id = auth.uid()
    or exists (
      select 1
      from public.conversations c
      where c.id = conversation_participants.conversation_id
        and public.messaging_has_location_access(auth.uid(), c.location_id)
    )
  );

drop policy if exists messages_select_policy on public.messages;
create policy messages_select_policy
  on public.messages
  for select
  using (
    exists (
      select 1
      from public.conversations c
      where c.id = messages.conversation_id
        and public.messaging_has_location_access(auth.uid(), c.location_id)
    )
    or (
      messages.visibility in ('patient_visible', 'system')
      and exists (
        select 1
        from public.conversation_participants cp
        where cp.conversation_id = messages.conversation_id
          and cp.user_id = auth.uid()
      )
    )
  );

drop policy if exists messages_insert_policy on public.messages;
create policy messages_insert_policy
  on public.messages
  for insert
  with check (
    (
      exists (
        select 1
        from public.conversations c
        where c.id = messages.conversation_id
          and public.messaging_has_location_access(auth.uid(), c.location_id)
      )
      and sender_user_id = auth.uid()
    )
    or (
      exists (
        select 1
        from public.conversation_participants cp
        where cp.conversation_id = messages.conversation_id
          and cp.user_id = auth.uid()
      )
      and sender_user_id = auth.uid()
      and visibility = 'patient_visible'
      and message_type = 'message'
    )
  );

drop policy if exists message_mentions_select_policy on public.message_mentions;
create policy message_mentions_select_policy
  on public.message_mentions
  for select
  using (
    exists (
      select 1
      from public.messages m
      join public.conversations c on c.id = m.conversation_id
      where m.id = message_mentions.message_id
        and (
          public.messaging_has_location_access(auth.uid(), c.location_id)
          or (
            m.visibility in ('patient_visible', 'system')
            and exists (
              select 1
              from public.conversation_participants cp
              where cp.conversation_id = c.id
                and cp.user_id = auth.uid()
            )
          )
        )
    )
  );

drop policy if exists message_mentions_insert_policy on public.message_mentions;
create policy message_mentions_insert_policy
  on public.message_mentions
  for insert
  with check (
    exists (
      select 1
      from public.messages m
      join public.conversations c on c.id = m.conversation_id
      where m.id = message_mentions.message_id
        and public.messaging_has_location_access(auth.uid(), c.location_id)
    )
  );

drop policy if exists message_attachments_select_policy on public.message_attachments;
create policy message_attachments_select_policy
  on public.message_attachments
  for select
  using (
    exists (
      select 1
      from public.messages m
      join public.conversations c on c.id = m.conversation_id
      where m.id = message_attachments.message_id
        and (
          public.messaging_has_location_access(auth.uid(), c.location_id)
          or (
            m.visibility in ('patient_visible', 'system')
            and exists (
              select 1
              from public.conversation_participants cp
              where cp.conversation_id = c.id
                and cp.user_id = auth.uid()
            )
          )
        )
    )
  );

drop policy if exists message_attachments_insert_policy on public.message_attachments;
create policy message_attachments_insert_policy
  on public.message_attachments
  for insert
  with check (
    exists (
      select 1
      from public.messages m
      join public.conversations c on c.id = m.conversation_id
      where m.id = message_attachments.message_id
        and (
          public.messaging_has_location_access(auth.uid(), c.location_id)
          or exists (
            select 1
            from public.conversation_participants cp
            where cp.conversation_id = c.id
              and cp.user_id = auth.uid()
          )
        )
    )
  );

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'conversations'
  ) then
    alter publication supabase_realtime add table public.conversations;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'conversation_participants'
  ) then
    alter publication supabase_realtime add table public.conversation_participants;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'messages'
  ) then
    alter publication supabase_realtime add table public.messages;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'message_mentions'
  ) then
    alter publication supabase_realtime add table public.message_mentions;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'message_attachments'
  ) then
    alter publication supabase_realtime add table public.message_attachments;
  end if;
end $$;
