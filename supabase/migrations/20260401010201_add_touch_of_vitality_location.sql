insert into public.locations (name, city, state, is_active)
select
  'Touch of Vitality',
  'Los Angeles',
  'CA',
  true
where not exists (
  select 1
  from public.locations
  where lower(name) = lower('Touch of Vitality')
    and coalesce(city, '') = 'Los Angeles'
    and coalesce(state, '') = 'CA'
);

with target_location as (
  select id
  from public.locations
  where lower(name) = lower('Touch of Vitality')
    and coalesce(city, '') = 'Los Angeles'
    and coalesce(state, '') = 'CA'
  order by id
  limit 1
)
insert into public.location_hours (
  location_id,
  day_of_week,
  open_time,
  close_time,
  slot_minutes,
  is_closed
)
select
  target_location.id,
  days.day_of_week,
  '09:00:00',
  '17:00:00',
  30,
  days.day_of_week in (0, 6)
from target_location
cross join (
  values (0), (1), (2), (3), (4), (5), (6)
) as days(day_of_week)
on conflict (location_id, day_of_week) do nothing;
