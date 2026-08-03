-- Mandatory initial-PDF quote registration with durable pre-creation recovery.

create table if not exists public.quote_registration_intents (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid not null references public.profiles(id) on delete restrict,
  contact_id uuid not null references public.contacts(id) on delete restrict,
  opportunity_id uuid not null references public.leads(id) on delete restrict,
  originating_request_id uuid references public.quote_requests(id) on delete restrict,
  idempotency_key text not null,
  target_quote_id uuid not null,
  target_quote_version_id uuid not null,
  target_document_id uuid not null,
  title text not null,
  summary text,
  currency text not null,
  total_amount numeric,
  deposit_amount numeric,
  valid_until date,
  notes text,
  bucket text not null default 'quote-pdfs',
  path text not null,
  expected_mime_type text not null default 'application/pdf',
  expected_size_bytes bigint not null,
  advisory_sha256 text not null,
  trusted_verified_size_bytes bigint,
  trusted_verified_sha256 text,
  status text not null default 'pending',
  attempt_count integer not null default 1,
  attempt_started_at timestamptz not null,
  expires_at timestamptz not null,
  recovery_deadline timestamptz not null,
  last_error_code text,
  last_error_message text,
  finalized_at timestamptz,
  failed_at timestamptz,
  abandoned_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint quote_registration_intents_actor_idempotency_key unique (actor_id, idempotency_key),
  constraint quote_registration_intents_target_quote_key unique (target_quote_id),
  constraint quote_registration_intents_target_version_key unique (target_quote_version_id),
  constraint quote_registration_intents_target_document_key unique (target_document_id),
  constraint quote_registration_intents_bucket_path_key unique (bucket, path),
  constraint quote_registration_intents_target_ids_distinct check (
    target_quote_id <> target_quote_version_id
    and target_quote_id <> target_document_id
    and target_quote_version_id <> target_document_id
  ),
  constraint quote_registration_intents_idempotency_key_check check (
    length(idempotency_key) between 1 and 120
    and idempotency_key ~ '^[A-Za-z0-9_-]+$'
  ),
  constraint quote_registration_intents_commercial_check check (
    length(title) between 1 and 120
    and title = trim(title)
    and (summary is null or (length(summary) between 1 and 400 and summary = trim(summary)))
    and currency in ('MXN', 'USD')
    and (total_amount is null or total_amount >= 0)
    and (deposit_amount is null or deposit_amount >= 0)
    and (total_amount is null or deposit_amount is null or deposit_amount <= total_amount)
    and (notes is null or (length(notes) between 1 and 2000 and notes = trim(notes)))
  ),
  constraint quote_registration_intents_pdf_contract_check check (
    bucket = 'quote-pdfs'
    and expected_mime_type = 'application/pdf'
    and expected_size_bytes between 1 and 20971520
    and advisory_sha256 ~ '^[0-9a-f]{64}$'
    and (
      trusted_verified_size_bytes is null
      or trusted_verified_size_bytes between 1 and 20971520
    )
    and (
      trusted_verified_sha256 is null
      or trusted_verified_sha256 ~ '^[0-9a-f]{64}$'
    )
  ),
  constraint quote_registration_intents_status_check check (
    status in ('pending', 'finalized', 'failed', 'abandoned')
  ),
  constraint quote_registration_intents_attempt_check check (attempt_count >= 1),
  constraint quote_registration_intents_deadlines_check check (
    attempt_started_at >= created_at
    and expires_at > attempt_started_at
    and expires_at <= attempt_started_at + interval '15 minutes'
    and recovery_deadline >= expires_at
    and recovery_deadline <= created_at + interval '24 hours'
  ),
  constraint quote_registration_intents_error_check check (
    (last_error_code is null and last_error_message is null)
    or (
      last_error_code is not null
      and last_error_message is not null
      and last_error_code ~ '^[a-z0-9_:-]{1,80}$'
      and length(last_error_message) between 1 and 500
    )
  ),
  constraint quote_registration_intents_lifecycle_check check (
    (
      status = 'pending'
      and trusted_verified_size_bytes is null
      and trusted_verified_sha256 is null
      and last_error_code is null
      and last_error_message is null
      and finalized_at is null
      and failed_at is null
      and abandoned_at is null
    )
    or (
      status = 'finalized'
      and trusted_verified_size_bytes is not null
      and trusted_verified_sha256 is not null
      and last_error_code is null
      and last_error_message is null
      and finalized_at is not null
      and failed_at is null
      and abandoned_at is null
    )
    or (
      status = 'failed'
      and trusted_verified_size_bytes is null
      and trusted_verified_sha256 is null
      and last_error_code is not null
      and last_error_message is not null
      and finalized_at is null
      and failed_at is not null
      and abandoned_at is null
    )
    or (
      status = 'abandoned'
      and trusted_verified_size_bytes is null
      and trusted_verified_sha256 is null
      and finalized_at is null
      and abandoned_at is not null
    )
  )
);

create index if not exists quote_registration_intents_actor_status_expiry_idx
  on public.quote_registration_intents(actor_id, status, expires_at);
create index if not exists quote_registration_intents_opportunity_created_idx
  on public.quote_registration_intents(opportunity_id, created_at desc, id desc);
create index if not exists quote_registration_intents_recovery_idx
  on public.quote_registration_intents(status, recovery_deadline)
  where status in ('pending', 'failed');

alter table public.quotes
  add column if not exists registration_intent_id uuid;
alter table public.quotes
  drop constraint if exists quotes_registration_intent_id_fkey,
  drop constraint if exists quotes_registration_intent_id_key,
  add constraint quotes_registration_intent_id_fkey
    foreign key (registration_intent_id)
    references public.quote_registration_intents(id)
    on delete restrict
    not valid,
  add constraint quotes_registration_intent_id_key unique (registration_intent_id);
alter table public.quotes
  validate constraint quotes_registration_intent_id_fkey;

