alter table public.booking_requests
  add column if not exists service_label text;
