-- Commercial quote versions inside each CRM opportunity.

create table public.quote_versions (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads(id) on delete restrict,
  contact_id uuid not null references public.contacts(id) on delete restrict,
  quote_request_id uuid references public.quote_requests(id) on delete set null,
  idempotency_key text,
  version_number integer not null check (version_number > 0),
  title text not null check (nullif(trim(title), '') is not null),
  summary text,
  currency text not null check (currency in ('MXN', 'USD')),
  total_amount numeric check (total_amount is null or total_amount >= 0),
  deposit_amount numeric check (
    deposit_amount is null
    or deposit_amount >= 0
  ),
  notes text,
  status text not null default 'draft' check (status in ('draft', 'sent', 'accepted', 'rejected', 'expired')),
  valid_until date,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  sent_at timestamptz,
  accepted_at timestamptz,
  rejected_at timestamptz,
  expired_at timestamptz,
  constraint quote_versions_amounts_check check (
    total_amount is null
    or deposit_amount is null
    or deposit_amount <= total_amount
  ),
  constraint quote_versions_unique_per_lead_version unique (lead_id, version_number)
);

create trigger set_quote_versions_updated_at
  before update on public.quote_versions
  for each row
  execute function public.set_updated_at();

create index quote_versions_lead_created_idx
  on public.quote_versions(lead_id, created_at desc);

create unique index quote_versions_one_accepted_per_lead_idx
  on public.quote_versions(lead_id)
  where status = 'accepted';

create unique index quote_versions_lead_idempotency_key_idx
  on public.quote_versions(lead_id, idempotency_key)
  where idempotency_key is not null;

alter table public.quote_versions enable row level security;

create policy "quote versions read scoped"
  on public.quote_versions
  for select
  to authenticated
  using (
    public.is_admin()
    or public.has_role('operaciones')
    or public.has_role('finanzas')
    or public.is_assigned_lead(lead_id)
  );

create policy "quote versions insert scoped"
  on public.quote_versions
  for insert
  to authenticated
  with check (
    public.is_admin()
    or public.is_assigned_lead(lead_id)
  );

create policy "quote versions update scoped"
  on public.quote_versions
  for update
  to authenticated
  using (
    public.is_admin()
    or public.is_assigned_lead(lead_id)
  )
  with check (
    public.is_admin()
    or public.is_assigned_lead(lead_id)
  );

create or replace function public.crm_accept_quote_version(
  p_lead_id uuid,
  p_quote_version_id uuid
)
returns table(
  accepted_version_id uuid,
  rejected_version_count integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_id uuid := auth.uid();
  actor_role text := auth.role();
  target_version record;
  lead_row record;
  rejected_count integer := 0;
begin
  if p_lead_id is null or p_quote_version_id is null then
    raise exception 'quote version acceptance requires a lead and version';
  end if;

  if actor_role <> 'service_role' then
    if actor_id is null then
      raise insufficient_privilege using message = 'Not authorized to accept quote versions';
    end if;

    if not (public.is_admin() or public.is_assigned_lead(p_lead_id)) then
      raise insufficient_privilege using message = 'Not authorized to accept quote versions';
    end if;
  end if;

  select l.id, l.contact_id
  into lead_row
  from public.leads l
  where l.id = p_lead_id
  for update;

  if lead_row.id is null then
    raise exception 'Quote version lead was not found';
  end if;

  select qv.id, qv.lead_id, qv.status
  into target_version
  from public.quote_versions qv
  where qv.id = p_quote_version_id
    and qv.lead_id = p_lead_id
  for update;

  if target_version.id is null then
    raise exception 'Quote version was not found';
  end if;

  if target_version.status not in ('draft', 'sent', 'accepted') then
    raise exception 'Quote version cannot be accepted from its current status';
  end if;

  update public.quote_versions
  set status = 'accepted',
      accepted_at = coalesce(accepted_at, now()),
      rejected_at = null,
      expired_at = null,
      updated_at = now()
  where id = target_version.id;

  update public.quote_versions
  set status = 'rejected',
      rejected_at = coalesce(rejected_at, now()),
      updated_at = now()
  where lead_id = p_lead_id
    and id <> target_version.id
    and status in ('draft', 'sent');

  get diagnostics rejected_count = row_count;

  return query
    select target_version.id, rejected_count;
end;
$$;

revoke all on function public.crm_accept_quote_version(uuid, uuid) from public;
revoke all on function public.crm_accept_quote_version(uuid, uuid) from anon;
grant execute on function public.crm_accept_quote_version(uuid, uuid) to authenticated;
grant execute on function public.crm_accept_quote_version(uuid, uuid) to service_role;