create or replace function public.crm_enforce_quote_registration_intent_integrity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  expected_path text;
  retrying boolean := false;
  target_row record;
begin
  if tg_op = 'DELETE' then
    raise exception 'Quote registration intents are durable audit records and cannot be deleted';
  end if;

  expected_path := format(
    'contacts/%s/opportunities/%s/quotes/%s/versions/%s/%s.pdf',
    new.contact_id,
    new.opportunity_id,
    new.target_quote_id,
    new.target_quote_version_id,
    new.target_document_id
  );
  if new.bucket <> 'quote-pdfs'
    or new.path <> expected_path
    or new.path !~ '^contacts/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/opportunities/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/quotes/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/versions/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.pdf$'
  then
    raise exception 'Quote registration intent path must be the exact canonical UUID-only path';
  end if;

  if tg_op = 'INSERT' then
    if auth.uid() is null or new.actor_id is distinct from auth.uid() then
      raise insufficient_privilege using message = 'Quote registration intent actor must match the authenticated caller';
    end if;
    if new.status <> 'pending'
      or new.attempt_count <> 1
      or new.attempt_started_at < new.created_at
      or new.expires_at <= now()
      or new.recovery_deadline <= new.expires_at
    then
      raise invalid_parameter_value using message = 'Quote registration intents must start pending with bounded future recovery';
    end if;
    if exists (select 1 from public.quotes q where q.id = new.target_quote_id)
      or exists (select 1 from public.quote_versions qv where qv.id = new.target_quote_version_id)
      or exists (select 1 from public.documents d where d.id = new.target_document_id)
    then
      raise unique_violation using message = 'Quote registration target identifiers are already in use';
    end if;
  else
    retrying := old.status = 'failed' and new.status = 'pending';
    if new.id is distinct from old.id
      or new.actor_id is distinct from old.actor_id
      or new.contact_id is distinct from old.contact_id
      or new.opportunity_id is distinct from old.opportunity_id
      or new.originating_request_id is distinct from old.originating_request_id
      or new.idempotency_key is distinct from old.idempotency_key
      or new.target_quote_id is distinct from old.target_quote_id
      or new.target_quote_version_id is distinct from old.target_quote_version_id
      or new.target_document_id is distinct from old.target_document_id
      or new.title is distinct from old.title
      or new.summary is distinct from old.summary
      or new.currency is distinct from old.currency
      or new.total_amount is distinct from old.total_amount
      or new.deposit_amount is distinct from old.deposit_amount
      or new.valid_until is distinct from old.valid_until
      or new.notes is distinct from old.notes
      or new.bucket is distinct from old.bucket
      or new.path is distinct from old.path
      or new.expected_mime_type is distinct from old.expected_mime_type
      or new.expected_size_bytes is distinct from old.expected_size_bytes
      or new.advisory_sha256 is distinct from old.advisory_sha256
      or new.recovery_deadline is distinct from old.recovery_deadline
      or new.created_at is distinct from old.created_at
    then
      raise exception 'Quote registration intent identity, payload, and path are immutable';
    end if;
    if not retrying and (
      new.attempt_count is distinct from old.attempt_count
      or new.attempt_started_at is distinct from old.attempt_started_at
      or new.expires_at is distinct from old.expires_at
    ) then
      raise exception 'Quote registration attempt timing can change only during failed-to-pending recovery';
    end if;
    if retrying and (
      new.attempt_count <> old.attempt_count + 1
      or new.attempt_started_at <= old.attempt_started_at
      or new.attempt_started_at < now() - interval '1 minute'
      or new.expires_at <= now()
      or new.expires_at > new.recovery_deadline
    ) then
      raise exception 'Quote registration retry must increment one bounded unexpired attempt';
    end if;
    if not (
      (old.status = 'pending' and new.status in ('pending', 'finalized', 'failed', 'abandoned'))
      or (old.status = 'failed' and new.status in ('failed', 'pending', 'abandoned'))
      or (old.status = new.status and old.status in ('finalized', 'abandoned'))
    ) then
      raise exception 'Invalid quote registration intent transition';
    end if;
  end if;

  if new.status = 'pending' then
    if exists (select 1 from public.quotes q where q.registration_intent_id = new.id)
      or exists (select 1 from public.quotes q where q.id = new.target_quote_id)
      or exists (select 1 from public.quote_versions qv where qv.id = new.target_quote_version_id)
      or exists (select 1 from public.documents d where d.id = new.target_document_id)
    then
      raise exception 'Pending quote registration intents cannot have materialized targets';
    end if;
  elsif new.status = 'finalized' then
    select
      q.id as quote_id,
      q.registration_intent_id,
      q.contact_id,
      q.lead_id,
      q.status as quote_status,
      q.current_version_id,
      qv.id as quote_version_id,
      qv.quote_id as version_quote_id,
      qv.status as version_status,
      qv.finalized_at as version_finalized_at,
      d.id as document_id,
      d.quote_version_id as document_version_id,
      d.storage_state,
      d.status as document_status,
      d.bucket,
      d.path,
      d.mime_type,
      d.byte_size,
      d.sha256
    into target_row
    from public.quotes q
    join public.quote_versions qv on qv.id = new.target_quote_version_id
    join public.documents d on d.id = new.target_document_id
    where q.id = new.target_quote_id;

    if target_row.quote_id is null
      or target_row.registration_intent_id is distinct from new.id
      or target_row.contact_id is distinct from new.contact_id
      or target_row.lead_id is distinct from new.opportunity_id
      or target_row.quote_status <> 'ready'
      or target_row.current_version_id is distinct from new.target_quote_version_id
      or target_row.quote_version_id is null
      or target_row.version_quote_id is distinct from new.target_quote_id
      or target_row.version_status <> 'ready'
      or target_row.version_finalized_at is null
      or target_row.document_id is null
      or target_row.document_version_id is distinct from new.target_quote_version_id
      or target_row.storage_state <> 'ready'
      or target_row.document_status <> 'active'
      or target_row.bucket is distinct from new.bucket
      or target_row.path is distinct from new.path
      or target_row.mime_type is distinct from new.expected_mime_type
      or target_row.byte_size is distinct from new.trusted_verified_size_bytes
      or target_row.sha256 is distinct from new.trusted_verified_sha256
    then
      raise exception 'Finalized quote registration intent requires one canonical ready target set';
    end if;
  elsif exists (select 1 from public.quotes q where q.registration_intent_id = new.id) then
    raise exception 'Failed or abandoned quote registration intents cannot own quote records';
  end if;

  return new;
