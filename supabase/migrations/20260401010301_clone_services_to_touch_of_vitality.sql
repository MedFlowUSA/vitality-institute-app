with target_location as (
  select id
  from public.locations
  where lower(name) = lower('Touch of Vitality')
    and coalesce(city, '') = 'Los Angeles'
    and coalesce(state, '') = 'CA'
  order by id
  limit 1
),
source_location as (
  select id
  from public.locations
  where id <> (select id from target_location)
  order by name, id
  limit 1
)
insert into public.services (
  name,
  description,
  category,
  service_group,
  location_id,
  requires_consult,
  pricing_unit,
  duration_minutes,
  visit_type,
  price_marketing_cents,
  price_regular_cents,
  is_active
)
select
  source_service.name,
  source_service.description,
  source_service.category,
  source_service.service_group,
  target_location.id,
  source_service.requires_consult,
  source_service.pricing_unit,
  source_service.duration_minutes,
  source_service.visit_type,
  source_service.price_marketing_cents,
  source_service.price_regular_cents,
  coalesce(source_service.is_active, true)
from public.services as source_service
cross join target_location
where source_service.location_id = (select id from source_location)
  and coalesce(source_service.is_active, true)
  and not exists (
    select 1
    from public.services as existing_service
    where existing_service.location_id = target_location.id
      and lower(existing_service.name) = lower(source_service.name)
  );
