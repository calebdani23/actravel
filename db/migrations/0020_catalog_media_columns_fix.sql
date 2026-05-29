alter table public.destinations
  add column if not exists hero_image_url text,
  add column if not exists thumbnail_image_url text;

alter table public.services
  add column if not exists hero_image_url text,
  add column if not exists thumbnail_image_url text;

alter table public.packages
  add column if not exists hero_image_url text,
  add column if not exists thumbnail_image_url text;

alter table public.promotions
  add column if not exists hero_image_url text,
  add column if not exists thumbnail_image_url text;