end;
$function$;

create or replace function public.crm_enforce_quote_registration_link()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  intent_row public.quote_registration_intents%rowtype;
begin
  if tg_op = 'UPDATE' and new.registration_intent_id is distinct from old.registration_intent_id then
    raise exception 'Quote registration provenance is immutable';
  end if;
  if new.registration_intent_id is null then
    return new;
  end if;

  select * into intent_row
  from public.quote_registration_intents qri
  where qri.id = new.registration_intent_id;
  if intent_row.id is null
    or intent_row.status not in ('pending', 'finalized')
    or intent_row.target_quote_id is distinct from new.id
    or intent_row.contact_id is distinct from new.contact_id
    or intent_row.opportunity_id is distinct from new.lead_id
    or intent_row.actor_id is distinct from new.created_by
    or new.idempotency_key is distinct from 'registration:' || intent_row.id::text
  then
    raise exception 'Quote registration provenance does not match the reserved target scope';
  end if;
  return new;
end;
$function$;

revoke all on function public.crm_enforce_quote_registration_intent_integrity()
  from public, anon, authenticated, service_role;
revoke all on function public.crm_enforce_quote_registration_link()
  from public, anon, authenticated, service_role;

drop trigger if exists enforce_quote_registration_intent_integrity on public.quote_registration_intents;
create trigger enforce_quote_registration_intent_integrity
  before insert or update or delete on public.quote_registration_intents
  for each row execute function public.crm_enforce_quote_registration_intent_integrity();
drop trigger if exists set_quote_registration_intents_updated_at on public.quote_registration_intents;
create trigger set_quote_registration_intents_updated_at
  before update on public.quote_registration_intents
  for each row execute function public.set_updated_at();
drop trigger if exists enforce_quote_registration_link on public.quotes;
create trigger enforce_quote_registration_link
  before insert or update on public.quotes
  for each row execute function public.crm_enforce_quote_registration_link();

create or replace function public.crm_begin_quote_registration(
  p_opportunity_id uuid,
  p_title text,
  p_summary text,
  p_currency text,
  p_total_amount numeric,
  p_deposit_amount numeric,
  p_valid_until date,
  p_notes text,
  p_originating_request_id uuid,
  p_expected_size_bytes bigint,
  p_advisory_sha256 text,
  p_idempotency_key text
)
returns table(
  intent_id uuid,
  contact_id uuid,
  opportunity_id uuid,
  target_quote_id uuid,
  target_quote_version_id uuid,
  target_document_id uuid,
  bucket text,
  path text,
  expected_mime_type text,
  expected_size_bytes bigint,
  intent_status text,
  attempt_count integer,
  expires_at timestamptz,
  recovery_deadline timestamptz,
  idempotent_replay boolean
)
language plpgsql
security definer
set search_path = ''
as $function$
declare
  registration_actor_id uuid := auth.uid();
  contact_hint uuid;
  existing_hint record;
  scope_row record;
  intent_row public.quote_registration_intents%rowtype;
  normalized_title text := trim(p_title);
  normalized_summary text := nullif(trim(p_summary), '');
  normalized_notes text := nullif(trim(p_notes), '');
  started_at timestamptz := now();
  new_intent_id uuid := gen_random_uuid();
  new_quote_id uuid := gen_random_uuid();
  new_version_id uuid := gen_random_uuid();
  new_document_id uuid := gen_random_uuid();
  object_path text;
