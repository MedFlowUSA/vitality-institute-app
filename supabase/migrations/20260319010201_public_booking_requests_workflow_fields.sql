alter table public.booking_requests
  add column if not exists internal_notes text,
  add column if not exists assigned_to uuid references public.profiles(id) on delete set null,
  add column if not exists contacted_at timestamptz,
  add column if not exists resolved_at timestamptz;

create index if not exists idx_booking_requests_assigned_status
  on public.booking_requests (assigned_to, status, created_at desc);
