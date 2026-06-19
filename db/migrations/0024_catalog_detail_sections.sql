alter table public.destinations
  add column if not exists detail_sections_es jsonb,
  add column if not exists detail_sections_en jsonb;

alter table public.services
  add column if not exists detail_sections_es jsonb,
  add column if not exists detail_sections_en jsonb;

alter table public.packages
  add column if not exists detail_sections_es jsonb,
  add column if not exists detail_sections_en jsonb;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'destinations_detail_sections_es_is_array') then
    alter table public.destinations add constraint destinations_detail_sections_es_is_array check (detail_sections_es is null or jsonb_typeof(detail_sections_es) = 'array');
  end if;
  if not exists (select 1 from pg_constraint where conname = 'destinations_detail_sections_en_is_array') then
    alter table public.destinations add constraint destinations_detail_sections_en_is_array check (detail_sections_en is null or jsonb_typeof(detail_sections_en) = 'array');
  end if;
  if not exists (select 1 from pg_constraint where conname = 'services_detail_sections_es_is_array') then
    alter table public.services add constraint services_detail_sections_es_is_array check (detail_sections_es is null or jsonb_typeof(detail_sections_es) = 'array');
  end if;
  if not exists (select 1 from pg_constraint where conname = 'services_detail_sections_en_is_array') then
    alter table public.services add constraint services_detail_sections_en_is_array check (detail_sections_en is null or jsonb_typeof(detail_sections_en) = 'array');
  end if;
  if not exists (select 1 from pg_constraint where conname = 'packages_detail_sections_es_is_array') then
    alter table public.packages add constraint packages_detail_sections_es_is_array check (detail_sections_es is null or jsonb_typeof(detail_sections_es) = 'array');
  end if;
  if not exists (select 1 from pg_constraint where conname = 'packages_detail_sections_en_is_array') then
    alter table public.packages add constraint packages_detail_sections_en_is_array check (detail_sections_en is null or jsonb_typeof(detail_sections_en) = 'array');
  end if;
end $$;
