-- Durable, non-cascading audit/job records for CRM bulk mutations.

create table if not exists public.crm_bulk_mutation_jobs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.profiles(id) on delete set null,
  operation text not null,
  requested_count integer not null default 0,
  success_count integer not null default 0,
  failure_count integer not null default 0,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  metadata jsonb not null default '{}'::jsonb
);
create table if not exists public.crm_bulk_mutation_items (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.crm_bulk_mutation_jobs(id) on delete cascade,
  entity_type text not null check (entity_type in ('contact', 'opportunity')),
  entity_id uuid not null,
  outcome text not null check (outcome in ('succeeded', 'failed')),
  error_code text,
  error_message text,
  before_state jsonb,
  after_state jsonb,
  created_at timestamptz not null default now()
);
create index if not exists crm_bulk_jobs_created_at_idx on public.crm_bulk_mutation_jobs(created_at desc);
create index if not exists crm_bulk_items_job_id_idx on public.crm_bulk_mutation_items(job_id);
create index if not exists crm_bulk_items_entity_idx on public.crm_bulk_mutation_items(entity_type, entity_id);
alter table public.crm_bulk_mutation_jobs enable row level security;
alter table public.crm_bulk_mutation_items enable row level security;
drop policy if exists "crm bulk jobs admin read" on public.crm_bulk_mutation_jobs;
create policy "crm bulk jobs admin read" on public.crm_bulk_mutation_jobs for select to authenticated using (public.is_admin());
drop policy if exists "crm bulk items admin read" on public.crm_bulk_mutation_items;
create policy "crm bulk items admin read" on public.crm_bulk_mutation_items for select to authenticated using (public.is_admin());
