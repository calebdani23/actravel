-- First-class quote headers, immutable commercial revisions, provenance, and bounded reads.

-- A global sequence keeps allocation lock-free and collision-safe. The year is a
-- display component; sequence values are never reused or reset at year boundaries.
create sequence if not exists public.quote_number_sequence;

create or replace function public.crm_next_quote_number()
returns text
language sql
volatile
security definer
set search_path = ''
as $function$
  select 'COT-' || to_char(current_date, 'YYYY') || '-' ||
    lpad(nextval('public.quote_number_sequence'::regclass)::text, 6, '0');
$function$;

revoke all on function public.crm_next_quote_number() from public, anon, authenticated, service_role;
revoke all on sequence public.quote_number_sequence from public, anon, authenticated, service_role;

create table if not exists public.quotes (
  id uuid primary key default gen_random_uuid(),
  quote_number text not null default public.crm_next_quote_number(),
  contact_id uuid not null references public.contacts(id) on delete restrict,
  lead_id uuid not null references public.leads(id) on delete restrict,
  title text not null check (nullif(trim(title), '') is not null),
  status text not null default 'draft' check (
    status in ('draft', 'ready', 'sent', 'accepted', 'rejected', 'expired', 'cancelled')
  ),
  owner_id uuid references public.profiles(id) on delete set null,
  created_by uuid references public.profiles(id) on delete set null,
  next_version_number integer not null default 1 check (next_version_number >= 1),
  idempotency_key text,
  lock_version integer not null default 0 check (lock_version >= 0),
  ready_at timestamptz,
  sent_at timestamptz,
  accepted_at timestamptz,
  rejected_at timestamptz,
  expired_at timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  deleted_by uuid references public.profiles(id) on delete set null,
  deleted_reason text,
  constraint quotes_quote_number_key unique (quote_number),
  constraint quotes_quote_number_format_check check (
    quote_number ~ '^COT-[0-9]{4}-[0-9]{6,}$'
  )
);

alter table public.quotes
  alter column quote_number set default public.crm_next_quote_number();

create unique index if not exists quotes_lead_idempotency_key_idx
  on public.quotes(lead_id, idempotency_key)
  where idempotency_key is not null;

create unique index if not exists quotes_one_live_accepted_per_lead_idx
  on public.quotes(lead_id)
  where status = 'accepted' and deleted_at is null;

create index if not exists quotes_updated_cursor_idx
  on public.quotes(updated_at desc, id desc);
create index if not exists quotes_live_status_cursor_idx
  on public.quotes(status, updated_at desc, id desc)
  where deleted_at is null;
create index if not exists quotes_contact_cursor_idx
  on public.quotes(contact_id, updated_at desc, id desc);
create index if not exists quotes_lead_cursor_idx
  on public.quotes(lead_id, updated_at desc, id desc);
create index if not exists quotes_owner_cursor_idx
  on public.quotes(owner_id, updated_at desc, id desc)
  where deleted_at is null;

-- Add the header relationship without changing current callers yet. DEFAULT NULL
-- keeps generated Insert types optional while the BEFORE trigger below fills the
-- value before the NOT NULL check for legacy inserts.
alter table public.quote_versions
  add column if not exists quote_id uuid,
  add column if not exists finalized_at timestamptz,
  add column if not exists finalized_by uuid references public.profiles(id) on delete set null,
  add column if not exists content_sha256 text;

alter table public.quote_versions
  alter column quote_id set default null;

alter table public.quote_versions
  drop constraint if exists quote_versions_status_check,
  drop constraint if exists quote_versions_status_timestamps_coherent;

alter table public.quote_versions
  add constraint quote_versions_status_check check (
    status in ('draft', 'ready', 'sent', 'accepted', 'rejected', 'expired', 'cancelled', 'superseded')
  ) not valid;

-- One deterministic compatibility header is created for every opportunity that
-- already owns legacy quote versions. Contact identity always comes from leads.
with version_rollup as (
  select
    qv.lead_id,
    min(qv.created_at) as created_at,
    max(qv.updated_at) as updated_at,
    max(qv.version_number) + 1 as next_version_number
  from public.quote_versions qv
  group by qv.lead_id
), current_versions as (
  select distinct on (qv.lead_id)
    qv.lead_id,
    qv.id,
    qv.title,
    qv.status,
    qv.created_by,
    qv.sent_at,
    qv.accepted_at,
    qv.rejected_at,
    qv.expired_at
  from public.quote_versions qv
  order by qv.lead_id, qv.version_number desc, qv.updated_at desc, qv.id desc
), accepted_versions as (
  select distinct on (qv.lead_id)
    qv.lead_id,
    qv.id,
    qv.created_by,
    qv.sent_at,
    qv.accepted_at
  from public.quote_versions qv
  where qv.status = 'accepted'
  order by qv.lead_id, qv.accepted_at desc nulls last, qv.version_number desc, qv.id desc
), first_creators as (
  select distinct on (qv.lead_id)
    qv.lead_id,
    qv.created_by
  from public.quote_versions qv
  where qv.created_by is not null
  order by qv.lead_id, qv.created_at, qv.id
)
insert into public.quotes (
  contact_id,
  lead_id,
  title,
  status,
  owner_id,
  created_by,
  next_version_number,
  idempotency_key,
  sent_at,
  accepted_at,
  rejected_at,
  expired_at,
  created_at,
  updated_at
)
select
  l.contact_id,
  l.id,
  cv.title,
  case when av.id is not null then 'accepted' else cv.status end,
  l.assigned_to,
  case
    when exists (
      select 1
      from public.profiles p
      where p.id = coalesce(fc.created_by, cv.created_by, av.created_by)
    ) then coalesce(fc.created_by, cv.created_by, av.created_by)
    else null
  end,
  vr.next_version_number,
  'migration-0053-legacy:' || l.id::text,
  case when av.id is not null then av.sent_at else cv.sent_at end,
  av.accepted_at,
  case when av.id is null and cv.status = 'rejected' then cv.rejected_at end,
  case when av.id is null and cv.status = 'expired' then cv.expired_at end,
  vr.created_at,
  vr.updated_at
from version_rollup vr
join public.leads l on l.id = vr.lead_id
join current_versions cv on cv.lead_id = vr.lead_id
left join accepted_versions av on av.lead_id = vr.lead_id
left join first_creators fc on fc.lead_id = vr.lead_id
on conflict (lead_id, idempotency_key) where idempotency_key is not null do nothing;

-- Preserve historical updated_at values while adding structural provenance.
alter table public.quote_versions disable trigger set_quote_versions_updated_at;

update public.quote_versions qv
set quote_id = q.id
from public.quotes q
where qv.quote_id is null
  and q.lead_id = qv.lead_id
  and q.idempotency_key = 'migration-0053-legacy:' || qv.lead_id::text;

update public.quote_versions qv
set
  finalized_at = coalesce(
    qv.accepted_at,
    qv.rejected_at,
    qv.expired_at,
    qv.sent_at,
    qv.updated_at,
    qv.created_at
  ),
  finalized_by = case
    when exists (select 1 from public.profiles p where p.id = qv.created_by) then qv.created_by
    else null
  end,
  content_sha256 = encode(
    digest(
      convert_to(
        jsonb_build_object(
          'quoteId', qv.quote_id,
          'versionNumber', qv.version_number,
          'title', qv.title,
          'summary', qv.summary,
          'currency', qv.currency,
          'totalAmount', qv.total_amount,
          'depositAmount', qv.deposit_amount,
          'notes', qv.notes,
          'validUntil', qv.valid_until,
          'quoteRequestId', qv.quote_request_id
        )::text,
        'UTF8'
      ),
      'sha256'
    ),
    'hex'
  )
where qv.status <> 'draft'
  and qv.finalized_at is null;

alter table public.quote_versions enable trigger set_quote_versions_updated_at;