begin
  if registration_actor_id is null then
    raise insufficient_privilege using message = 'Quote registration requires an authenticated actor';
  end if;
  perform public.crm_validate_quote_commercial_input(
    p_title,
    p_summary,
    p_currency,
    p_total_amount,
    p_deposit_amount,
    p_notes,
    p_idempotency_key
  );
  if p_opportunity_id is null then
    raise invalid_parameter_value using message = 'Opportunity is required';
  end if;
  if p_expected_size_bytes is null or p_expected_size_bytes < 1 or p_expected_size_bytes > 20971520 then
    raise invalid_parameter_value using message = 'Expected PDF size must be between 1 byte and 20 MB';
  end if;
  if p_advisory_sha256 is null or p_advisory_sha256 !~ '^[0-9a-f]{64}$' then
    raise invalid_parameter_value using message = 'A lowercase advisory SHA-256 checksum is required';
  end if;

  select qri.opportunity_id, qri.contact_id
  into existing_hint
  from public.quote_registration_intents qri
  where qri.actor_id = registration_actor_id and qri.idempotency_key = p_idempotency_key;
  if existing_hint.opportunity_id is not null
    and existing_hint.opportunity_id is distinct from p_opportunity_id
  then
    raise invalid_parameter_value using message = 'Idempotent quote registration replay changed opportunity scope';
  end if;

  select l.contact_id into contact_hint
  from public.leads l where l.id = p_opportunity_id;
  if contact_hint is null then
    raise exception 'Quote registration opportunity was not found';
  end if;
  if existing_hint.contact_id is not null and existing_hint.contact_id is distinct from contact_hint then
    raise exception 'Idempotent quote registration replay changed contact scope';
  end if;

  -- Keep the established quote mutation lock order before locking reservations.
  perform 1 from public.contacts c where c.id = contact_hint for update;
  perform 1 from public.leads l where l.id = p_opportunity_id for update;
  perform 1 from public.quotes q where q.lead_id = p_opportunity_id order by q.id for update;
  perform 1 from public.quote_versions qv where qv.lead_id = p_opportunity_id order by qv.quote_id, qv.version_number, qv.id for update;
  perform 1
  from public.documents d
  join public.quote_versions qv on qv.id = d.quote_version_id
  where qv.lead_id = p_opportunity_id
  order by d.id
  for update of d;
  perform 1 from public.quote_upload_intents qui where qui.quote_id in (
    select q.id from public.quotes q where q.lead_id = p_opportunity_id
  ) order by qui.quote_id, qui.id for update;
  perform 1 from public.quote_registration_intents qri
  where qri.opportunity_id = p_opportunity_id order by qri.id for update;

  select
    l.id as opportunity_id,
    l.contact_id,
    l.assigned_to,
    l.deleted_at as opportunity_deleted_at,
    c.deleted_at as contact_deleted_at
  into scope_row
  from public.leads l
  join public.contacts c on c.id = l.contact_id
  where l.id = p_opportunity_id;
  if scope_row.opportunity_id is null
    or scope_row.contact_id is distinct from contact_hint
    or scope_row.opportunity_deleted_at is not null
    or scope_row.contact_deleted_at is not null
  then
    raise exception 'Quote registration requires a live contact and opportunity';
  end if;
  if not (
    public.is_admin()
    or (public.has_role('asesor') and scope_row.assigned_to = registration_actor_id)
  ) then
    raise insufficient_privilege using message = 'Quote registration requires an administrator or assigned advisor';
  end if;
  if p_originating_request_id is not null and not exists (
    select 1 from public.quote_requests qr
    where qr.id = p_originating_request_id
      and qr.lead_id = scope_row.opportunity_id
      and qr.contact_id = scope_row.contact_id
  ) then
    raise exception 'Originating request must belong to the same contact and opportunity';
  end if;

  select * into intent_row
  from public.quote_registration_intents qri
  where qri.actor_id = registration_actor_id and qri.idempotency_key = p_idempotency_key;
  if intent_row.id is not null then
    if intent_row.contact_id is distinct from scope_row.contact_id
      or intent_row.opportunity_id is distinct from scope_row.opportunity_id
      or intent_row.originating_request_id is distinct from p_originating_request_id
      or intent_row.title is distinct from normalized_title
      or intent_row.summary is distinct from normalized_summary
      or intent_row.currency is distinct from p_currency
      or intent_row.total_amount is distinct from p_total_amount
      or intent_row.deposit_amount is distinct from p_deposit_amount
      or intent_row.valid_until is distinct from p_valid_until
      or intent_row.notes is distinct from normalized_notes
      or intent_row.expected_size_bytes is distinct from p_expected_size_bytes
      or intent_row.advisory_sha256 is distinct from p_advisory_sha256
    then
      raise invalid_parameter_value using message = 'Idempotent quote registration replay changed immutable input';
    end if;

    if intent_row.status = 'pending' and intent_row.expires_at > now() then
      return query select
        intent_row.id, intent_row.contact_id, intent_row.opportunity_id,
        intent_row.target_quote_id, intent_row.target_quote_version_id,
        intent_row.target_document_id, intent_row.bucket, intent_row.path,
        intent_row.expected_mime_type, intent_row.expected_size_bytes,
        intent_row.status, intent_row.attempt_count, intent_row.expires_at,
        intent_row.recovery_deadline, true;
      return;
    end if;
    if intent_row.status = 'finalized' or intent_row.status = 'abandoned' then
      return query select
        intent_row.id, intent_row.contact_id, intent_row.opportunity_id,
        intent_row.target_quote_id, intent_row.target_quote_version_id,
        intent_row.target_document_id, intent_row.bucket, intent_row.path,
        intent_row.expected_mime_type, intent_row.expected_size_bytes,
        intent_row.status, intent_row.attempt_count, intent_row.expires_at,
        intent_row.recovery_deadline, true;
      return;
    end if;

    if intent_row.status = 'pending' then
      if intent_row.recovery_deadline <= now() then
        update public.quote_registration_intents
        set status = 'abandoned',
            last_error_code = 'recovery_deadline_elapsed',
            last_error_message = 'Registration recovery deadline elapsed before finalization',
            abandoned_at = now()
        where id = intent_row.id
        returning * into intent_row;
      else
        update public.quote_registration_intents
        set status = 'failed',
            last_error_code = 'intent_expired',
            last_error_message = 'Registration upload intent expired before finalization',
            failed_at = now()
        where id = intent_row.id
        returning * into intent_row;
      end if;
    end if;
    if intent_row.status = 'failed' and intent_row.recovery_deadline <= now() then
      update public.quote_registration_intents
      set status = 'abandoned', abandoned_at = now()
      where id = intent_row.id
      returning * into intent_row;
    end if;
    if intent_row.status = 'abandoned' then
      return query select
        intent_row.id, intent_row.contact_id, intent_row.opportunity_id,
        intent_row.target_quote_id, intent_row.target_quote_version_id,
        intent_row.target_document_id, intent_row.bucket, intent_row.path,
        intent_row.expected_mime_type, intent_row.expected_size_bytes,
        intent_row.status, intent_row.attempt_count, intent_row.expires_at,
        intent_row.recovery_deadline, true;
      return;
    end if;

    started_at := now();
    update public.quote_registration_intents qri
    set status = 'pending',
        attempt_count = qri.attempt_count + 1,
        attempt_started_at = started_at,
        expires_at = least(started_at + interval '15 minutes', qri.recovery_deadline),
        last_error_code = null,
        last_error_message = null,
        failed_at = null,
        abandoned_at = null
    where qri.id = intent_row.id and qri.status = 'failed'
    returning * into intent_row;

    return query select
      intent_row.id, intent_row.contact_id, intent_row.opportunity_id,
      intent_row.target_quote_id, intent_row.target_quote_version_id,
      intent_row.target_document_id, intent_row.bucket, intent_row.path,
      intent_row.expected_mime_type, intent_row.expected_size_bytes,
      intent_row.status, intent_row.attempt_count, intent_row.expires_at,
      intent_row.recovery_deadline, false;
    return;
  end if;

  object_path := format(
    'contacts/%s/opportunities/%s/quotes/%s/versions/%s/%s.pdf',
    scope_row.contact_id,
    scope_row.opportunity_id,
    new_quote_id,
    new_version_id,
    new_document_id
  );
  insert into public.quote_registration_intents (
    id, actor_id, contact_id, opportunity_id, originating_request_id,
    idempotency_key, target_quote_id, target_quote_version_id,
    target_document_id, title, summary, currency, total_amount,
    deposit_amount, valid_until, notes, bucket, path,
    expected_mime_type, expected_size_bytes, advisory_sha256,
    status, attempt_count, attempt_started_at, expires_at,
    recovery_deadline, created_at, updated_at
  ) values (
    new_intent_id, registration_actor_id, scope_row.contact_id, scope_row.opportunity_id,
    p_originating_request_id, p_idempotency_key, new_quote_id,
    new_version_id, new_document_id, normalized_title, normalized_summary,
    p_currency, p_total_amount, p_deposit_amount, p_valid_until,
    normalized_notes, 'quote-pdfs', object_path, 'application/pdf',
    p_expected_size_bytes, p_advisory_sha256, 'pending', 1,
    started_at, started_at + interval '15 minutes',
    started_at + interval '24 hours', started_at, started_at
  ) returning * into intent_row;

  return query select
    intent_row.id, intent_row.contact_id, intent_row.opportunity_id,
    intent_row.target_quote_id, intent_row.target_quote_version_id,
    intent_row.target_document_id, intent_row.bucket, intent_row.path,
    intent_row.expected_mime_type, intent_row.expected_size_bytes,
    intent_row.status, intent_row.attempt_count, intent_row.expires_at,
    intent_row.recovery_deadline, false;
