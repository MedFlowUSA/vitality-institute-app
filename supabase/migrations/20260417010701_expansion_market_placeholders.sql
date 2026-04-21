alter table public.clinics
  add column if not exists is_placeholder boolean not null default false,
  add column if not exists market_status text not null default 'live',
  add column if not exists display_priority integer not null default 100;

alter table public.locations
  add column if not exists is_placeholder boolean not null default false,
  add column if not exists market_status text not null default 'live',
  add column if not exists display_priority integer not null default 100;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'clinics_market_status_check'
  ) then
    alter table public.clinics
      add constraint clinics_market_status_check
      check (market_status in ('live', 'coming_soon'));
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'locations_market_status_check'
  ) then
    alter table public.locations
      add constraint locations_market_status_check
      check (market_status in ('live', 'coming_soon'));
  end if;
end
$$;

create index if not exists idx_clinics_market_priority
  on public.clinics (market_status, display_priority, name);

create index if not exists idx_locations_market_priority
  on public.locations (market_status, display_priority, name);

update public.clinics
set
  is_placeholder = false,
  market_status = 'live',
  display_priority = case
    when display_priority <= 0 then 1
    else least(display_priority, 10)
  end
where coalesce(is_placeholder, false) = false;

update public.locations
set
  is_placeholder = false,
  market_status = 'live',
  display_priority = case
    when lower(coalesce(city, '')) = 'redlands' then 1
    when lower(coalesce(city, '')) = 'los angeles' then 2
    when display_priority <= 0 then 100
    else display_priority
  end
where coalesce(is_placeholder, false) = false;

with markets(city, state, display_priority) as (
  values
    ('San Diego', 'CA', 100),
    ('San Francisco', 'CA', 101),
    ('San Jose', 'CA', 102),
    ('Sacramento', 'CA', 103),
    ('Fresno', 'CA', 104),
    ('Phoenix', 'AZ', 105),
    ('Scottsdale', 'AZ', 106),
    ('Las Vegas', 'NV', 107),
    ('Reno', 'NV', 108),
    ('Seattle', 'WA', 109),
    ('Tacoma', 'WA', 110),
    ('Portland', 'OR', 111),
    ('Boise', 'ID', 112),
    ('Salt Lake City', 'UT', 113),
    ('Denver', 'CO', 114),
    ('Colorado Springs', 'CO', 115),
    ('Albuquerque', 'NM', 116),
    ('Dallas', 'TX', 117),
    ('Fort Worth', 'TX', 118),
    ('Houston', 'TX', 119),
    ('Austin', 'TX', 120),
    ('San Antonio', 'TX', 121),
    ('El Paso', 'TX', 122),
    ('Oklahoma City', 'OK', 123),
    ('Kansas City', 'MO', 124),
    ('St. Louis', 'MO', 125),
    ('Omaha', 'NE', 126),
    ('Minneapolis', 'MN', 127),
    ('Chicago', 'IL', 128),
    ('Indianapolis', 'IN', 129),
    ('Detroit', 'MI', 130),
    ('Cleveland', 'OH', 131),
    ('Columbus', 'OH', 132),
    ('Cincinnati', 'OH', 133),
    ('Nashville', 'TN', 134),
    ('Atlanta', 'GA', 135),
    ('Miami', 'FL', 136),
    ('Orlando', 'FL', 137),
    ('Tampa', 'FL', 138),
    ('Jacksonville', 'FL', 139),
    ('Charlotte', 'NC', 140),
    ('Raleigh', 'NC', 141),
    ('Washington', 'DC', 142),
    ('Philadelphia', 'PA', 143),
    ('Pittsburgh', 'PA', 144),
    ('Newark', 'NJ', 145),
    ('New York', 'NY', 146),
    ('Boston', 'MA', 147),
    ('New Orleans', 'LA', 148),
    ('Baltimore', 'MD', 149)
)
update public.locations as location
set
  name = concat('Vitality Institute of ', markets.city),
  is_active = false,
  is_placeholder = true,
  market_status = 'coming_soon',
  display_priority = markets.display_priority
from markets
where lower(coalesce(location.city, '')) = lower(markets.city)
  and upper(coalesce(location.state, '')) = markets.state
  and coalesce(location.is_placeholder, false) = true;

with markets(city, state, display_priority) as (
  values
    ('San Diego', 'CA', 100),
    ('San Francisco', 'CA', 101),
    ('San Jose', 'CA', 102),
    ('Sacramento', 'CA', 103),
    ('Fresno', 'CA', 104),
    ('Phoenix', 'AZ', 105),
    ('Scottsdale', 'AZ', 106),
    ('Las Vegas', 'NV', 107),
    ('Reno', 'NV', 108),
    ('Seattle', 'WA', 109),
    ('Tacoma', 'WA', 110),
    ('Portland', 'OR', 111),
    ('Boise', 'ID', 112),
    ('Salt Lake City', 'UT', 113),
    ('Denver', 'CO', 114),
    ('Colorado Springs', 'CO', 115),
    ('Albuquerque', 'NM', 116),
    ('Dallas', 'TX', 117),
    ('Fort Worth', 'TX', 118),
    ('Houston', 'TX', 119),
    ('Austin', 'TX', 120),
    ('San Antonio', 'TX', 121),
    ('El Paso', 'TX', 122),
    ('Oklahoma City', 'OK', 123),
    ('Kansas City', 'MO', 124),
    ('St. Louis', 'MO', 125),
    ('Omaha', 'NE', 126),
    ('Minneapolis', 'MN', 127),
    ('Chicago', 'IL', 128),
    ('Indianapolis', 'IN', 129),
    ('Detroit', 'MI', 130),
    ('Cleveland', 'OH', 131),
    ('Columbus', 'OH', 132),
    ('Cincinnati', 'OH', 133),
    ('Nashville', 'TN', 134),
    ('Atlanta', 'GA', 135),
    ('Miami', 'FL', 136),
    ('Orlando', 'FL', 137),
    ('Tampa', 'FL', 138),
    ('Jacksonville', 'FL', 139),
    ('Charlotte', 'NC', 140),
    ('Raleigh', 'NC', 141),
    ('Washington', 'DC', 142),
    ('Philadelphia', 'PA', 143),
    ('Pittsburgh', 'PA', 144),
    ('Newark', 'NJ', 145),
    ('New York', 'NY', 146),
    ('Boston', 'MA', 147),
    ('New Orleans', 'LA', 148),
    ('Baltimore', 'MD', 149)
)
insert into public.locations (
  name,
  city,
  state,
  is_active,
  is_placeholder,
  market_status,
  display_priority
)
select
  concat('Vitality Institute of ', markets.city),
  markets.city,
  markets.state,
  false,
  true,
  'coming_soon',
  markets.display_priority
from markets
where not exists (
  select 1
  from public.locations as location
  where lower(coalesce(location.city, '')) = lower(markets.city)
    and upper(coalesce(location.state, '')) = markets.state
    and coalesce(location.is_placeholder, false) = true
);
