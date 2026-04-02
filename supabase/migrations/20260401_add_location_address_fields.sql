alter table public.locations
  add column if not exists address_line1 text,
  add column if not exists address_line2 text,
  add column if not exists zip text;

update public.locations
set
  address_line1 = '931 N Vignes St',
  city = 'Los Angeles',
  state = 'CA',
  zip = '90012'
where lower(name) = lower('Touch of Vitality')
  and coalesce(city, 'Los Angeles') = 'Los Angeles'
  and coalesce(state, 'CA') = 'CA';