end;
$function$;

create or replace function public.crm_register_quote_with_pdf(
  p_intent_id uuid,
  p_verified_size_bytes bigint,
  p_verified_sha256 text
)
returns table(
  intent_id uuid,
  quote_id uuid,
  quote_version_id uuid,
  document_id uuid,
  quote_number text,
  version_number integer,
  document_state text,
  version_status text,
  quote_status text,
  lock_version integer,
  idempotent_replay boolean
)
language plpgsql
security definer
set search_path = ''
as $function$
declare
  contact_hint uuid;
  opportunity_hint uuid;
  registration_actor_id uuid;
  scope_row record;
  intent_row public.quote_registration_intents%rowtype;
  object_row record;
  object_size_text text;
  object_size bigint;
  object_mime text;
  created_quote public.quotes%rowtype;
  created_version public.quote_versions%rowtype;
  created_document public.documents%rowtype;
  audit_created boolean;
begin
  if auth.role() is distinct from 'service_role' then
    raise insufficient_privilege using message = 'Quote registration finalization requires the trusted server boundary';
  end if;
  if p_intent_id is null then
    raise invalid_parameter_value using message = 'Quote registration intent is required';
  end if;
  if p_verified_size_bytes is null or p_verified_size_bytes < 1 or p_verified_size_bytes > 20971520 then
    raise invalid_parameter_value using message = 'Trusted PDF size must be between 1 byte and 20 MB';
  end if;
  if p_verified_sha256 is null or p_verified_sha256 !~ '^[0-9a-f]{64}$' then
    raise invalid_parameter_value using message = 'A trusted lowercase SHA-256 checksum is required';
  end if;

  select qri.contact_id, qri.opportunity_id
  into contact_hint, opportunity_hint
  from public.quote_registration_intents qri
  where qri.id = p_intent_id;
  if contact_hint is null or opportunity_hint is null then
    raise exception 'Quote registration intent was not found';
  end if;

  perform 1 from public.contacts c where c.id = contact_hint for update;
  perform 1 from public.leads l where l.id = opportunity_hint for update;
  perform 1 from public.quotes q where q.lead_id = opportunity_hint order by q.id for update;
  perform 1 from public.quote_versions qv where qv.lead_id = opportunity_hint order by qv.quote_id, qv.version_number, qv.id for update;
  perform 1
  from public.documents d
  join public.quote_versions qv on qv.id = d.quote_version_id
  where qv.lead_id = opportunity_hint
  order by d.id
  for update of d;
  perform 1 from public.quote_upload_intents qui where qui.quote_id in (
    select q.id from public.quotes q where q.lead_id = opportunity_hint
  ) order by qui.quote_id, qui.id for update;
  perform 1 from public.quote_registration_intents qri
  where qri.opportunity_id = opportunity_hint order by qri.id for update;

  select * into intent_row
  from public.quote_registration_intents qri
  where qri.id = p_intent_id;
  registration_actor_id := intent_row.actor_id;

  if intent_row.status = 'finalized' then
    select * into created_quote
    from public.quotes q
    where q.id = intent_row.target_quote_id
      and q.registration_intent_id = intent_row.id;
    select * into created_version
    from public.quote_versions qv
    where qv.id = intent_row.target_quote_version_id
      and qv.quote_id = intent_row.target_quote_id;
    select * into created_document
    from public.documents d
    where d.id = intent_row.target_document_id
      and d.quote_version_id = intent_row.target_quote_version_id;
    if intent_row.trusted_verified_size_bytes is distinct from p_verified_size_bytes
      or intent_row.trusted_verified_sha256 is distinct from p_verified_sha256
      or created_quote.id is null
      or created_quote.status <> 'ready'
      or created_version.id is null
      or created_version.status <> 'ready'
      or created_document.id is null
      or created_document.storage_state <> 'ready'
      or created_document.byte_size is distinct from p_verified_size_bytes
      or created_document.sha256 is distinct from p_verified_sha256
    then
      raise exception 'Finalized quote registration replay does not match its canonical result';
    end if;
    return query select
      intent_row.id, created_quote.id, created_version.id, created_document.id,
      created_quote.quote_number, created_version.version_number,
      created_document.storage_state, created_version.status,
      created_quote.status, created_quote.lock_version, true;
    return;
  end if;

  select
    l.id as opportunity_id,
    l.contact_id,
    l.assigned_to,
    l.deleted_at as opportunity_deleted_at,
    c.deleted_at as contact_deleted_at
  into scope_row
  from public.leads l
  join public.contacts c on c.id = l.contact_id
  where l.id = intent_row.opportunity_id;
  if intent_row.id is null
    or registration_actor_id is null
    or scope_row.opportunity_id is null
    or scope_row.contact_id is distinct from intent_row.contact_id
    or scope_row.opportunity_deleted_at is not null
    or scope_row.contact_deleted_at is not null
  then
    raise exception 'Quote registration finalization requires a live reserved scope';
  end if;
  if not exists (
    select 1
    from public.profile_roles pr
    join public.roles r on r.id = pr.role_id
    join public.profiles p on p.id = pr.profile_id
    where pr.profile_id = registration_actor_id
      and p.is_active
      and (
        r.name = 'admin'
        or (r.name = 'asesor' and scope_row.assigned_to = registration_actor_id)
      )
  ) then
    raise insufficient_privilege using message = 'The registration actor no longer has a live admin or assigned-advisor scope';
  end if;
  if intent_row.originating_request_id is not null and not exists (
    select 1 from public.quote_requests qr
    where qr.id = intent_row.originating_request_id
      and qr.lead_id = intent_row.opportunity_id
      and qr.contact_id = intent_row.contact_id
  ) then
    raise exception 'Originating request no longer belongs to the reserved contact and opportunity';
  end if;
  if intent_row.status <> 'pending'
    or intent_row.expires_at <= now()
    or intent_row.recovery_deadline <= now()
  then
    raise exception 'Quote registration intent is not pending and unexpired';
  end if;
  if p_verified_size_bytes is distinct from intent_row.expected_size_bytes
    or p_verified_sha256 is distinct from intent_row.advisory_sha256
  then
    raise exception 'Trusted PDF bytes do not match the registration advisory contract';
  end if;
  if exists (select 1 from public.quotes q where q.id = intent_row.target_quote_id or q.registration_intent_id = intent_row.id)
    or exists (select 1 from public.quote_versions qv where qv.id = intent_row.target_quote_version_id)
    or exists (select 1 from public.documents d where d.id = intent_row.target_document_id)
  then
    raise exception 'Pending quote registration has an unexpected materialized target';
  end if;

  select so.id, so.bucket_id, so.name, so.metadata, so.created_at, so.updated_at
  into object_row
  from storage.objects so
  where so.bucket_id = intent_row.bucket and so.name = intent_row.path
  for update;
  if object_row.id is null then
    raise exception 'Registered PDF object was not found';
  end if;
  object_size_text := coalesce(
    nullif(object_row.metadata ->> 'size', ''),
    nullif(object_row.metadata ->> 'contentLength', '')
  );
  if object_size_text is null or object_size_text !~ '^[0-9]+$' then
    raise exception 'Registered PDF object size metadata is invalid';
  end if;
  object_size := object_size_text::bigint;
  object_mime := lower(coalesce(
    nullif(object_row.metadata ->> 'mimetype', ''),
    nullif(object_row.metadata ->> 'contentType', '')
  ));
  if object_row.bucket_id <> 'quote-pdfs'
    or object_row.name is distinct from intent_row.path
    or lower(storage.extension(object_row.name)) <> 'pdf'
    or object_mime is distinct from intent_row.expected_mime_type
    or object_size is distinct from intent_row.expected_size_bytes
    or object_size is distinct from p_verified_size_bytes
    or object_row.created_at < intent_row.attempt_started_at
    or object_row.created_at > intent_row.expires_at
    or coalesce(object_row.updated_at, object_row.created_at) < object_row.created_at
    or coalesce(object_row.updated_at, object_row.created_at) > intent_row.expires_at
  then
    raise exception 'Registered object metadata or timing does not match the pending PDF intent';
  end if;

  insert into public.quotes (
    id, contact_id, lead_id, title, status, owner_id, created_by,
    next_version_number, idempotency_key, registration_intent_id
  ) values (
    intent_row.target_quote_id, intent_row.contact_id,
    intent_row.opportunity_id, intent_row.title, 'draft',
    scope_row.assigned_to, registration_actor_id, 2,
    'registration:' || intent_row.id::text, intent_row.id
  ) returning * into created_quote;

  insert into public.quote_versions (
    id, quote_id, lead_id, contact_id, quote_request_id, idempotency_key,
    version_number, title, summary, currency, total_amount, deposit_amount,
    notes, status, valid_until, created_by
  ) values (
    intent_row.target_quote_version_id, intent_row.target_quote_id,
    intent_row.opportunity_id, intent_row.contact_id,
    intent_row.originating_request_id, 'registration:' || intent_row.id::text,
    1, intent_row.title, intent_row.summary, intent_row.currency,
    intent_row.total_amount, intent_row.deposit_amount, intent_row.notes,
    'draft', intent_row.valid_until, registration_actor_id
  ) returning * into created_version;

  if intent_row.originating_request_id is not null then
    insert into public.quote_request_quote_links (
      quote_id, quote_request_id, relation, created_by
    ) values (
      intent_row.target_quote_id, intent_row.originating_request_id,
      'originating', registration_actor_id
    );
  end if;

  insert into public.documents (
    id, booking_id, lead_id, contact_id, uploaded_by, document_type,
    title, bucket, path, status, quote_version_id, storage_state,
    mime_type, byte_size, sha256, uploaded_at, quote_link_source,
    quote_linked_at, quote_linked_by
  ) values (
    intent_row.target_document_id, null, intent_row.opportunity_id,
    intent_row.contact_id, registration_actor_id, 'quote',
    created_quote.quote_number || ' V1', intent_row.bucket, intent_row.path,
    'active', intent_row.target_quote_version_id, 'ready',
    intent_row.expected_mime_type, p_verified_size_bytes,
    p_verified_sha256, object_row.created_at, 'native', now(), registration_actor_id
  ) returning * into created_document;

  update public.quote_versions
  set status = 'ready'
  where id = intent_row.target_quote_version_id
  returning * into created_version;
  select * into created_quote
  from public.quotes q where q.id = intent_row.target_quote_id;

  select public.crm_record_quote_mutation(
    created_quote.id,
    created_version.id,
    registration_actor_id,
    'quote_registered_with_pdf',
    null,
    'ready',
    'registration:' || intent_row.id::text,
    jsonb_build_object(
      'registrationIntentId', intent_row.id,
      'documentId', created_document.id,
      'originatingRequestId', intent_row.originating_request_id,
      'byteSize', p_verified_size_bytes,
      'sha256', p_verified_sha256,
      'mandatoryInitialPdf', true
    )
  ) into audit_created;
  if not audit_created then
    raise exception 'Quote registration audit event was not created';
  end if;

  update public.quote_registration_intents
  set status = 'finalized',
      trusted_verified_size_bytes = p_verified_size_bytes,
      trusted_verified_sha256 = p_verified_sha256,
      finalized_at = now(),
      last_error_code = null,
      last_error_message = null,
      failed_at = null,
      abandoned_at = null
  where id = intent_row.id
  returning * into intent_row;

  select * into created_quote from public.quotes q where q.id = intent_row.target_quote_id;
  select * into created_version from public.quote_versions qv where qv.id = intent_row.target_quote_version_id;
  select * into created_document from public.documents d where d.id = intent_row.target_document_id;
  if created_quote.status <> 'ready'
    or created_version.status <> 'ready'
    or created_version.finalized_at is null
    or created_document.storage_state <> 'ready'
  then
    raise exception 'Quote registration did not reach the canonical ready state';
  end if;

  return query select
    intent_row.id, created_quote.id, created_version.id, created_document.id,
    created_quote.quote_number, created_version.version_number,
    created_document.storage_state, created_version.status,
    created_quote.status, created_quote.lock_version, false;
