alter table public.promotions
  add column if not exists commercial_sections_es jsonb,
  add column if not exists commercial_sections_en jsonb;

comment on column public.promotions.commercial_sections_es is 'Promotion-only structured commercial offer content for Spanish public detail pages.';
comment on column public.promotions.commercial_sections_en is 'Promotion-only structured commercial offer content for English public detail pages.';

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'promotions_commercial_sections_es_is_object') then
    alter table public.promotions add constraint promotions_commercial_sections_es_is_object check (commercial_sections_es is null or jsonb_typeof(commercial_sections_es) = 'object');
  end if;
  if not exists (select 1 from pg_constraint where conname = 'promotions_commercial_sections_en_is_object') then
    alter table public.promotions add constraint promotions_commercial_sections_en_is_object check (commercial_sections_en is null or jsonb_typeof(commercial_sections_en) = 'object');
  end if;
end $$;
