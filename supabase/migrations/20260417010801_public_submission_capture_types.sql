alter table public.booking_requests
  add column if not exists capture_type text;

update public.booking_requests
set capture_type = case
  when source like 'public_expansion_interest:%' or source = 'public_expansion_interest' then 'expansion_interest'
  else 'live_booking'
end
where capture_type is null
   or capture_type not in ('live_booking', 'expansion_interest');

alter table public.booking_requests
  alter column capture_type set default 'live_booking';

update public.booking_requests
set capture_type = 'live_booking'
where capture_type is null;

alter table public.booking_requests
  drop constraint if exists booking_requests_capture_type_check;

alter table public.booking_requests
  add constraint booking_requests_capture_type_check
  check (capture_type in ('live_booking', 'expansion_interest'));

alter table public.booking_requests
  alter column capture_type set not null;

create index if not exists idx_booking_requests_capture_type_created
  on public.booking_requests (capture_type, created_at desc);

alter table public.public_vital_ai_submissions
  add column if not exists capture_type text;

update public.public_vital_ai_submissions submission_row
set capture_type = case
  when submission_row.source like 'public_expansion_interest:%'
    or submission_row.source = 'public_expansion_interest'
    or exists (
      select 1
      from public.locations location_row
      where location_row.id = submission_row.preferred_location_id
        and (
          coalesce(location_row.is_placeholder, false) = true
          or location_row.market_status = 'coming_soon'
        )
    ) then 'expansion_interest'
  else 'standard_intake'
end
where submission_row.capture_type is null
   or submission_row.capture_type not in ('standard_intake', 'expansion_interest');

alter table public.public_vital_ai_submissions
  alter column capture_type set default 'standard_intake';

update public.public_vital_ai_submissions
set capture_type = 'standard_intake'
where capture_type is null;

alter table public.public_vital_ai_submissions
  drop constraint if exists public_vital_ai_submissions_capture_type_check;

alter table public.public_vital_ai_submissions
  add constraint public_vital_ai_submissions_capture_type_check
  check (capture_type in ('standard_intake', 'expansion_interest'));

alter table public.public_vital_ai_submissions
  alter column capture_type set not null;

create index if not exists idx_public_vital_ai_submissions_capture_type_created
  on public.public_vital_ai_submissions (capture_type, created_at desc);
