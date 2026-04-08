update public.locations
set
  address_line1 = '931 N Vignes St',
  address_line2 = 'Suite 102-8',
  city = 'Los Angeles',
  state = 'CA',
  zip = '90012'
where lower(name) in ('touch of vitality', 'touch of vitality - los angeles', 'touch of vitality los angeles')
  and coalesce(city, 'Los Angeles') = 'Los Angeles';