end;
$function$;

create or replace function public.crm_fail_quote_registration(
  p_intent_id uuid,
  p_error_code text,
  p_error_message text
)
returns table(
  intent_id uuid,
  target_quote_id uuid,
  target_quote_version_id uuid,
  target_document_id uuid,
  intent_status text,
  attempt_count integer,
  last_error_code text,
  failed_at timestamptz,
  idempotent_replay boolean
)
language plpgsql
security definer
set search_path = ''
as $function$
declare
  caller_id uuid := auth.uid();
  contact_hint uuid;
  opportunity_hint uuid;
  intent_row public.quote_registration_intents%rowtype;
begin
  if p_intent_id is null
    or nullif(trim(p_error_code), '') is null
    or length(trim(p_error_code)) > 80
    or trim(p_error_code) !~ '^[a-z0-9_:-]+$'
    or nullif(trim(p_error_message), '') is null
    or length(trim(p_error_message)) > 500
  then
    raise invalid_parameter_value using message = 'A bounded safe registration failure code and message are required';
  end if;

  select qri.contact_id, qri.opportunity_id
  into contact_hint, opportunity_hint
  from public.quote_registration_intents qri
  where qri.id = p_intent_id;
  if contact_hint is null or opportunity_hint is null then
    raise exception 'Quote registration intent was not found';
  end if;

  perform 1 from public.contacts c where c.id = contact_hint for update;
  perform 1 from public.leads l where l.id = opportunity_hint for update;
  perform 1 from public.quotes q where q.lead_id = opportunity_hint order by q.id for update;
  perform 1 from public.quote_versions qv where qv.lead_id = opportunity_hint order by qv.quote_id, qv.version_number, qv.id for update;
  perform 1
  from public.documents d
  join public.quote_versions qv on qv.id = d.quote_version_id
  where qv.lead_id = opportunity_hint
  order by d.id
  for update of d;
  perform 1 from public.quote_upload_intents qui where qui.quote_id in (
    select q.id from public.quotes q where q.lead_id = opportunity_hint
  ) order by qui.quote_id, qui.id for update;
  perform 1 from public.quote_registration_intents qri
  where qri.opportunity_id = opportunity_hint order by qri.id for update;

  select * into intent_row
  from public.quote_registration_intents qri
  where qri.id = p_intent_id;
  if caller_id is null or not (intent_row.actor_id = caller_id or public.is_admin()) then
    raise insufficient_privilege using message = 'Only the registration actor or an administrator can record failure';
  end if;
  if intent_row.status = 'finalized' then
    return query select
      intent_row.id, intent_row.target_quote_id,
      intent_row.target_quote_version_id, intent_row.target_document_id,
      intent_row.status, intent_row.attempt_count,
      intent_row.last_error_code, intent_row.failed_at, true;
    return;
  end if;
  if intent_row.status in ('failed', 'abandoned') then
    return query select
      intent_row.id, intent_row.target_quote_id,
      intent_row.target_quote_version_id, intent_row.target_document_id,
      intent_row.status, intent_row.attempt_count,
      intent_row.last_error_code, intent_row.failed_at, true;
    return;
  end if;
  if intent_row.status <> 'pending' then
    raise exception 'Quote registration intent cannot fail from its current state';
  end if;

  update public.quote_registration_intents
  set status = 'failed',
      last_error_code = trim(p_error_code),
      last_error_message = trim(p_error_message),
      failed_at = now()
  where id = intent_row.id
  returning * into intent_row;

  return query select
    intent_row.id, intent_row.target_quote_id,
    intent_row.target_quote_version_id, intent_row.target_document_id,
    intent_row.status, intent_row.attempt_count,
    intent_row.last_error_code, intent_row.failed_at, false;
