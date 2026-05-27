create table public.destinations (
  id uuid primary key default gen_random_uuid(),
  name_es text not null,
  name_en text not null,
  slug_es text not null unique,
  slug_en text not null unique,
  summary_es text,
  summary_en text,
  description_es text,
  description_en text,
  country text not null default 'México',
  region text,
  hero_image_url text,
  is_featured boolean not null default false,
  status text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger set_destinations_updated_at before update on public.destinations for each row execute function public.set_updated_at();

create table public.services (
  id uuid primary key default gen_random_uuid(),
  name_es text not null,
  name_en text not null,
  slug_es text not null unique,
  slug_en text not null unique,
  summary_es text,
  summary_en text,
  description_es text,
  description_en text,
  price_from_mxn numeric(12,2) check (price_from_mxn is null or price_from_mxn >= 0),
  price_from_usd numeric(12,2) check (price_from_usd is null or price_from_usd >= 0),
  sort_order integer not null default 0,
  is_featured boolean not null default false,
  status text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger set_services_updated_at before update on public.services for each row execute function public.set_updated_at();

create table public.promotions (
  id uuid primary key default gen_random_uuid(),
  destination_id uuid references public.destinations(id) on delete set null,
  service_id uuid references public.services(id) on delete set null,
  title_es text not null,
  title_en text not null,
  slug_es text not null unique,
  slug_en text not null unique,
  summary_es text,
  summary_en text,
  details_es text,
  details_en text,
  price_from_mxn numeric(12,2) check (price_from_mxn is null or price_from_mxn >= 0),
  price_from_usd numeric(12,2) check (price_from_usd is null or price_from_usd >= 0),
  starts_at timestamptz,
  ends_at timestamptz,
  is_featured boolean not null default false,
  status text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint promotions_date_range_check check (ends_at is null or starts_at is null or ends_at > starts_at)
);

create trigger set_promotions_updated_at before update on public.promotions for each row execute function public.set_updated_at();
create index promotions_destination_id_idx on public.promotions(destination_id);
create index promotions_service_id_idx on public.promotions(service_id);

create table public.promotion_media (
  id uuid primary key default gen_random_uuid(),
  promotion_id uuid references public.promotions(id) on delete cascade,
  destination_id uuid references public.destinations(id) on delete cascade,
  service_id uuid references public.services(id) on delete cascade,
  bucket text not null default 'catalog-media',
  path text not null,
  alt_es text,
  alt_en text,
  media_type text not null default 'image' check (media_type in ('image', 'video')),
  sort_order integer not null default 0,
  is_public boolean not null default true,
  created_at timestamptz not null default now(),
  constraint promotion_media_owner_check check (num_nonnulls(promotion_id, destination_id, service_id) = 1),
  unique (bucket, path)
);

alter table public.leads
  add constraint leads_destination_id_fkey foreign key (destination_id) references public.destinations(id) on delete set null,
  add constraint leads_service_id_fkey foreign key (service_id) references public.services(id) on delete set null;