alter table public.quote_versions
  drop constraint if exists quote_versions_content_sha256_check,
  add constraint quote_versions_content_sha256_check check (
    content_sha256 is null or content_sha256 ~ '^[0-9a-f]{64}$'
  ) not valid;
alter table public.quote_versions validate constraint quote_versions_content_sha256_check;

alter table public.quote_versions
  drop constraint if exists quote_versions_quote_id_fkey,
  add constraint quote_versions_quote_id_fkey
    foreign key (quote_id) references public.quotes(id) on delete restrict not valid;
alter table public.quote_versions validate constraint quote_versions_quote_id_fkey;
alter table public.quote_versions alter column quote_id set not null;

-- Retain the legacy constraint name because the current application retries on
-- it, while changing the actual uniqueness scope to the first-class quote.
alter table public.quote_versions
  drop constraint if exists quote_versions_unique_per_lead_version,
  add constraint quote_versions_unique_per_lead_version unique (quote_id, version_number);

create unique index if not exists quote_versions_quote_idempotency_key_idx
  on public.quote_versions(quote_id, idempotency_key)
  where idempotency_key is not null;
create unique index if not exists quote_versions_lead_idempotency_key_idx
  on public.quote_versions(lead_id, idempotency_key)
  where idempotency_key is not null;
create index if not exists quote_versions_quote_version_cursor_idx
  on public.quote_versions(quote_id, version_number desc, id desc);
create index if not exists quote_versions_quote_status_idx
  on public.quote_versions(quote_id, status, accepted_at desc, id desc);

alter table public.quotes
  add column if not exists current_version_id uuid,
  add column if not exists accepted_version_id uuid;

alter table public.quotes
  drop constraint if exists quotes_current_version_id_fkey,
  add constraint quotes_current_version_id_fkey
    foreign key (current_version_id) references public.quote_versions(id) on delete restrict not valid,
  drop constraint if exists quotes_accepted_version_id_fkey,
  add constraint quotes_accepted_version_id_fkey
    foreign key (accepted_version_id) references public.quote_versions(id) on delete restrict not valid;

-- The first application leaves pointer columns empty; reruns must not touch a
-- header whose derived pointers and allocator are already current.
with current_versions as (
  select distinct on (qv.quote_id)
    qv.quote_id,
    qv.id
  from public.quote_versions qv
  order by qv.quote_id, qv.version_number desc, qv.updated_at desc, qv.id desc
), accepted_versions as (
  select distinct on (qv.quote_id)
    qv.quote_id,
    qv.id
  from public.quote_versions qv
  where qv.status = 'accepted'
  order by qv.quote_id, qv.accepted_at desc nulls last, qv.version_number desc, qv.id desc
), version_numbers as (
  select qv.quote_id, max(qv.version_number) + 1 as next_version_number
  from public.quote_versions qv
  group by qv.quote_id
)
update public.quotes q
set
  current_version_id = cv.id,
  accepted_version_id = av.id,
  next_version_number = greatest(q.next_version_number, vn.next_version_number)
from current_versions cv
join version_numbers vn on vn.quote_id = cv.quote_id
left join accepted_versions av on av.quote_id = cv.quote_id
where q.id = cv.quote_id
  and (
    q.current_version_id is distinct from cv.id
    or q.accepted_version_id is distinct from av.id
    or q.next_version_number < vn.next_version_number
  );

alter table public.quotes validate constraint quotes_current_version_id_fkey;
alter table public.quotes validate constraint quotes_accepted_version_id_fkey;

create index if not exists quotes_current_version_id_idx
  on public.quotes(current_version_id);
create index if not exists quotes_accepted_version_id_idx
  on public.quotes(accepted_version_id)
  where accepted_version_id is not null;

create or replace function public.crm_enforce_quote_integrity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  canonical_contact_id uuid;
  pointer_quote_id uuid;
  pointer_status text;
  previous_ready_at timestamptz := case when tg_op = 'UPDATE' then old.ready_at else null end;
  previous_sent_at timestamptz := case when tg_op = 'UPDATE' then old.sent_at else null end;
  previous_accepted_at timestamptz := case when tg_op = 'UPDATE' then old.accepted_at else null end;
  previous_rejected_at timestamptz := case when tg_op = 'UPDATE' then old.rejected_at else null end;
  previous_expired_at timestamptz := case when tg_op = 'UPDATE' then old.expired_at else null end;
  previous_cancelled_at timestamptz := case when tg_op = 'UPDATE' then old.cancelled_at else null end;
begin
  if tg_op = 'UPDATE' and (
    new.id is distinct from old.id
    or new.quote_number is distinct from old.quote_number
    or new.contact_id is distinct from old.contact_id
    or new.lead_id is distinct from old.lead_id
    or new.created_by is distinct from old.created_by
    or new.created_at is distinct from old.created_at
    or new.idempotency_key is distinct from old.idempotency_key
  ) then
    raise exception 'Quote identity and opportunity relationships are immutable after creation';
  end if;

  if tg_op = 'UPDATE' and (
    new.next_version_number < old.next_version_number
    or new.lock_version < old.lock_version
  ) then
    raise exception 'Quote allocator and lock versions cannot decrease';
  end if;

  select l.contact_id
  into canonical_contact_id
  from public.leads l
  where l.id = new.lead_id;

  if canonical_contact_id is null then
    raise exception 'Quote opportunity was not found';
  end if;
  if new.contact_id is distinct from canonical_contact_id then
    raise exception 'Quote contact must match the opportunity contact';
  end if;

  if new.current_version_id is not null then
    select qv.quote_id into pointer_quote_id
    from public.quote_versions qv
    where qv.id = new.current_version_id;
    if pointer_quote_id is null or pointer_quote_id is distinct from new.id then
      raise exception 'Current quote version must belong to the same quote';
    end if;
  end if;

  if new.accepted_version_id is not null then
    select qv.quote_id, qv.status into pointer_quote_id, pointer_status
    from public.quote_versions qv
    where qv.id = new.accepted_version_id;
    if pointer_quote_id is null or pointer_quote_id is distinct from new.id or pointer_status <> 'accepted' then
      raise exception 'Accepted quote version must be accepted and belong to the same quote';
    end if;
  end if;

  if new.status = 'draft' then
    new.ready_at := null;
    new.sent_at := null;
    new.accepted_at := null;
    new.rejected_at := null;
    new.expired_at := null;
    new.cancelled_at := null;
  elsif new.status = 'ready' then
    new.ready_at := coalesce(new.ready_at, previous_ready_at, now());
    new.sent_at := null;
    new.accepted_at := null;
    new.rejected_at := null;
    new.expired_at := null;
    new.cancelled_at := null;
  elsif new.status = 'sent' then
    new.ready_at := coalesce(new.ready_at, previous_ready_at);
    new.sent_at := coalesce(new.sent_at, previous_sent_at, now());
    new.accepted_at := null;
    new.rejected_at := null;
    new.expired_at := null;
    new.cancelled_at := null;
  elsif new.status = 'accepted' then
    new.ready_at := coalesce(new.ready_at, previous_ready_at);
    new.sent_at := coalesce(new.sent_at, previous_sent_at);
    new.accepted_at := coalesce(new.accepted_at, previous_accepted_at, now());
    new.rejected_at := null;
    new.expired_at := null;
    new.cancelled_at := null;
  elsif new.status = 'rejected' then
    new.ready_at := coalesce(new.ready_at, previous_ready_at);
    new.sent_at := coalesce(new.sent_at, previous_sent_at);
    new.accepted_at := null;
    new.rejected_at := coalesce(new.rejected_at, previous_rejected_at, now());
    new.expired_at := null;
    new.cancelled_at := null;
  elsif new.status = 'expired' then
    new.ready_at := coalesce(new.ready_at, previous_ready_at);
    new.sent_at := coalesce(new.sent_at, previous_sent_at);
    new.accepted_at := null;
    new.rejected_at := null;
    new.expired_at := coalesce(new.expired_at, previous_expired_at, now());
    new.cancelled_at := null;
  elsif new.status = 'cancelled' then
    new.ready_at := coalesce(new.ready_at, previous_ready_at);
    new.sent_at := coalesce(new.sent_at, previous_sent_at);
    new.accepted_at := null;
    new.rejected_at := null;
    new.expired_at := null;
    new.cancelled_at := coalesce(new.cancelled_at, previous_cancelled_at, now());
  end if;

  return new;