end;
$function$;

create or replace function public.crm_quote_registration_intent(
  p_intent_id uuid
)
returns table(
  intent_id uuid,
  contact_id uuid,
  opportunity_id uuid,
  originating_request_id uuid,
  target_quote_id uuid,
  target_quote_version_id uuid,
  target_document_id uuid,
  bucket text,
  path text,
  expected_mime_type text,
  expected_size_bytes bigint,
  intent_status text,
  attempt_count integer,
  attempt_started_at timestamptz,
  expires_at timestamptz,
  recovery_deadline timestamptz,
  last_error_code text,
  last_error_message text,
  finalized_at timestamptz,
  failed_at timestamptz,
  abandoned_at timestamptz,
  created_at timestamptz,
  updated_at timestamptz,
  upload_allowed boolean,
  retry_allowed boolean,
  cleanup_allowed boolean
)
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  caller_id uuid := auth.uid();
begin
  if caller_id is null or p_intent_id is null then
    raise insufficient_privilege using message = 'Quote registration recovery requires an authenticated actor';
  end if;
  if not exists (
    select 1 from public.quote_registration_intents qri
    where qri.id = p_intent_id
      and (qri.actor_id = caller_id or public.is_admin())
  ) then
    raise insufficient_privilege using message = 'Quote registration intent is not available to this actor';
  end if;

  return query
  select
    qri.id, qri.contact_id, qri.opportunity_id,
    qri.originating_request_id, qri.target_quote_id,
    qri.target_quote_version_id, qri.target_document_id,
    qri.bucket, qri.path, qri.expected_mime_type,
    qri.expected_size_bytes, qri.status, qri.attempt_count,
    qri.attempt_started_at, qri.expires_at, qri.recovery_deadline,
    qri.last_error_code, qri.last_error_message,
    qri.finalized_at, qri.failed_at, qri.abandoned_at,
    qri.created_at, qri.updated_at,
    qri.status = 'pending' and qri.expires_at > now(),
    qri.status = 'failed' and qri.recovery_deadline > now(),
    qri.status in ('failed', 'abandoned') and not exists (
      select 1 from public.quotes q where q.registration_intent_id = qri.id
    )
  from public.quote_registration_intents qri
  where qri.id = p_intent_id;
