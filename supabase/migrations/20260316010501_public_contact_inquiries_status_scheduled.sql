alter table public.contact_inquiries
  drop constraint if exists contact_inquiries_status_check;

alter table public.contact_inquiries
  add constraint contact_inquiries_status_check
  check (status in ('new', 'reviewed', 'contacted', 'scheduled', 'closed'));