end;
$function$;

revoke all on function public.crm_enforce_quote_integrity() from public, anon, authenticated, service_role;

drop trigger if exists enforce_quote_integrity on public.quotes;
create trigger enforce_quote_integrity
  before insert or update on public.quotes
  for each row execute function public.crm_enforce_quote_integrity();

drop trigger if exists set_quotes_updated_at on public.quotes;
create trigger set_quotes_updated_at
  before update on public.quotes
  for each row execute function public.set_updated_at();

alter table public.quotes
  drop constraint if exists quotes_status_timestamps_coherent,
  add constraint quotes_status_timestamps_coherent check (
    case
      when status = 'draft' then ready_at is null and sent_at is null and accepted_at is null and rejected_at is null and expired_at is null and cancelled_at is null
      when status = 'ready' then ready_at is not null and sent_at is null and accepted_at is null and rejected_at is null and expired_at is null and cancelled_at is null
      when status = 'sent' then sent_at is not null and accepted_at is null and rejected_at is null and expired_at is null and cancelled_at is null
      when status = 'accepted' then accepted_at is not null and rejected_at is null and expired_at is null and cancelled_at is null
      when status = 'rejected' then rejected_at is not null and accepted_at is null and expired_at is null and cancelled_at is null
      when status = 'expired' then expired_at is not null and accepted_at is null and rejected_at is null and cancelled_at is null
      when status = 'cancelled' then cancelled_at is not null and accepted_at is null and rejected_at is null and expired_at is null
      else false
    end
  ) not valid;
alter table public.quotes validate constraint quotes_status_timestamps_coherent;

-- The compatibility trigger validates every relationship, creates only the
-- deterministic legacy stream when quote_id is omitted, and seals content on
-- the first non-draft lifecycle state.
create or replace function public.crm_enforce_quote_version_integrity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  lead_row record;
  quote_row record;
  request_row record;
  actor_profile_id uuid;
  previous_sent_at timestamptz := case when tg_op = 'UPDATE' then old.sent_at else null end;
  previous_accepted_at timestamptz := case when tg_op = 'UPDATE' then old.accepted_at else null end;
  previous_rejected_at timestamptz := case when tg_op = 'UPDATE' then old.rejected_at else null end;
  previous_expired_at timestamptz := case when tg_op = 'UPDATE' then old.expired_at else null end;
begin
  if tg_op = 'UPDATE' and (
    new.id is distinct from old.id
    or new.quote_id is distinct from old.quote_id
    or new.lead_id is distinct from old.lead_id
    or new.contact_id is distinct from old.contact_id
    or new.quote_request_id is distinct from old.quote_request_id
    or new.created_by is distinct from old.created_by
    or new.created_at is distinct from old.created_at
  ) then
    raise exception 'Quote version identity, provenance, and relationships are immutable after creation';
  end if;

  if tg_op = 'UPDATE' and old.finalized_at is not null and (
    new.status = 'draft'
    or new.version_number is distinct from old.version_number
    or new.title is distinct from old.title
    or new.summary is distinct from old.summary
    or new.currency is distinct from old.currency
    or new.total_amount is distinct from old.total_amount
    or new.deposit_amount is distinct from old.deposit_amount
    or new.notes is distinct from old.notes
    or new.valid_until is distinct from old.valid_until
    or new.idempotency_key is distinct from old.idempotency_key
    or new.finalized_at is distinct from old.finalized_at
    or new.finalized_by is distinct from old.finalized_by
    or new.content_sha256 is distinct from old.content_sha256
  ) then
    raise exception 'Finalized quote version commercial content is immutable';
  end if;

  select l.id, l.contact_id, l.assigned_to
  into lead_row
  from public.leads l
  where l.id = new.lead_id;

  if lead_row.id is null then
    raise exception 'Quote version opportunity was not found';
  end if;
  if new.contact_id is distinct from lead_row.contact_id then
    raise exception 'Quote version contact must match the opportunity contact';
  end if;

  if new.quote_id is null then
    insert into public.quotes (
      contact_id,
      lead_id,
      title,
      status,
      owner_id,
      created_by,
      next_version_number,
      idempotency_key,
      sent_at,
      accepted_at,
      rejected_at,
      expired_at,
      created_at,
      updated_at
    ) values (
      lead_row.contact_id,
      new.lead_id,
      new.title,
      case when new.status in ('superseded', 'cancelled') then 'cancelled' else new.status end,
      lead_row.assigned_to,
      case when exists (select 1 from public.profiles p where p.id = new.created_by) then new.created_by end,
      new.version_number + 1,
      'migration-0053-legacy:' || new.lead_id::text,
      new.sent_at,
      new.accepted_at,
      new.rejected_at,
      new.expired_at,
      new.created_at,
      new.updated_at
    )
    on conflict (lead_id, idempotency_key) where idempotency_key is not null do nothing
    returning id, contact_id, lead_id into quote_row;

    if quote_row.id is null then
      select q.id, q.contact_id, q.lead_id
      into quote_row
      from public.quotes q
      where q.lead_id = new.lead_id
        and q.idempotency_key = 'migration-0053-legacy:' || new.lead_id::text;
    end if;

    new.quote_id := quote_row.id;
  else
    select q.id, q.contact_id, q.lead_id
    into quote_row
    from public.quotes q
    where q.id = new.quote_id;
  end if;

  if quote_row.id is null
    or quote_row.lead_id is distinct from new.lead_id
    or quote_row.contact_id is distinct from new.contact_id
  then
    raise exception 'Quote version must belong to the same quote, opportunity, and contact';
  end if;

  if new.quote_request_id is not null then
    select qr.lead_id, qr.contact_id
    into request_row
    from public.quote_requests qr
    where qr.id = new.quote_request_id;

    if request_row.lead_id is null
      or request_row.contact_id is null
      or request_row.lead_id is distinct from new.lead_id
      or request_row.contact_id is distinct from new.contact_id
    then
      raise exception 'Quote version intake request must belong to the same opportunity and contact';
    end if;
  end if;

  if new.status = 'draft' then
    new.sent_at := null;
    new.accepted_at := null;
    new.rejected_at := null;
    new.expired_at := null;
    new.finalized_at := null;
    new.finalized_by := null;
    new.content_sha256 := null;
  elsif new.status = 'sent' then
    new.sent_at := coalesce(new.sent_at, previous_sent_at, now());
    new.accepted_at := null;
    new.rejected_at := null;
    new.expired_at := null;
  elsif new.status = 'accepted' then
    new.sent_at := coalesce(new.sent_at, previous_sent_at);
    new.accepted_at := coalesce(new.accepted_at, previous_accepted_at, now());
    new.rejected_at := null;
    new.expired_at := null;
  elsif new.status = 'rejected' then
    new.sent_at := coalesce(new.sent_at, previous_sent_at);
    new.accepted_at := null;
    new.rejected_at := coalesce(new.rejected_at, previous_rejected_at, now());
    new.expired_at := null;
  elsif new.status = 'expired' then
    new.sent_at := coalesce(new.sent_at, previous_sent_at);
    new.accepted_at := null;
    new.rejected_at := null;
    new.expired_at := coalesce(new.expired_at, previous_expired_at, now());
  elsif new.status = 'ready' then
    new.sent_at := null;
    new.accepted_at := null;
    new.rejected_at := null;
    new.expired_at := null;
  elsif new.status in ('cancelled', 'superseded') then
    new.accepted_at := null;
    new.rejected_at := null;
    new.expired_at := null;
  end if;

  if new.status <> 'draft' and new.finalized_at is null then
    select p.id into actor_profile_id
    from public.profiles p
    where p.id = auth.uid();

    new.finalized_at := now();
    new.finalized_by := coalesce(new.finalized_by, actor_profile_id,
      case when exists (select 1 from public.profiles p where p.id = new.created_by) then new.created_by end);
    new.content_sha256 := encode(
      extensions.digest(
        convert_to(
          jsonb_build_object(
            'quoteId', new.quote_id,
            'versionNumber', new.version_number,
            'title', new.title,
            'summary', new.summary,
            'currency', new.currency,
            'totalAmount', new.total_amount,
            'depositAmount', new.deposit_amount,
            'notes', new.notes,
            'validUntil', new.valid_until,
            'quoteRequestId', new.quote_request_id
          )::text,
          'UTF8'
        ),
        'sha256'
      ),
      'hex'
    );
  end if;

  return new;
