create table if not exists public.packages (
  id uuid primary key default gen_random_uuid(),
  name_es text not null,
  name_en text not null,
  slug_es text not null unique,
  slug_en text not null unique,
  summary_es text,
  summary_en text,
  description_es text,
  description_en text,
  hero_image_url text,
  thumbnail_image_url text,
  price_from_mxn numeric(12,2) check (price_from_mxn is null or price_from_mxn >= 0),
  price_from_usd numeric(12,2) check (price_from_usd is null or price_from_usd >= 0),
  sort_order integer not null default 0,
  is_featured boolean not null default false,
  status text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.packages enable row level security;

grant select on public.packages to anon, authenticated;
grant insert, update, delete on public.packages to authenticated;

do $$
begin
  if not exists (
    select 1
    from pg_trigger
    where tgname = 'set_packages_updated_at'
      and tgrelid = 'public.packages'::regclass
  ) then
    create trigger set_packages_updated_at before update on public.packages for each row execute function public.set_updated_at();
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'packages' and policyname = 'anon read published packages'
  ) then
    create policy "anon read published packages" on public.packages for select to anon using (status = 'published');
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'packages' and policyname = 'staff read packages'
  ) then
    create policy "staff read packages" on public.packages for select to authenticated using (true);
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'packages' and policyname = 'marketing manage packages'
  ) then
    create policy "marketing manage packages" on public.packages for all to authenticated using (public.is_admin() or public.has_role('marketing')) with check (public.is_admin() or public.has_role('marketing'));
  end if;
end
$$;
