alter table public.promotions
  add column if not exists package_id uuid references public.packages(id) on delete set null;

create index if not exists promotions_package_id_idx on public.promotions(package_id);

create table if not exists public.promotion_services (
  promotion_id uuid not null references public.promotions(id) on delete cascade,
  service_id uuid not null references public.services(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (promotion_id, service_id)
);

create index if not exists promotion_services_service_id_idx on public.promotion_services(service_id);

insert into public.promotion_services (promotion_id, service_id)
select p.id, p.service_id
from public.promotions p
where p.service_id is not null
on conflict (promotion_id, service_id) do nothing;

alter table public.promotion_services enable row level security;

create policy "anon read published promotion services"
on public.promotion_services for select to anon
using (
  exists (
    select 1
    from public.promotions p
    where p.id = promotion_id
      and p.status = 'published'
  )
);

create policy "staff read promotion services"
on public.promotion_services for select to authenticated
using (true);

create policy "marketing manage promotion services"
on public.promotion_services for all to authenticated
using (public.is_admin() or public.has_role('marketing'))
with check (public.is_admin() or public.has_role('marketing'));