end;
$function$;

revoke all on function public.crm_enforce_quote_version_integrity() from public, anon, authenticated, service_role;

drop trigger if exists enforce_quote_version_integrity on public.quote_versions;
create trigger enforce_quote_version_integrity
  before insert or update on public.quote_versions
  for each row execute function public.crm_enforce_quote_version_integrity();

alter table public.quote_versions
  add constraint quote_versions_status_timestamps_coherent check (
    case
      when status = 'draft' then finalized_at is null and sent_at is null and accepted_at is null and rejected_at is null and expired_at is null
      when status = 'ready' then finalized_at is not null and sent_at is null and accepted_at is null and rejected_at is null and expired_at is null
      when status = 'sent' then finalized_at is not null and sent_at is not null and accepted_at is null and rejected_at is null and expired_at is null
      when status = 'accepted' then finalized_at is not null and accepted_at is not null and rejected_at is null and expired_at is null
      when status = 'rejected' then finalized_at is not null and rejected_at is not null and accepted_at is null and expired_at is null
      when status = 'expired' then finalized_at is not null and expired_at is not null and accepted_at is null and rejected_at is null
      when status in ('cancelled', 'superseded') then finalized_at is not null and accepted_at is null and rejected_at is null and expired_at is null
      else false
    end
  ) not valid;
alter table public.quote_versions validate constraint quote_versions_status_check;
alter table public.quote_versions validate constraint quote_versions_status_timestamps_coherent;

create or replace function public.crm_sync_quote_header_from_version()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  current_row record;
  accepted_row record;
  next_number integer;
  header_status text;
begin
  select
    qv.id,
    qv.title,
    qv.status,
    qv.finalized_at,
    qv.sent_at,
    qv.accepted_at,
    qv.rejected_at,
    qv.expired_at
  into current_row
  from public.quote_versions qv
  where qv.quote_id = new.quote_id
  order by qv.version_number desc, qv.updated_at desc, qv.id desc
  limit 1;

  select qv.id, qv.sent_at, qv.accepted_at
  into accepted_row
  from public.quote_versions qv
  where qv.quote_id = new.quote_id
    and qv.status = 'accepted'
  order by qv.accepted_at desc nulls last, qv.version_number desc, qv.id desc
  limit 1;

  select max(qv.version_number) + 1
  into next_number
  from public.quote_versions qv
  where qv.quote_id = new.quote_id;

  header_status := case
    when accepted_row.id is not null then 'accepted'
    when current_row.status = 'superseded' then 'cancelled'
    else current_row.status
  end;

  update public.quotes q
  set
    title = current_row.title,
    status = header_status,
    current_version_id = current_row.id,
    accepted_version_id = accepted_row.id,
    next_version_number = greatest(q.next_version_number, next_number),
    lock_version = q.lock_version + 1,
    ready_at = case when header_status = 'ready' then coalesce(q.ready_at, current_row.finalized_at) else q.ready_at end,
    sent_at = case
      when header_status = 'accepted' then coalesce(accepted_row.sent_at, q.sent_at)
      when header_status in ('sent', 'rejected', 'expired') then coalesce(current_row.sent_at, q.sent_at)
      else q.sent_at
    end,
    accepted_at = case when header_status = 'accepted' then accepted_row.accepted_at end,
    rejected_at = case when header_status = 'rejected' then current_row.rejected_at end,
    expired_at = case when header_status = 'expired' then current_row.expired_at end,
    cancelled_at = case when header_status = 'cancelled' then coalesce(q.cancelled_at, now()) end
  where q.id = new.quote_id;

  return new;
end;
$function$;

revoke all on function public.crm_sync_quote_header_from_version() from public, anon, authenticated, service_role;

drop trigger if exists sync_quote_header_from_version on public.quote_versions;
create trigger sync_quote_header_from_version
  after insert or update on public.quote_versions
  for each row execute function public.crm_sync_quote_header_from_version();

-- Explicit request provenance. No document title/path heuristic appears in this
-- migration, and only already-populated quote_request_id values are backfilled.
create table if not exists public.quote_request_quote_links (
  id uuid primary key default gen_random_uuid(),
  quote_id uuid not null references public.quotes(id) on delete restrict,
  quote_request_id uuid not null references public.quote_requests(id) on delete restrict,
  relation text not null check (relation in ('originating', 'related')),
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint quote_request_quote_links_quote_request_key unique (quote_id, quote_request_id)
);

create index if not exists quote_request_quote_links_quote_cursor_idx
  on public.quote_request_quote_links(quote_id, created_at desc, id desc);
create index if not exists quote_request_quote_links_request_idx
  on public.quote_request_quote_links(quote_request_id, quote_id);

create or replace function public.crm_enforce_quote_request_link_scope()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  quote_row record;
  request_row record;
begin
  if tg_op = 'UPDATE' then
    raise exception 'Quote request provenance links are immutable';
  end if;

  select q.contact_id, q.lead_id into quote_row
  from public.quotes q where q.id = new.quote_id;
  select qr.contact_id, qr.lead_id into request_row
  from public.quote_requests qr where qr.id = new.quote_request_id;

  if quote_row.contact_id is null
    or quote_row.lead_id is null
    or request_row.contact_id is null
    or request_row.lead_id is null
    or request_row.contact_id is distinct from quote_row.contact_id
    or request_row.lead_id is distinct from quote_row.lead_id
  then
    raise exception 'Quote request link must stay within the same contact and opportunity';
  end if;

  return new;
end;
$function$;

revoke all on function public.crm_enforce_quote_request_link_scope() from public, anon, authenticated, service_role;

drop trigger if exists enforce_quote_request_link_scope on public.quote_request_quote_links;
create trigger enforce_quote_request_link_scope
  before insert or update on public.quote_request_quote_links
  for each row execute function public.crm_enforce_quote_request_link_scope();

with explicit_links as (
  select
    qv.quote_id,
    qv.quote_request_id,
    min(qv.version_number) as first_version_number,
    min(qv.created_at) as first_linked_at,
    (array_agg(qv.created_by order by qv.version_number, qv.created_at, qv.id)
      filter (where qv.created_by is not null))[1] as created_by
  from public.quote_versions qv
  where qv.quote_request_id is not null
  group by qv.quote_id, qv.quote_request_id
), ranked_links as (
  select
    el.*,
    row_number() over (
      partition by el.quote_id
      order by el.first_version_number, el.first_linked_at, el.quote_request_id
    ) as relation_rank
  from explicit_links el
)
insert into public.quote_request_quote_links (
  quote_id,
  quote_request_id,
  relation,
  created_by,
  created_at
)
select
  rl.quote_id,
  rl.quote_request_id,
  case when rl.relation_rank = 1 then 'originating' else 'related' end,
  case when exists (select 1 from public.profiles p where p.id = rl.created_by) then rl.created_by end,
  rl.first_linked_at
from ranked_links rl
on conflict (quote_id, quote_request_id) do nothing;

