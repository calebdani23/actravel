create table public.public_rate_limits (
  id uuid primary key default gen_random_uuid(),
  scope text not null,
  key_hash text not null,
  window_start timestamptz not null,
  count integer not null default 1 check (count > 0),
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  context_hash text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint public_rate_limits_unique_window unique (scope, key_hash, window_start)
);

create index public_rate_limits_scope_window_idx on public.public_rate_limits(scope, window_start desc);
create index public_rate_limits_cleanup_idx on public.public_rate_limits(window_start);

alter table public.public_rate_limits enable row level security;

create policy "public rate limits staff read" on public.public_rate_limits
  for select to authenticated
  using (public.is_admin() or public.has_role('marketing'));

create or replace function public.set_public_rate_limits_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger set_public_rate_limits_updated_at
  before update on public.public_rate_limits
  for each row
  execute function public.set_public_rate_limits_updated_at();
