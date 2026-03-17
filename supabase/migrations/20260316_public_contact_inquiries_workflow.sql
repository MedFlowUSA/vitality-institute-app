alter table public.contact_inquiries
  add column if not exists internal_notes text,
  add column if not exists contacted_at timestamptz,
  add column if not exists resolved_at timestamptz,
  add column if not exists assigned_to uuid references public.profiles(id) on delete set null;

create index if not exists idx_contact_inquiries_assigned_to
  on public.contact_inquiries (assigned_to, created_at desc);