-- Quote events are append-only. All future lifecycle writers must emit events in
-- the same transaction as the mutation.
create table if not exists public.quote_events (
  id uuid primary key default gen_random_uuid(),
  quote_id uuid not null references public.quotes(id) on delete restrict,
  quote_version_id uuid references public.quote_versions(id) on delete restrict,
  contact_id uuid not null references public.contacts(id) on delete restrict,
  lead_id uuid not null references public.leads(id) on delete restrict,
  actor_id uuid references public.profiles(id) on delete set null,
  event_type text not null check (nullif(trim(event_type), '') is not null),
  payload jsonb not null default '{}'::jsonb,
  idempotency_key text,
  created_at timestamptz not null default now()
);

create unique index if not exists quote_events_quote_idempotency_key_idx
  on public.quote_events(quote_id, idempotency_key)
  where idempotency_key is not null;
create index if not exists quote_events_quote_cursor_idx
  on public.quote_events(quote_id, created_at desc, id desc);
create index if not exists quote_events_version_idx
  on public.quote_events(quote_version_id, created_at desc)
  where quote_version_id is not null;
create index if not exists quote_events_lead_cursor_idx
  on public.quote_events(lead_id, created_at desc, id desc);

create or replace function public.crm_enforce_quote_event_scope()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  quote_row record;
  version_quote_id uuid;
begin
  select q.contact_id, q.lead_id into quote_row
  from public.quotes q where q.id = new.quote_id;

  if quote_row.contact_id is null
    or quote_row.lead_id is null
    or new.contact_id is distinct from quote_row.contact_id
    or new.lead_id is distinct from quote_row.lead_id
  then
    raise exception 'Quote event must stay within the quote contact and opportunity';
  end if;

  if new.quote_version_id is not null then
    select qv.quote_id into version_quote_id
    from public.quote_versions qv where qv.id = new.quote_version_id;
    if version_quote_id is null or version_quote_id is distinct from new.quote_id then
      raise exception 'Quote event version must belong to the same quote';
    end if;
  end if;

  return new;
end;
$function$;

create or replace function public.crm_reject_quote_event_mutation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
begin
  raise exception 'Quote events are append-only';
end;
$function$;

revoke all on function public.crm_enforce_quote_event_scope() from public, anon, authenticated, service_role;
revoke all on function public.crm_reject_quote_event_mutation() from public, anon, authenticated, service_role;

drop trigger if exists enforce_quote_event_scope on public.quote_events;
create trigger enforce_quote_event_scope
  before insert on public.quote_events
  for each row execute function public.crm_enforce_quote_event_scope();
drop trigger if exists reject_quote_event_mutation on public.quote_events;
create trigger reject_quote_event_mutation
  before update or delete on public.quote_events
  for each row execute function public.crm_reject_quote_event_mutation();

insert into public.quote_events (
  quote_id,
  quote_version_id,
  contact_id,
  lead_id,
  actor_id,
  event_type,
  payload,
  idempotency_key,
  created_at
)
select
  q.id,
  q.current_version_id,
  q.contact_id,
  q.lead_id,
  null,
  'quote_header_backfilled',
  jsonb_build_object(
    'migration', '0053',
    'versionCount', count(qv.id),
    'requestCount', count(distinct qv.quote_request_id),
    'legacyOpportunityId', q.lead_id
  ),
  'migration-0053-header:' || q.id::text,
  q.created_at
from public.quotes q
join public.quote_versions qv on qv.quote_id = q.id
where q.idempotency_key = 'migration-0053-legacy:' || q.lead_id::text
group by q.id
on conflict (quote_id, idempotency_key) where idempotency_key is not null do nothing;