end;
$function$;

alter table public.quote_registration_intents enable row level security;
revoke all on table public.quote_registration_intents
  from public, anon, authenticated, service_role;

create or replace function public.crm_can_upload_quote_registration_object(
  p_bucket text,
  p_path text
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select exists (
    select 1
    from public.quote_registration_intents qri
    join public.leads l on l.id = qri.opportunity_id
    join public.contacts c on c.id = qri.contact_id
    where qri.bucket = p_bucket
      and qri.path = p_path
      and qri.actor_id = auth.uid()
      and qri.status = 'pending'
      and qri.expires_at > now()
      and qri.recovery_deadline > now()
      and l.contact_id = qri.contact_id
      and l.deleted_at is null
      and c.deleted_at is null
      and (
        public.is_admin()
        or (
          public.has_role('asesor')
          and l.assigned_to = auth.uid()
        )
      )
  );
$function$;

create or replace function public.crm_can_delete_quote_registration_object(
  p_bucket text,
  p_path text
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select exists (
    select 1
    from public.quote_registration_intents qri
    where qri.bucket = p_bucket
      and qri.path = p_path
      and qri.status in ('failed', 'abandoned')
      and (qri.actor_id = auth.uid() or public.is_admin())
      and not exists (
        select 1 from public.quotes q
        where q.registration_intent_id = qri.id
      )
      and not exists (
        select 1 from public.documents d
        where d.id = qri.target_document_id
          and d.storage_state = 'ready'
      )
  );
$function$;

revoke all on function public.crm_can_upload_quote_registration_object(text, text)
  from public, anon, authenticated, service_role;
revoke all on function public.crm_can_delete_quote_registration_object(text, text)
  from public, anon, authenticated, service_role;
grant execute on function public.crm_can_upload_quote_registration_object(text, text)
  to authenticated;
grant execute on function public.crm_can_delete_quote_registration_object(text, text)
  to authenticated;

drop policy if exists "quote registration intent upload" on storage.objects;
create policy "quote registration intent upload"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'quote-pdfs'
    and lower(storage.extension(name)) = 'pdf'
    and public.crm_can_upload_quote_registration_object(bucket_id, name)
  );

drop policy if exists "quote registration object cleanup" on storage.objects;
drop policy if exists "quote registration object cleanup read" on storage.objects;
create policy "quote registration object cleanup read"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'quote-pdfs'
    and public.crm_can_delete_quote_registration_object(bucket_id, name)
  );

create policy "quote registration object cleanup"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'quote-pdfs'
    and public.crm_can_delete_quote_registration_object(bucket_id, name)
  );

-- No quote-pdfs UPDATE policy is added. Storage upserts therefore cannot replace
-- a pending or finalized registration object. Existing upload-intent and
-- canonical read policies remain unchanged.

revoke all on function public.crm_begin_quote_registration(
  uuid, text, text, text, numeric, numeric, date, text, uuid, bigint, text, text
) from public, anon, authenticated, service_role;
revoke all on function public.crm_register_quote_with_pdf(uuid, bigint, text)
  from public, anon, authenticated, service_role;
revoke all on function public.crm_fail_quote_registration(uuid, text, text)
  from public, anon, authenticated, service_role;
revoke all on function public.crm_quote_registration_intent(uuid)
  from public, anon, authenticated, service_role;

grant execute on function public.crm_begin_quote_registration(
  uuid, text, text, text, numeric, numeric, date, text, uuid, bigint, text, text
) to authenticated;
grant execute on function public.crm_register_quote_with_pdf(uuid, bigint, text)
  to service_role;
grant execute on function public.crm_fail_quote_registration(uuid, text, text)
  to authenticated;
grant execute on function public.crm_quote_registration_intent(uuid)
  to authenticated;