-- Narrow role helpers keep policy subqueries out of recursive contact/lead RLS.
create or replace function public.crm_can_read_quote(p_quote_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select exists (
    select 1
    from public.quotes q
    join public.leads l on l.id = q.lead_id
    join public.contacts c on c.id = q.contact_id
    where q.id = p_quote_id
      and (
        public.is_admin()
        or (
          (public.has_role('operaciones') or public.has_role('finanzas'))
          and q.deleted_at is null
          and l.deleted_at is null
          and c.deleted_at is null
        )
        or (
          public.has_role('asesor')
          and q.deleted_at is null
          and l.assigned_to = auth.uid()
          and l.deleted_at is null
          and c.deleted_at is null
        )
      )
  );
$function$;

create or replace function public.crm_can_mutate_quote(p_quote_id uuid)
returns boolean
language sql
volatile
security definer
set search_path = ''
as $function$
  select exists (
    select 1
    from public.quotes q
    join public.leads l on l.id = q.lead_id
    join public.contacts c on c.id = q.contact_id
    where q.id = p_quote_id
      and (
        public.is_admin()
        or (
          public.has_role('asesor')
          and q.deleted_at is null
          and l.assigned_to = auth.uid()
          and l.deleted_at is null
          and c.deleted_at is null
        )
      )
  );
$function$;

create or replace function public.crm_quote_profile_label(
  p_quote_id uuid,
  p_profile_id uuid
)
returns text
language sql
stable
security definer
set search_path = ''
as $function$
  select p.full_name
  from public.profiles p
  where p.id = p_profile_id
    and public.crm_can_read_quote(p_quote_id)
    and (
      exists (
        select 1
        from public.quotes q
        where q.id = p_quote_id
          and p.id in (q.owner_id, q.created_by, q.deleted_by)
      )
      or exists (
        select 1
        from public.quote_versions qv
        where qv.quote_id = p_quote_id
          and p.id in (qv.created_by, qv.finalized_by)
      )
      or exists (
        select 1
        from public.quote_request_quote_links qrl
        where qrl.quote_id = p_quote_id
          and qrl.created_by = p.id
      )
      or exists (
        select 1
        from public.quote_events qe
        where qe.quote_id = p_quote_id
          and qe.actor_id = p.id
      )
    );
$function$;

revoke all on function public.crm_can_read_quote(uuid) from public, anon, service_role;
revoke all on function public.crm_can_mutate_quote(uuid) from public, anon, service_role;
revoke all on function public.crm_quote_profile_label(uuid, uuid) from public, anon, service_role;
grant execute on function public.crm_can_read_quote(uuid) to authenticated;
grant execute on function public.crm_can_mutate_quote(uuid) to authenticated;
grant execute on function public.crm_quote_profile_label(uuid, uuid) to authenticated;

alter table public.quotes enable row level security;
alter table public.quote_request_quote_links enable row level security;
alter table public.quote_events enable row level security;

drop policy if exists "quotes read scoped" on public.quotes;
create policy "quotes read scoped"
  on public.quotes for select to authenticated
  using (public.crm_can_read_quote(id));

drop policy if exists "quote request links read scoped" on public.quote_request_quote_links;
create policy "quote request links read scoped"
  on public.quote_request_quote_links for select to authenticated
  using (public.crm_can_read_quote(quote_id));

drop policy if exists "quote events read scoped" on public.quote_events;
create policy "quote events read scoped"
  on public.quote_events for select to authenticated
  using (public.crm_can_read_quote(quote_id));

-- Existing direct version writes remain temporarily available only to the old
-- application path. They are constrained by quote scope and the integrity
-- trigger; new quote headers, links, and events have no direct-write policy.
drop policy if exists "quote versions read scoped" on public.quote_versions;
create policy "quote versions read scoped"
  on public.quote_versions for select to authenticated
  using (public.crm_can_read_quote(quote_id));

drop policy if exists "quote versions insert scoped" on public.quote_versions;
create policy "quote versions insert scoped"
  on public.quote_versions for insert to authenticated
  with check (public.crm_can_mutate_quote(quote_id));

drop policy if exists "quote versions update scoped" on public.quote_versions;
create policy "quote versions update scoped"
  on public.quote_versions for update to authenticated
  using (public.crm_can_mutate_quote(quote_id))
  with check (public.crm_can_mutate_quote(quote_id));

revoke all on table public.quotes, public.quote_request_quote_links, public.quote_events from public, anon, service_role;
revoke insert, update, delete, truncate, references, trigger
  on table public.quotes, public.quote_request_quote_links, public.quote_events
  from authenticated;
grant select on table public.quotes, public.quote_request_quote_links, public.quote_events to authenticated;

-- Preserve the legacy acceptance signature while making its write set quote-aware.
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
set search_path = ''
as $function$
declare
  actor_id uuid := auth.uid();
  actor_role text := coalesce(auth.role(), '');
  actor_admin boolean := false;
  target_version record;
  lead_row record;
  rejected_count integer := 0;
  changed_state boolean := false;
  final_accepted_at timestamptz;
begin
  if p_lead_id is null or p_quote_version_id is null then
    raise exception 'quote version acceptance requires an opportunity and version';
  end if;

  select
    l.id,
    l.contact_id,
    l.assigned_to,
    l.deleted_at,
    c.deleted_at as contact_deleted_at
  into lead_row
  from public.leads l
  join public.contacts c on c.id = l.contact_id
  where l.id = p_lead_id
  for update of l, c;

  if lead_row.id is null then
    raise exception 'Quote version opportunity was not found';
  end if;

  if actor_role <> 'service_role' then
    if actor_id is null then
      raise insufficient_privilege using message = 'Not authorized to accept quote versions';
    end if;
    actor_admin := public.is_admin();
    if not actor_admin and not (
      public.has_role('asesor')
      and lead_row.assigned_to = actor_id
      and lead_row.deleted_at is null
      and lead_row.contact_deleted_at is null
    ) then
      raise insufficient_privilege using message = 'Not authorized to accept quote versions';
    end if;
  end if;

  select qv.id, qv.quote_id, qv.lead_id, qv.contact_id, qv.status,
    qv.title, qv.version_number, qv.accepted_at
  into target_version
  from public.quote_versions qv
  join public.quotes q on q.id = qv.quote_id
  where qv.id = p_quote_version_id
    and qv.lead_id = p_lead_id
    and (actor_admin or actor_role = 'service_role' or q.deleted_at is null)
  for update of qv, q;

  if target_version.id is null then
    raise exception 'Quote version was not found';
  end if;
  if target_version.status not in ('draft', 'ready', 'sent', 'accepted') then
    raise exception 'Quote version cannot be accepted from its current status';
  end if;

  perform 1
  from public.quote_versions qv
  where qv.lead_id = p_lead_id
  for update;

  update public.quote_versions
  set
    status = 'rejected',
    accepted_at = null,
    rejected_at = coalesce(rejected_at, now()),
    expired_at = null,
    updated_at = now()
  where lead_id = p_lead_id
    and id <> target_version.id
    and (
      (quote_id = target_version.quote_id and status in ('draft', 'ready', 'sent', 'accepted'))
      or (quote_id <> target_version.quote_id and status = 'accepted')
    );

  get diagnostics rejected_count = row_count;

  update public.quote_versions
  set
    status = 'accepted',
    accepted_at = coalesce(accepted_at, now()),
    rejected_at = null,
    expired_at = null,
    updated_at = now()
  where id = target_version.id
    and (status is distinct from 'accepted' or accepted_at is null)
  returning accepted_at into final_accepted_at;

  changed_state := rejected_count > 0 or found;

  if changed_state then
    final_accepted_at := coalesce(final_accepted_at, target_version.accepted_at, now());

    insert into public.quote_events (
      quote_id, quote_version_id, contact_id, lead_id, actor_id,
      event_type, payload, idempotency_key
    ) values (
      target_version.quote_id,
      target_version.id,
      target_version.contact_id,
      target_version.lead_id,
      actor_id,
      'quote_version_accepted',
      jsonb_build_object(
        'title', target_version.title,
        'versionNumber', target_version.version_number,
        'rejectedAlternatives', rejected_count
      ),
      'accepted:' || target_version.id::text || ':' || final_accepted_at::text
    )
    on conflict (quote_id, idempotency_key) where idempotency_key is not null do nothing;

    insert into public.lead_events (lead_id, actor_id, event_type, payload)
    values (
      p_lead_id,
      actor_id,
      'quote_version_accepted',
      jsonb_build_object(
        'title', target_version.title,
        'versionNumber', target_version.version_number,
        'statusLabel', 'Aceptada',
        'rejectedAlternatives', rejected_count
      )
    );
  end if;

  return query select target_version.id, rejected_count;
end;
$function$;

revoke all on function public.crm_accept_quote_version(uuid, uuid) from public, anon;
grant execute on function public.crm_accept_quote_version(uuid, uuid) to authenticated;
grant execute on function public.crm_accept_quote_version(uuid, uuid) to service_role;

-- One header per row with independent current/accepted summaries and page-local
-- rollups. No document projection is introduced before the canonical PDF phase.
create or replace function public.crm_quote_page(
  p_limit integer default 50,
  p_after_updated_at timestamptz default null,
  p_after_id uuid default null,
  p_search text default null,
  p_status text default null,
  p_owner_id uuid default null,
  p_contact_id uuid default null,
  p_opportunity_id uuid default null,
  p_currency text default null,
  p_validity text default 'all',
  p_include_deleted boolean default false
)
returns table(
  quote_id uuid,
  quote_number text,
  title text,
  status text,
  contact_id uuid,
  contact_name text,
  contact_email text,
  contact_phone text,
  opportunity_id uuid,
  opportunity_label text,
  owner_id uuid,
  advisor_name text,
  current_version_id uuid,
  current_version_number integer,
  current_version_title text,
  current_version_status text,
  current_currency text,
  current_total_amount numeric,
  current_deposit_amount numeric,
  current_valid_until date,
  current_finalized_at timestamptz,
  current_updated_at timestamptz,
  accepted_version_id uuid,
  accepted_version_number integer,
  accepted_version_title text,
  accepted_version_status text,
  accepted_currency text,
  accepted_total_amount numeric,
  accepted_deposit_amount numeric,
  accepted_valid_until date,
  accepted_accepted_at timestamptz,
  version_count bigint,
  request_count bigint,
  next_version_number integer,
  lock_version integer,
  ready_at timestamptz,
  sent_at timestamptz,
  accepted_at timestamptz,
  rejected_at timestamptz,
  expired_at timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz,
  updated_at timestamptz,
  deleted_at timestamptz,
  deleted_by uuid,
  deleted_reason text,
  page_has_more boolean
)
language plpgsql
stable
security invoker
set search_path = ''
as $function$
begin
  if p_limit is null or p_limit < 1 or p_limit > 100 then
    raise invalid_parameter_value using message = 'p_limit must be between 1 and 100';
  end if;
  if (p_after_updated_at is null) <> (p_after_id is null) then
    raise invalid_parameter_value using message = 'both cursor fields must be provided together';
  end if;
  if p_status is not null and p_status not in ('draft', 'ready', 'sent', 'accepted', 'rejected', 'expired', 'cancelled') then
    raise invalid_parameter_value using message = 'invalid quote status filter';
  end if;
  if p_currency is not null and p_currency not in ('MXN', 'USD') then
    raise invalid_parameter_value using message = 'currency must be MXN or USD';
  end if;
  if p_validity is null or p_validity not in ('all', 'valid', 'expired', 'no_expiry') then
    raise invalid_parameter_value using message = 'validity must be all, valid, expired, or no_expiry';
  end if;

  return query
  with candidate_rows as (
    select q.*
    from public.quotes q
    join public.contacts c on c.id = q.contact_id
    join public.leads l on l.id = q.lead_id
    left join public.quote_versions cv on cv.id = q.current_version_id
    where (p_include_deleted or q.deleted_at is null)
      and (p_status is null or q.status = p_status)
      and (p_owner_id is null or q.owner_id = p_owner_id)
      and (p_contact_id is null or q.contact_id = p_contact_id)
      and (p_opportunity_id is null or q.lead_id = p_opportunity_id)
      and (p_currency is null or cv.currency = p_currency)
      and (
        p_validity = 'all'
        or (p_validity = 'valid' and cv.valid_until >= current_date)
        or (p_validity = 'expired' and cv.valid_until < current_date)
        or (p_validity = 'no_expiry' and cv.valid_until is null)
      )
      and (
        nullif(trim(p_search), '') is null
        or q.quote_number ilike '%' || trim(p_search) || '%'
        or q.title ilike '%' || trim(p_search) || '%'
        or concat_ws(' ', c.first_name, c.last_name, c.email, c.phone) ilike '%' || trim(p_search) || '%'
        or coalesce(l.summary, '') ilike '%' || trim(p_search) || '%'
        or coalesce(public.crm_quote_profile_label(q.id, q.owner_id), '') ilike '%' || trim(p_search) || '%'
      )
      and (
        p_after_updated_at is null
        or q.updated_at < p_after_updated_at
        or (q.updated_at = p_after_updated_at and q.id < p_after_id)
      )
    order by q.updated_at desc, q.id desc
    limit p_limit + 1
  ), page_rows as (
    select cr.* from candidate_rows cr
    order by cr.updated_at desc, cr.id desc
    limit p_limit
  ), page_metadata as (
    select count(*) > p_limit as has_more from candidate_rows
  ), version_rollup as (
    select qv.quote_id, count(*)::bigint as version_count
    from public.quote_versions qv
    join page_rows pr on pr.id = qv.quote_id
    group by qv.quote_id
  ), request_rollup as (
    select qrl.quote_id, count(*)::bigint as request_count
    from public.quote_request_quote_links qrl
    join page_rows pr on pr.id = qrl.quote_id
    group by qrl.quote_id
  )
  select
    pr.id,
    pr.quote_number,
    pr.title,
    pr.status,
    pr.contact_id,
    nullif(trim(concat_ws(' ', c.first_name, c.last_name)), ''),
    c.email,
    c.phone,
    pr.lead_id,
    coalesce(
      nullif(trim(l.summary), ''),
      nullif(concat_ws(' / ', d.name_es, s.name_es), ''),
      'Oportunidad ' || left(l.id::text, 8)
    ),
    pr.owner_id,
    public.crm_quote_profile_label(pr.id, pr.owner_id),
    cv.id,
    cv.version_number,
    cv.title,
    cv.status,
    cv.currency,
    cv.total_amount,
    cv.deposit_amount,
    cv.valid_until,
    cv.finalized_at,
    cv.updated_at,
    av.id,
    av.version_number,
    av.title,
    av.status,
    av.currency,
    av.total_amount,
    av.deposit_amount,
    av.valid_until,
    av.accepted_at,
    coalesce(vr.version_count, 0),
    coalesce(rr.request_count, 0),
    pr.next_version_number,
    pr.lock_version,
    pr.ready_at,
    pr.sent_at,
    pr.accepted_at,
    pr.rejected_at,
    pr.expired_at,
    pr.cancelled_at,
    pr.created_at,
    pr.updated_at,
    pr.deleted_at,
    pr.deleted_by,
    pr.deleted_reason,
    pm.has_more
  from page_rows pr
  cross join page_metadata pm
  join public.contacts c on c.id = pr.contact_id
  join public.leads l on l.id = pr.lead_id
  left join public.destinations d on d.id = l.destination_id
  left join public.services s on s.id = l.service_id
  left join public.quote_versions cv on cv.id = pr.current_version_id
  left join public.quote_versions av on av.id = pr.accepted_version_id
  left join version_rollup vr on vr.quote_id = pr.id
  left join request_rollup rr on rr.quote_id = pr.id
  order by pr.updated_at desc, pr.id desc;
end;
$function$;

create or replace function public.crm_quote_detail(p_quote_id uuid)
returns table(
  quote_id uuid,
  quote_number text,
  title text,
  status text,
  contact_id uuid,
  contact_name text,
  contact_email text,
  contact_phone text,
  opportunity_id uuid,
  opportunity_label text,
  owner_id uuid,
  advisor_name text,
  created_by uuid,
  created_by_name text,
  current_version_id uuid,
  current_version_number integer,
  current_version_title text,
  current_version_status text,
  current_currency text,
  current_total_amount numeric,
  current_deposit_amount numeric,
  current_valid_until date,
  current_finalized_at timestamptz,
  accepted_version_id uuid,
  accepted_version_number integer,
  accepted_version_title text,
  accepted_version_status text,
  accepted_currency text,
  accepted_total_amount numeric,
  accepted_deposit_amount numeric,
  accepted_valid_until date,
  accepted_accepted_at timestamptz,
  version_count bigint,
  request_count bigint,
  event_count bigint,
  originating_request_id uuid,
  originating_request_status text,
  latest_event_type text,
  latest_event_at timestamptz,
  next_version_number integer,
  lock_version integer,
  ready_at timestamptz,
  sent_at timestamptz,
  accepted_at timestamptz,
  rejected_at timestamptz,
  expired_at timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz,
  updated_at timestamptz,
  deleted_at timestamptz,
  deleted_by uuid,
  deleted_by_name text,
  deleted_reason text
)
language sql
stable
security invoker
set search_path = ''
as $function$
  select
    q.id,
    q.quote_number,
    q.title,
    q.status,
    q.contact_id,
    nullif(trim(concat_ws(' ', c.first_name, c.last_name)), ''),
    c.email,
    c.phone,
    q.lead_id,
    coalesce(
      nullif(trim(l.summary), ''),
      nullif(concat_ws(' / ', d.name_es, s.name_es), ''),
      'Oportunidad ' || left(l.id::text, 8)
    ),
    q.owner_id,
    public.crm_quote_profile_label(q.id, q.owner_id),
    q.created_by,
    public.crm_quote_profile_label(q.id, q.created_by),
    cv.id,
    cv.version_number,
    cv.title,
    cv.status,
    cv.currency,
    cv.total_amount,
    cv.deposit_amount,
    cv.valid_until,
    cv.finalized_at,
    av.id,
    av.version_number,
    av.title,
    av.status,
    av.currency,
    av.total_amount,
    av.deposit_amount,
    av.valid_until,
    av.accepted_at,
    coalesce(vc.version_count, 0),
    coalesce(rc.request_count, 0),
    coalesce(ec.event_count, 0),
    origin_link.quote_request_id,
    origin_link.request_status,
    latest_event.event_type,
    latest_event.created_at,
    q.next_version_number,
    q.lock_version,
    q.ready_at,
    q.sent_at,
    q.accepted_at,
    q.rejected_at,
    q.expired_at,
    q.cancelled_at,
    q.created_at,
    q.updated_at,
    q.deleted_at,
    q.deleted_by,
    public.crm_quote_profile_label(q.id, q.deleted_by),
    q.deleted_reason
  from public.quotes q
  join public.contacts c on c.id = q.contact_id
  join public.leads l on l.id = q.lead_id
  left join public.destinations d on d.id = l.destination_id
  left join public.services s on s.id = l.service_id
  left join public.quote_versions cv on cv.id = q.current_version_id
  left join public.quote_versions av on av.id = q.accepted_version_id
  left join lateral (
    select count(*)::bigint as version_count
    from public.quote_versions qv where qv.quote_id = q.id
  ) vc on true
  left join lateral (
    select count(*)::bigint as request_count
    from public.quote_request_quote_links qrl where qrl.quote_id = q.id
  ) rc on true
  left join lateral (
    select count(*)::bigint as event_count
    from public.quote_events qe where qe.quote_id = q.id
  ) ec on true
  left join lateral (
    select qrl.quote_request_id, qr.status as request_status
    from public.quote_request_quote_links qrl
    join public.quote_requests qr on qr.id = qrl.quote_request_id
    where qrl.quote_id = q.id and qrl.relation = 'originating'
    order by qrl.created_at, qrl.id
    limit 1
  ) origin_link on true
  left join lateral (
    select qe.event_type, qe.created_at
    from public.quote_events qe
    where qe.quote_id = q.id
    order by qe.created_at desc, qe.id desc
    limit 1
  ) latest_event on true
  where q.id = p_quote_id;
$function$;

create or replace function public.crm_quote_version_page(
  p_quote_id uuid,
  p_limit integer default 20,
  p_after_version_number integer default null,
  p_after_id uuid default null
)
returns table(
  quote_version_id uuid,
  quote_id uuid,
  version_number integer,
  title text,
  summary text,
  status text,
  currency text,
  total_amount numeric,
  deposit_amount numeric,
  valid_until date,
  notes text,
  quote_request_id uuid,
  finalized_at timestamptz,
  finalized_by uuid,
  finalized_by_name text,
  content_sha256 text,
  sent_at timestamptz,
  accepted_at timestamptz,
  rejected_at timestamptz,
  expired_at timestamptz,
  created_by uuid,
  created_by_name text,
  created_at timestamptz,
  updated_at timestamptz,
  page_has_more boolean
)
language plpgsql
stable
security invoker
set search_path = ''
as $function$
begin
  if p_quote_id is null then
    raise invalid_parameter_value using message = 'p_quote_id is required';
  end if;
  if p_limit is null or p_limit < 1 or p_limit > 100 then
    raise invalid_parameter_value using message = 'p_limit must be between 1 and 100';
  end if;
  if (p_after_version_number is null) <> (p_after_id is null) then
    raise invalid_parameter_value using message = 'both cursor fields must be provided together';
  end if;

  return query
  with candidate_rows as (
    select qv.*
    from public.quote_versions qv
    where qv.quote_id = p_quote_id
      and (
        p_after_version_number is null
        or qv.version_number < p_after_version_number
        or (qv.version_number = p_after_version_number and qv.id < p_after_id)
      )
    order by qv.version_number desc, qv.id desc
    limit p_limit + 1
  ), page_rows as (
    select cr.* from candidate_rows cr
    order by cr.version_number desc, cr.id desc
    limit p_limit
  ), page_metadata as (
    select count(*) > p_limit as has_more from candidate_rows
  )
  select
    pr.id,
    pr.quote_id,
    pr.version_number,
    pr.title,
    pr.summary,
    pr.status,
    pr.currency,
    pr.total_amount,
    pr.deposit_amount,
    pr.valid_until,
    pr.notes,
    pr.quote_request_id,
    pr.finalized_at,
    pr.finalized_by,
    public.crm_quote_profile_label(pr.quote_id, pr.finalized_by),
    pr.content_sha256,
    pr.sent_at,
    pr.accepted_at,
    pr.rejected_at,
    pr.expired_at,
    pr.created_by,
    public.crm_quote_profile_label(pr.quote_id, pr.created_by),
    pr.created_at,
    pr.updated_at,
    pm.has_more
  from page_rows pr
  cross join page_metadata pm
  order by pr.version_number desc, pr.id desc;
end;
$function$;

create or replace function public.crm_quote_request_link_page(
  p_quote_id uuid,
  p_limit integer default 20,
  p_after_created_at timestamptz default null,
  p_after_id uuid default null
)
returns table(
  link_id uuid,
  quote_id uuid,
  quote_request_id uuid,
  relation text,
  request_status text,
  request_locale text,
  destination_slug text,
  service_slug text,
  request_created_at timestamptz,
  linked_by uuid,
  linked_by_name text,
  linked_at timestamptz,
  page_has_more boolean
)
language plpgsql
stable
security invoker
set search_path = ''
as $function$
begin
  if p_quote_id is null then
    raise invalid_parameter_value using message = 'p_quote_id is required';
  end if;
  if p_limit is null or p_limit < 1 or p_limit > 100 then
    raise invalid_parameter_value using message = 'p_limit must be between 1 and 100';
  end if;
  if (p_after_created_at is null) <> (p_after_id is null) then
    raise invalid_parameter_value using message = 'both cursor fields must be provided together';
  end if;

  return query
  with candidate_rows as (
    select qrl.*
    from public.quote_request_quote_links qrl
    where qrl.quote_id = p_quote_id
      and (
        p_after_created_at is null
        or qrl.created_at < p_after_created_at
        or (qrl.created_at = p_after_created_at and qrl.id < p_after_id)
      )
    order by qrl.created_at desc, qrl.id desc
    limit p_limit + 1
  ), page_rows as (
    select cr.* from candidate_rows cr
    order by cr.created_at desc, cr.id desc
    limit p_limit
  ), page_metadata as (
    select count(*) > p_limit as has_more from candidate_rows
  )
  select
    pr.id,
    pr.quote_id,
    pr.quote_request_id,
    pr.relation,
    qr.status,
    qr.locale,
    qr.destination_slug,
    qr.service_slug,
    qr.created_at,
    pr.created_by,
    public.crm_quote_profile_label(pr.quote_id, pr.created_by),
    pr.created_at,
    pm.has_more
  from page_rows pr
  cross join page_metadata pm
  join public.quote_requests qr on qr.id = pr.quote_request_id
  order by pr.created_at desc, pr.id desc;
end;
$function$;

create or replace function public.crm_quote_event_page(
  p_quote_id uuid,
  p_limit integer default 50,
  p_after_created_at timestamptz default null,
  p_after_id uuid default null
)
returns table(
  event_id uuid,
  quote_id uuid,
  quote_version_id uuid,
  actor_id uuid,
  actor_name text,
  event_type text,
  payload jsonb,
  created_at timestamptz,
  page_has_more boolean
)
language plpgsql
stable
security invoker
set search_path = ''
as $function$
begin
  if p_quote_id is null then
    raise invalid_parameter_value using message = 'p_quote_id is required';
  end if;
  if p_limit is null or p_limit < 1 or p_limit > 100 then
    raise invalid_parameter_value using message = 'p_limit must be between 1 and 100';
  end if;
  if (p_after_created_at is null) <> (p_after_id is null) then
    raise invalid_parameter_value using message = 'both cursor fields must be provided together';
  end if;

  return query
  with candidate_rows as (
    select qe.*
    from public.quote_events qe
    where qe.quote_id = p_quote_id
      and (
        p_after_created_at is null
        or qe.created_at < p_after_created_at
        or (qe.created_at = p_after_created_at and qe.id < p_after_id)
      )
    order by qe.created_at desc, qe.id desc
    limit p_limit + 1
  ), page_rows as (
    select cr.* from candidate_rows cr
    order by cr.created_at desc, cr.id desc
    limit p_limit
  ), page_metadata as (
    select count(*) > p_limit as has_more from candidate_rows
  )
  select
    pr.id,
    pr.quote_id,
    pr.quote_version_id,
    pr.actor_id,
    public.crm_quote_profile_label(pr.quote_id, pr.actor_id),
    pr.event_type,
    pr.payload,
    pr.created_at,
    pm.has_more
  from page_rows pr
  cross join page_metadata pm
  order by pr.created_at desc, pr.id desc;
end;
$function$;

revoke all on function public.crm_quote_page(integer, timestamptz, uuid, text, text, uuid, uuid, uuid, text, text, boolean) from public, anon, service_role;
revoke all on function public.crm_quote_detail(uuid) from public, anon, service_role;
revoke all on function public.crm_quote_version_page(uuid, integer, integer, uuid) from public, anon, service_role;
revoke all on function public.crm_quote_request_link_page(uuid, integer, timestamptz, uuid) from public, anon, service_role;
revoke all on function public.crm_quote_event_page(uuid, integer, timestamptz, uuid) from public, anon, service_role;

grant execute on function public.crm_quote_page(integer, timestamptz, uuid, text, text, uuid, uuid, uuid, text, text, boolean) to authenticated;
grant execute on function public.crm_quote_detail(uuid) to authenticated;
grant execute on function public.crm_quote_version_page(uuid, integer, integer, uuid) to authenticated;
grant execute on function public.crm_quote_request_link_page(uuid, integer, timestamptz, uuid) to authenticated;
grant execute on function public.crm_quote_event_page(uuid, integer, timestamptz, uuid) to authenticated;
