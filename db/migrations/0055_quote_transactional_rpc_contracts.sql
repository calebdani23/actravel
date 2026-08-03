-- Transactional quote creation, PDF upload, workflow, and deletion RPCs.

alter table public.quote_upload_intents
  add column if not exists expected_size_bytes bigint;

alter table public.quote_upload_intents
  drop constraint if exists quote_upload_intents_expected_size_check,
  add constraint quote_upload_intents_expected_size_check check (
    expected_size_bytes is null
    or expected_size_bytes between 1 and 20971520
  ) not valid;
alter table public.quote_upload_intents
  validate constraint quote_upload_intents_expected_size_check;

-- Phase 2A intentionally created one durable intent per version. A failed or
-- expired attempt therefore has to be reopened in place. Identity remains
-- immutable except for actor, expiry, expected size, and idempotency key during
-- the exact failed-to-pending retry transition performed by the RPC below.
create or replace function public.crm_enforce_quote_upload_intent_integrity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  scope_row record;
  expected_path text;
  retrying boolean := false;
begin
  if tg_op = 'DELETE' then
    raise exception 'Quote upload intents are lifecycle audit records and cannot be deleted';
  end if;

  select
    q.id as quote_id,
    q.contact_id,
    q.lead_id,
    q.deleted_at as quote_deleted_at,
    qv.id as quote_version_id,
    qv.quote_id as version_quote_id,
    l.assigned_to,
    l.deleted_at as lead_deleted_at,
    c.deleted_at as contact_deleted_at,
    d.id as document_id,
    d.quote_version_id as document_version_id,
    d.bucket as document_bucket,
    d.path as document_path,
    d.storage_state
  into scope_row
  from public.quotes q
  join public.quote_versions qv on qv.id = new.quote_version_id
  join public.documents d on d.id = new.document_id
  join public.leads l on l.id = q.lead_id
  join public.contacts c on c.id = q.contact_id
  where q.id = new.quote_id;

  if scope_row.quote_id is null
    or scope_row.version_quote_id is distinct from new.quote_id
    or scope_row.document_version_id is distinct from new.quote_version_id
  then
    raise exception 'Quote upload intent relationships must belong to one quote version';
  end if;

  retrying := tg_op = 'UPDATE' and old.status = 'failed' and new.status = 'pending';

  if tg_op = 'INSERT' and (
    auth.uid() is null
    or new.actor_id is distinct from auth.uid()
    or scope_row.quote_deleted_at is not null
    or scope_row.lead_deleted_at is not null
    or scope_row.contact_deleted_at is not null
    or not (
      public.is_admin()
      or (public.has_role('asesor') and scope_row.assigned_to = auth.uid())
    )
  ) then
    raise insufficient_privilege using message = 'Quote upload intent requires a live assigned quote scope';
  end if;
  if tg_op = 'INSERT' and scope_row.storage_state <> 'pending' then
    raise exception 'Quote upload intents require a pending canonical document';
  end if;

  expected_path := format(
    'contacts/%s/opportunities/%s/quotes/%s/versions/%s/%s.pdf',
    scope_row.contact_id,
    scope_row.lead_id,
    new.quote_id,
    new.quote_version_id,
    new.document_id
  );

  if new.bucket <> 'quote-pdfs'
    or new.path <> expected_path
    or scope_row.document_bucket <> new.bucket
    or scope_row.document_path <> new.path
    or new.path !~ '^contacts/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/opportunities/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/quotes/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/versions/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.pdf$'
  then
    raise exception 'Quote upload intent path must be the server-owned UUID-only path';
  end if;

  if new.expected_mime_type <> 'application/pdf'
    or new.max_size_bytes <> 20971520
    or new.expected_size_bytes is null
    or new.expected_size_bytes < 1
    or new.expected_size_bytes > new.max_size_bytes
  then
    raise exception 'Quote upload intent must require an exact PDF size within the 20 MB limit';
  end if;
  if tg_op = 'INSERT' and new.status <> 'pending' then
    raise exception 'Quote upload intents must start pending';
  end if;
  if (tg_op = 'INSERT' or retrying) and new.expires_at <= now() then
    raise exception 'Quote upload intent expiry must be in the future';
  end if;
  if tg_op = 'UPDATE' and (
    new.id is distinct from old.id
    or new.quote_id is distinct from old.quote_id
    or new.quote_version_id is distinct from old.quote_version_id
    or new.document_id is distinct from old.document_id
    or new.bucket is distinct from old.bucket
    or new.path is distinct from old.path
    or new.expected_mime_type is distinct from old.expected_mime_type
    or new.max_size_bytes is distinct from old.max_size_bytes
    or new.created_at is distinct from old.created_at
    or (
      not retrying
      and (
        new.actor_id is distinct from old.actor_id
        or new.expires_at is distinct from old.expires_at
        or new.expected_size_bytes is distinct from old.expected_size_bytes
        or new.idempotency_key is distinct from old.idempotency_key
      )
    )
  ) then
    raise exception 'Quote upload intent identity and scope are immutable';
  end if;
  if tg_op = 'UPDATE' and new.attempt_count < old.attempt_count then
    raise exception 'Quote upload attempt count cannot decrease';
  end if;
  if tg_op = 'UPDATE' and not (
    (old.status = 'pending' and new.status in ('pending', 'uploaded', 'failed', 'abandoned'))
    or (old.status = 'uploaded' and new.status in ('uploaded', 'finalized', 'failed', 'abandoned'))
    or (old.status = 'failed' and new.status in ('pending', 'failed', 'abandoned'))
    or (old.status = new.status and old.status in ('finalized', 'abandoned'))
  ) then
    raise exception 'Invalid quote upload intent transition';
  end if;

  if new.status = 'uploaded' then
    new.uploaded_at := coalesce(new.uploaded_at, old.uploaded_at, now());
  elsif new.status = 'finalized' then
    new.uploaded_at := coalesce(new.uploaded_at, old.uploaded_at);
    new.finalized_at := coalesce(new.finalized_at, old.finalized_at, now());
    new.abandoned_at := null;
  elsif new.status = 'abandoned' then
    new.abandoned_at := coalesce(new.abandoned_at, old.abandoned_at, now());
    new.finalized_at := null;
  else
    new.uploaded_at := case when retrying then null else new.uploaded_at end;
    new.finalized_at := null;
    new.abandoned_at := null;
  end if;

  return new;
end;
$function$;

create or replace function public.crm_transition_quote(
  p_action text,
  p_quote_id uuid,
  p_quote_version_id uuid,
  p_expected_lock_version integer,
  p_expected_accepted_quote_id uuid,
  p_supersede_reason text,
  p_idempotency_key text
)
returns table(
  quote_id uuid,
  quote_version_id uuid,
  quote_number text,
  version_number integer,
  quote_status text,
  version_status text,
  lock_version integer,
  accepted_version_id uuid,
  superseded_quote_id uuid,
  idempotent_replay boolean
)
language plpgsql
security definer
set search_path = ''
as $function$
declare
  actor_id uuid := auth.uid();
  contact_hint uuid;
  lead_hint uuid;
  scope_row record;
  target_version public.quote_versions%rowtype;
  target_document public.documents%rowtype;
  final_quote public.quotes%rowtype;
  other_accepted_quote public.quotes%rowtype;
  other_accepted_version public.quote_versions%rowtype;
  same_quote_accepted_version public.quote_versions%rowtype;
  next_version_status text;
  event_key text;
  replay_exists boolean;
begin
  if p_action not in ('ready', 'sent', 'accept', 'reject', 'expire', 'cancel') then
    raise invalid_parameter_value using message = 'Quote workflow action is invalid';
  end if;
  if p_quote_id is null or p_quote_version_id is null
    or p_expected_lock_version is null or p_expected_lock_version < 0
  then
    raise invalid_parameter_value using message = 'Quote, version, and expected lock version are required';
  end if;
  if nullif(trim(p_idempotency_key), '') is null
    or length(p_idempotency_key) > 120
    or p_idempotency_key !~ '^[A-Za-z0-9_-]+$'
  then
    raise invalid_parameter_value using message = 'A valid idempotency key is required';
  end if;

  event_key := 'workflow:' || p_action || ':' || p_idempotency_key;
  select q.contact_id, q.lead_id into contact_hint, lead_hint
  from public.quotes q where q.id = p_quote_id;
  if contact_hint is null or lead_hint is null then
    raise exception 'Quote was not found';
  end if;

  -- All quote mutation RPCs use the same parent-to-child lock order.
  perform 1 from public.contacts c where c.id = contact_hint for update;
  perform 1 from public.leads l where l.id = lead_hint for update;
  perform 1 from public.quotes q where q.lead_id = lead_hint order by q.id for update;
  perform 1 from public.quote_versions qv where qv.lead_id = lead_hint order by qv.quote_id, qv.version_number, qv.id for update;
  perform 1
  from public.documents d
  join public.quote_versions qv on qv.id = d.quote_version_id
  where qv.lead_id = lead_hint
  order by d.id
  for update of d;
  perform 1 from public.quote_upload_intents qui where qui.quote_id in (
    select q.id from public.quotes q where q.lead_id = lead_hint
  ) order by qui.quote_id, qui.id for update;

  select
    q.*,
    l.assigned_to,
    l.deleted_at as lead_deleted_at,
    c.deleted_at as contact_deleted_at
  into scope_row
  from public.quotes q
  join public.leads l on l.id = q.lead_id
  join public.contacts c on c.id = q.contact_id
  where q.id = p_quote_id;
  select * into target_version
  from public.quote_versions qv
  where qv.id = p_quote_version_id and qv.quote_id = p_quote_id;
  select * into target_document
  from public.documents d where d.quote_version_id = p_quote_version_id;

  if scope_row.id is null or target_version.id is null
    or scope_row.deleted_at is not null
    or scope_row.lead_deleted_at is not null
    or scope_row.contact_deleted_at is not null
  then
    raise exception 'Quote workflow requires a live quote scope';
  end if;
  if actor_id is null or not (
    public.is_admin()
    or (public.has_role('asesor') and scope_row.assigned_to = actor_id)
  ) then
    raise insufficient_privilege using message = 'Quote workflow requires an administrator or assigned advisor';
  end if;
  if p_action <> 'accept' and scope_row.current_version_id is distinct from target_version.id then
    raise exception 'Workflow action requires the current quote version';
  end if;

  select exists (
    select 1 from public.quote_events qe
    where qe.quote_id = p_quote_id and qe.idempotency_key = event_key
      and qe.quote_version_id = p_quote_version_id
  ) into replay_exists;
  if replay_exists then
    select * into final_quote from public.quotes q where q.id = p_quote_id;
    return query select
      final_quote.id, target_version.id, final_quote.quote_number,
      target_version.version_number, final_quote.status, target_version.status,
      final_quote.lock_version, final_quote.accepted_version_id,
      null::uuid, true;
    return;
  end if;

  if scope_row.lock_version <> p_expected_lock_version then
    raise serialization_failure using message = 'Quote lock version changed';
  end if;

  if p_action = 'ready' then
    if target_version.status = 'ready' then
      select * into final_quote from public.quotes q where q.id = p_quote_id;
      return query select
        final_quote.id, target_version.id, final_quote.quote_number,
        target_version.version_number, final_quote.status, target_version.status,
        final_quote.lock_version, final_quote.accepted_version_id,
        null::uuid, true;
      return;
    end if;
    if target_version.status <> 'draft' or target_version.finalized_at is not null then
      raise exception 'Only an unfinalized draft can become ready';
    end if;
    if target_document.id is null or target_document.storage_state <> 'ready'
      or target_document.status <> 'active' or target_document.mime_type <> 'application/pdf'
    then
      raise exception 'Ready quote versions require a finalized ready PDF';
    end if;
    next_version_status := 'ready';
  elsif p_action = 'sent' then
    if target_version.status = 'sent' then
      select * into final_quote from public.quotes q where q.id = p_quote_id;
      return query select
        final_quote.id, target_version.id, final_quote.quote_number,
        target_version.version_number, final_quote.status, target_version.status,
        final_quote.lock_version, final_quote.accepted_version_id,
        null::uuid, true;
      return;
    end if;
    if target_version.status <> 'ready' then
      raise exception 'Only a ready quote version can be sent';
    end if;
    next_version_status := 'sent';
  elsif p_action = 'accept' then
    if target_version.status = 'accepted' and scope_row.accepted_version_id = target_version.id then
      return query select
        scope_row.id, target_version.id, scope_row.quote_number,
        target_version.version_number, scope_row.status, target_version.status,
        scope_row.lock_version, scope_row.accepted_version_id,
        null::uuid, true;
      return;
    end if;
    if target_version.status not in ('ready', 'sent') then
      raise exception 'Only a ready or sent quote version can be accepted';
    end if;
    next_version_status := 'accepted';
  elsif p_action = 'reject' then
    if target_version.status = 'rejected' then
      select * into final_quote from public.quotes q where q.id = p_quote_id;
      return query select
        final_quote.id, target_version.id, final_quote.quote_number,
        target_version.version_number, final_quote.status, target_version.status,
        final_quote.lock_version, final_quote.accepted_version_id,
        null::uuid, true;
      return;
    end if;
    if target_version.status not in ('draft', 'ready', 'sent') then
      raise exception 'Only an active quote version can be rejected';
    end if;
    next_version_status := 'rejected';
  elsif p_action = 'expire' then
    if target_version.status = 'expired' then
      select * into final_quote from public.quotes q where q.id = p_quote_id;
      return query select
        final_quote.id, target_version.id, final_quote.quote_number,
        target_version.version_number, final_quote.status, target_version.status,
        final_quote.lock_version, final_quote.accepted_version_id,
        null::uuid, true;
      return;
    end if;
    if target_version.status not in ('ready', 'sent') then
      raise exception 'Only a ready or sent quote version can expire';
    end if;
    next_version_status := 'expired';
  else
    if target_version.status = 'cancelled' then
      select * into final_quote from public.quotes q where q.id = p_quote_id;
      return query select
        final_quote.id, target_version.id, final_quote.quote_number,
        target_version.version_number, final_quote.status, target_version.status,
        final_quote.lock_version, final_quote.accepted_version_id,
        null::uuid, true;
      return;
    end if;
    if target_version.status not in ('draft', 'ready', 'sent') then
      raise exception 'Only an active quote version can be cancelled';
    end if;
    next_version_status := 'cancelled';
  end if;

  if p_action in ('sent', 'accept', 'expire')
    or (p_action in ('reject', 'cancel') and target_version.status <> 'draft')
  then
    if target_version.finalized_at is null
      or target_document.id is null
      or target_document.storage_state <> 'ready'
      or target_document.status <> 'active'
      or target_document.mime_type <> 'application/pdf'
    then
      raise exception 'This quote workflow transition requires a finalized ready PDF';
    end if;
  end if;

  if p_action = 'accept' then
    select q.* into other_accepted_quote
    from public.quotes q
    where q.lead_id = scope_row.lead_id
      and q.id <> p_quote_id
      and q.status = 'accepted'
    order by q.id
    limit 1;

    if other_accepted_quote.id is not null then
      if p_expected_accepted_quote_id is distinct from other_accepted_quote.id
        or nullif(trim(p_supersede_reason), '') is null
      then
        raise exception 'Replacing another accepted quote requires its expected ID and a supersede reason';
      end if;
    elsif p_expected_accepted_quote_id is not null then
      raise serialization_failure using message = 'Expected accepted quote changed';
    end if;

    select * into same_quote_accepted_version
    from public.quote_versions qv
    where qv.quote_id = p_quote_id
      and qv.status = 'accepted'
      and qv.id <> target_version.id
    order by qv.version_number desc, qv.id
    limit 1;
    if same_quote_accepted_version.id is not null then
      update public.quote_versions set status = 'superseded'
      where id = same_quote_accepted_version.id;
    end if;

    if other_accepted_quote.id is not null then
      select * into other_accepted_version
      from public.quote_versions qv
      where qv.quote_id = other_accepted_quote.id and qv.status = 'accepted'
      order by qv.version_number desc, qv.id
      limit 1;
      if other_accepted_version.id is null then
        raise exception 'Accepted quote is missing its accepted version';
      end if;

      update public.quote_versions set status = 'superseded'
      where id = other_accepted_version.id;
      update public.quotes q
      set status = 'cancelled', accepted_version_id = null,
          cancelled_at = coalesce(q.cancelled_at, now()),
          lock_version = q.lock_version + 1
      where q.id = other_accepted_quote.id;

      perform public.crm_record_quote_mutation(
        other_accepted_quote.id,
        other_accepted_version.id,
        actor_id,
        'quote_superseded',
        'accepted',
        'cancelled',
        'workflow:accept-superseded:' || p_quote_id::text || ':' || p_idempotency_key,
        jsonb_build_object(
          'supersededByQuoteId', p_quote_id,
          'supersedeReason', trim(p_supersede_reason)
        )
      );
    end if;
  end if;

  update public.quote_versions
  set status = next_version_status
  where id = target_version.id
  returning * into target_version;

  select * into final_quote from public.quotes q where q.id = p_quote_id;
  perform public.crm_record_quote_mutation(
    final_quote.id,
    target_version.id,
    actor_id,
    'quote_' || case when p_action = 'accept' then 'accepted' else next_version_status end,
    scope_row.status,
    final_quote.status,
    event_key,
    jsonb_build_object(
      'versionPreviousStatus', case
        when p_action = 'ready' then 'draft'
        when p_action = 'sent' then 'ready'
        else null
      end,
      'versionNextStatus', next_version_status,
      'supersededQuoteId', other_accepted_quote.id,
      'supersedeReason', nullif(trim(p_supersede_reason), '')
    )
  );

  return query select
    final_quote.id, target_version.id, final_quote.quote_number,
    target_version.version_number, final_quote.status, target_version.status,
    final_quote.lock_version, final_quote.accepted_version_id,
    other_accepted_quote.id, false;
end;
$function$;

create or replace function public.crm_mark_quote_ready(
  p_quote_id uuid,
  p_quote_version_id uuid,
  p_expected_lock_version integer,
  p_idempotency_key text
)
returns table(
  quote_id uuid, quote_version_id uuid, quote_number text,
  version_number integer, quote_status text, version_status text,
  lock_version integer, accepted_version_id uuid,
  superseded_quote_id uuid, idempotent_replay boolean
)
language plpgsql
security definer
set search_path = ''
as $function$
begin
  return query select * from public.crm_transition_quote(
    'ready', p_quote_id, p_quote_version_id, p_expected_lock_version,
    null, null, p_idempotency_key
  );
end;
$function$;

create or replace function public.crm_mark_quote_sent(
  p_quote_id uuid,
  p_quote_version_id uuid,
  p_expected_lock_version integer,
  p_idempotency_key text
)
returns table(
  quote_id uuid, quote_version_id uuid, quote_number text,
  version_number integer, quote_status text, version_status text,
  lock_version integer, accepted_version_id uuid,
  superseded_quote_id uuid, idempotent_replay boolean
)
language plpgsql
security definer
set search_path = ''
as $function$
begin
  return query select * from public.crm_transition_quote(
    'sent', p_quote_id, p_quote_version_id, p_expected_lock_version,
    null, null, p_idempotency_key
  );
end;
$function$;

create or replace function public.crm_accept_quote(
  p_quote_id uuid,
  p_quote_version_id uuid,
  p_expected_lock_version integer,
  p_expected_accepted_quote_id uuid,
  p_supersede_reason text,
  p_idempotency_key text
)
returns table(
  quote_id uuid, quote_version_id uuid, quote_number text,
  version_number integer, quote_status text, version_status text,
  lock_version integer, accepted_version_id uuid,
  superseded_quote_id uuid, idempotent_replay boolean
)
language plpgsql
security definer
set search_path = ''
as $function$
begin
  return query select * from public.crm_transition_quote(
    'accept', p_quote_id, p_quote_version_id, p_expected_lock_version,
    p_expected_accepted_quote_id, p_supersede_reason, p_idempotency_key
  );
end;
$function$;

create or replace function public.crm_reject_quote(
  p_quote_id uuid,
  p_quote_version_id uuid,
  p_expected_lock_version integer,
  p_idempotency_key text
)
returns table(
  quote_id uuid, quote_version_id uuid, quote_number text,
  version_number integer, quote_status text, version_status text,
  lock_version integer, accepted_version_id uuid,
  superseded_quote_id uuid, idempotent_replay boolean
)
language plpgsql
security definer
set search_path = ''
as $function$
begin
  return query select * from public.crm_transition_quote(
    'reject', p_quote_id, p_quote_version_id, p_expected_lock_version,
    null, null, p_idempotency_key
  );
end;
$function$;

create or replace function public.crm_expire_quote(
  p_quote_id uuid,
  p_quote_version_id uuid,
  p_expected_lock_version integer,
  p_idempotency_key text
)
returns table(
  quote_id uuid, quote_version_id uuid, quote_number text,
  version_number integer, quote_status text, version_status text,
  lock_version integer, accepted_version_id uuid,
  superseded_quote_id uuid, idempotent_replay boolean
)
language plpgsql
security definer
set search_path = ''
as $function$
begin
  return query select * from public.crm_transition_quote(
    'expire', p_quote_id, p_quote_version_id, p_expected_lock_version,
    null, null, p_idempotency_key
  );
end;
$function$;

create or replace function public.crm_cancel_quote(
  p_quote_id uuid,
  p_quote_version_id uuid,
  p_expected_lock_version integer,
  p_idempotency_key text
)
returns table(
  quote_id uuid, quote_version_id uuid, quote_number text,
  version_number integer, quote_status text, version_status text,
  lock_version integer, accepted_version_id uuid,
  superseded_quote_id uuid, idempotent_replay boolean
)
language plpgsql
security definer
set search_path = ''
as $function$
begin
  return query select * from public.crm_transition_quote(
    'cancel', p_quote_id, p_quote_version_id, p_expected_lock_version,
    null, null, p_idempotency_key
  );
end;
$function$;

create or replace function public.crm_soft_delete_quote(
  p_quote_id uuid,
  p_expected_lock_version integer,
  p_confirmation text,
  p_reason text,
  p_idempotency_key text
)
returns table(
  quote_id uuid,
  quote_number text,
  quote_status text,
  lock_version integer,
  deleted_at timestamptz,
  deleted boolean,
  idempotent_replay boolean
)
language plpgsql
security definer
set search_path = ''
as $function$
declare
  actor_id uuid := auth.uid();
  contact_hint uuid;
  lead_hint uuid;
  scope_row record;
  final_quote public.quotes%rowtype;
  replay_exists boolean;
begin
  if p_quote_id is null or p_expected_lock_version is null or p_expected_lock_version < 0 then
    raise invalid_parameter_value using message = 'Quote and expected lock version are required';
  end if;
  if p_confirmation is distinct from 'ELIMINAR COTIZACION' then
    raise invalid_parameter_value using message = 'Type ELIMINAR COTIZACION to confirm';
  end if;
  if nullif(trim(p_reason), '') is null or length(trim(p_reason)) > 500 then
    raise invalid_parameter_value using message = 'A deletion reason is required';
  end if;
  if nullif(trim(p_idempotency_key), '') is null
    or length(p_idempotency_key) > 120
    or p_idempotency_key !~ '^[A-Za-z0-9_-]+$'
  then
    raise invalid_parameter_value using message = 'A valid idempotency key is required';
  end if;

  select q.contact_id, q.lead_id into contact_hint, lead_hint
  from public.quotes q where q.id = p_quote_id;
  if contact_hint is null or lead_hint is null then
    raise exception 'Quote was not found';
  end if;
  perform 1 from public.contacts c where c.id = contact_hint for update;
  perform 1 from public.leads l where l.id = lead_hint for update;
  perform 1 from public.quotes q where q.lead_id = lead_hint order by q.id for update;
  perform 1 from public.quote_versions qv where qv.lead_id = lead_hint order by qv.quote_id, qv.version_number, qv.id for update;
  perform 1
  from public.documents d
  join public.quote_versions qv on qv.id = d.quote_version_id
  where qv.lead_id = lead_hint order by d.id for update of d;
  perform 1 from public.quote_upload_intents qui where qui.quote_id in (
    select q.id from public.quotes q where q.lead_id = lead_hint
  ) order by qui.quote_id, qui.id for update;

  select q.*, l.assigned_to, l.deleted_at as lead_deleted_at,
    c.deleted_at as contact_deleted_at
  into scope_row
  from public.quotes q
  join public.leads l on l.id = q.lead_id
  join public.contacts c on c.id = q.contact_id
  where q.id = p_quote_id;
  if scope_row.lead_deleted_at is not null or scope_row.contact_deleted_at is not null then
    raise exception 'Quote deletion requires a live contact and opportunity';
  end if;
  if actor_id is null or not (
    public.is_admin()
    or (public.has_role('asesor') and scope_row.assigned_to = actor_id)
  ) then
    raise insufficient_privilege using message = 'Quote deletion requires an administrator or assigned advisor';
  end if;

  select exists (
    select 1 from public.quote_events qe
    where qe.quote_id = p_quote_id
      and qe.idempotency_key = 'soft-delete:' || p_idempotency_key
  ) into replay_exists;
  if replay_exists or scope_row.deleted_at is not null then
    return query select
      scope_row.id, scope_row.quote_number, scope_row.status,
      scope_row.lock_version, scope_row.deleted_at, true, true;
    return;
  end if;
  if scope_row.lock_version <> p_expected_lock_version then
    raise serialization_failure using message = 'Quote lock version changed';
  end if;

  update public.quotes q
  set deleted_at = now(), deleted_by = actor_id, deleted_reason = trim(p_reason),
      lock_version = q.lock_version + 1
  where q.id = p_quote_id
  returning * into final_quote;

  perform public.crm_record_quote_mutation(
    final_quote.id, final_quote.current_version_id, actor_id,
    'quote_soft_deleted', scope_row.status, scope_row.status,
    'soft-delete:' || p_idempotency_key,
    jsonb_build_object('reason', trim(p_reason), 'deleted', true)
  );
  return query select
    final_quote.id, final_quote.quote_number, final_quote.status,
    final_quote.lock_version, final_quote.deleted_at, true, false;
end;
$function$;

create or replace function public.crm_restore_quote(
  p_quote_id uuid,
  p_expected_lock_version integer,
  p_confirmation text,
  p_idempotency_key text
)
returns table(
  quote_id uuid,
  quote_number text,
  quote_status text,
  lock_version integer,
  deleted_at timestamptz,
  restored boolean,
  idempotent_replay boolean
)
language plpgsql
security definer
set search_path = ''
as $function$
declare
  actor_id uuid := auth.uid();
  contact_hint uuid;
  lead_hint uuid;
  scope_row record;
  final_quote public.quotes%rowtype;
  replay_exists boolean;
begin
  if p_quote_id is null or p_expected_lock_version is null or p_expected_lock_version < 0 then
    raise invalid_parameter_value using message = 'Quote and expected lock version are required';
  end if;
  if p_confirmation is distinct from 'RESTAURAR COTIZACION' then
    raise invalid_parameter_value using message = 'Type RESTAURAR COTIZACION to confirm';
  end if;
  if nullif(trim(p_idempotency_key), '') is null
    or length(p_idempotency_key) > 120
    or p_idempotency_key !~ '^[A-Za-z0-9_-]+$'
  then
    raise invalid_parameter_value using message = 'A valid idempotency key is required';
  end if;

  select q.contact_id, q.lead_id into contact_hint, lead_hint
  from public.quotes q where q.id = p_quote_id;
  if contact_hint is null or lead_hint is null then
    raise exception 'Quote was not found';
  end if;
  perform 1 from public.contacts c where c.id = contact_hint for update;
  perform 1 from public.leads l where l.id = lead_hint for update;
  perform 1 from public.quotes q where q.lead_id = lead_hint order by q.id for update;
  perform 1 from public.quote_versions qv where qv.lead_id = lead_hint order by qv.quote_id, qv.version_number, qv.id for update;
  perform 1
  from public.documents d
  join public.quote_versions qv on qv.id = d.quote_version_id
  where qv.lead_id = lead_hint order by d.id for update of d;
  perform 1 from public.quote_upload_intents qui where qui.quote_id in (
    select q.id from public.quotes q where q.lead_id = lead_hint
  ) order by qui.quote_id, qui.id for update;

  select q.*, l.assigned_to, l.deleted_at as lead_deleted_at,
    c.deleted_at as contact_deleted_at
  into scope_row
  from public.quotes q
  join public.leads l on l.id = q.lead_id
  join public.contacts c on c.id = q.contact_id
  where q.id = p_quote_id;
  if scope_row.lead_deleted_at is not null or scope_row.contact_deleted_at is not null then
    raise exception 'Quote restore requires a live contact and opportunity';
  end if;
  if actor_id is null or not (
    public.is_admin()
    or (public.has_role('asesor') and scope_row.assigned_to = actor_id)
  ) then
    raise insufficient_privilege using message = 'Quote restore requires an administrator or assigned advisor';
  end if;

  select exists (
    select 1 from public.quote_events qe
    where qe.quote_id = p_quote_id
      and qe.idempotency_key = 'restore:' || p_idempotency_key
  ) into replay_exists;
  if replay_exists or scope_row.deleted_at is null then
    return query select
      scope_row.id, scope_row.quote_number, scope_row.status,
      scope_row.lock_version, scope_row.deleted_at, true, true;
    return;
  end if;
  if scope_row.lock_version <> p_expected_lock_version then
    raise serialization_failure using message = 'Quote lock version changed';
  end if;
  if scope_row.status = 'accepted' and exists (
    select 1 from public.quotes q
    where q.lead_id = scope_row.lead_id
      and q.id <> p_quote_id
      and q.status = 'accepted'
      and q.deleted_at is null
  ) then
    raise unique_violation using message = 'Another accepted quote already exists for this opportunity';
  end if;

  update public.quotes q
  set deleted_at = null, deleted_by = null, deleted_reason = null,
      lock_version = q.lock_version + 1
  where q.id = p_quote_id
  returning * into final_quote;
  perform public.crm_record_quote_mutation(
    final_quote.id, final_quote.current_version_id, actor_id,
    'quote_restored', scope_row.status, final_quote.status,
    'restore:' || p_idempotency_key,
    jsonb_build_object('restored', true)
  );
  return query select
    final_quote.id, final_quote.quote_number, final_quote.status,
    final_quote.lock_version, final_quote.deleted_at, true, false;
end;
$function$;

-- Keep the embedded opportunity UI compatible until it moves to the new RPCs.
-- This signature intentionally has no PDF gate because enforcing one here before
-- the UI cutover would strand existing production drafts. It never supersedes a
-- different accepted quote without the explicit context required by crm_accept_quote.
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
  contact_hint uuid;
  lead_row record;
  target_version public.quote_versions%rowtype;
  target_quote public.quotes%rowtype;
  conflicting_quote_id uuid;
  rejected_count integer := 0;
  changed_state boolean := false;
begin
  if p_lead_id is null or p_quote_version_id is null then
    raise invalid_parameter_value using message = 'Quote version acceptance requires an opportunity and version';
  end if;
  select l.contact_id into contact_hint from public.leads l where l.id = p_lead_id;
  if contact_hint is null then
    raise exception 'Quote version opportunity was not found';
  end if;

  perform 1 from public.contacts c where c.id = contact_hint for update;
  perform 1 from public.leads l where l.id = p_lead_id for update;
  perform 1 from public.quotes q where q.lead_id = p_lead_id order by q.id for update;
  perform 1 from public.quote_versions qv where qv.lead_id = p_lead_id order by qv.quote_id, qv.version_number, qv.id for update;
  perform 1
  from public.documents d
  join public.quote_versions qv on qv.id = d.quote_version_id
  where qv.lead_id = p_lead_id order by d.id for update of d;
  perform 1 from public.quote_upload_intents qui where qui.quote_id in (
    select q.id from public.quotes q where q.lead_id = p_lead_id
  ) order by qui.quote_id, qui.id for update;

  select l.id, l.contact_id, l.assigned_to, l.deleted_at,
    c.deleted_at as contact_deleted_at
  into lead_row
  from public.leads l join public.contacts c on c.id = l.contact_id
  where l.id = p_lead_id;
  select * into target_version
  from public.quote_versions qv
  where qv.id = p_quote_version_id and qv.lead_id = p_lead_id;
  select * into target_quote
  from public.quotes q where q.id = target_version.quote_id;

  if target_version.id is null or target_quote.id is null or target_quote.deleted_at is not null
    or lead_row.deleted_at is not null or lead_row.contact_deleted_at is not null
  then
    raise exception 'Legacy quote acceptance requires a live quote scope';
  end if;
  if actor_id is null or not (
    public.is_admin()
    or (public.has_role('asesor') and lead_row.assigned_to = actor_id)
  ) then
    raise insufficient_privilege using message = 'Not authorized to accept quote versions';
  end if;
  if target_version.status not in ('draft', 'ready', 'sent', 'accepted') then
    raise exception 'Quote version cannot be accepted from its current status';
  end if;

  select q.id into conflicting_quote_id
  from public.quotes q
  where q.lead_id = p_lead_id and q.id <> target_quote.id
    and q.status = 'accepted'
  order by q.id limit 1;
  if conflicting_quote_id is not null then
    raise exception 'Use crm_accept_quote with explicit supersession to replace another accepted quote';
  end if;

  update public.quote_versions
  set status = 'rejected'
  where quote_id = target_quote.id
    and id <> target_version.id
    and status in ('draft', 'ready', 'sent', 'accepted');
  get diagnostics rejected_count = row_count;

  update public.quote_versions
  set status = 'accepted'
  where id = target_version.id and status is distinct from 'accepted';
  changed_state := rejected_count > 0 or found;

  if changed_state then
    perform public.crm_record_quote_mutation(
      target_quote.id, target_version.id, actor_id,
      'quote_version_accepted', target_quote.status, 'accepted',
      'legacy-accept:' || target_version.id::text || ':' ||
        coalesce((select qv.accepted_at::text from public.quote_versions qv where qv.id = target_version.id), now()::text),
      jsonb_build_object(
        'legacyCompatibility', true,
        'rejectedAlternatives', rejected_count
      )
    );
  end if;
  return query select target_version.id, rejected_count;
end;
$function$;

revoke all on function public.crm_enforce_quote_upload_intent_integrity()
  from public, anon, authenticated, service_role;

create or replace function public.crm_validate_quote_commercial_input(
  p_title text,
  p_summary text,
  p_currency text,
  p_total_amount numeric,
  p_deposit_amount numeric,
  p_notes text,
  p_idempotency_key text
)
returns void
language plpgsql
immutable
security definer
set search_path = ''
as $function$
begin
  if nullif(trim(p_title), '') is null or length(trim(p_title)) > 120 then
    raise invalid_parameter_value using message = 'Quote title must contain between 1 and 120 characters';
  end if;
  if p_summary is not null and length(p_summary) > 400 then
    raise invalid_parameter_value using message = 'Quote summary cannot exceed 400 characters';
  end if;
  if p_notes is not null and length(p_notes) > 2000 then
    raise invalid_parameter_value using message = 'Quote notes cannot exceed 2000 characters';
  end if;
  if p_currency not in ('MXN', 'USD') then
    raise invalid_parameter_value using message = 'Quote currency must be MXN or USD';
  end if;
  if p_total_amount is not null and p_total_amount < 0 then
    raise invalid_parameter_value using message = 'Quote total amount cannot be negative';
  end if;
  if p_deposit_amount is not null and p_deposit_amount < 0 then
    raise invalid_parameter_value using message = 'Quote deposit amount cannot be negative';
  end if;
  if p_total_amount is not null and p_deposit_amount is not null and p_deposit_amount > p_total_amount then
    raise invalid_parameter_value using message = 'Quote deposit amount cannot exceed the total';
  end if;
  if nullif(trim(p_idempotency_key), '') is null
    or length(p_idempotency_key) > 120
    or p_idempotency_key !~ '^[A-Za-z0-9_-]+$'
  then
    raise invalid_parameter_value using message = 'A valid idempotency key is required';
  end if;
end;
$function$;

create or replace function public.crm_record_quote_mutation(
  p_quote_id uuid,
  p_quote_version_id uuid,
  p_actor_id uuid,
  p_event_type text,
  p_previous_status text,
  p_next_status text,
  p_idempotency_key text,
  p_extra_payload jsonb default '{}'::jsonb
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $function$
declare
  quote_row record;
  version_number_value integer;
  event_id uuid;
  event_payload jsonb;
begin
  select q.contact_id, q.lead_id, q.quote_number
  into quote_row
  from public.quotes q
  where q.id = p_quote_id;

  if quote_row.quote_number is null then
    raise exception 'Quote audit scope was not found';
  end if;

  if p_quote_version_id is not null then
    select qv.version_number into version_number_value
    from public.quote_versions qv
    where qv.id = p_quote_version_id and qv.quote_id = p_quote_id;
    if version_number_value is null then
      raise exception 'Quote audit version was not found';
    end if;
  end if;

  event_payload := jsonb_build_object(
    'quoteId', p_quote_id,
    'versionId', p_quote_version_id,
    'number', quote_row.quote_number,
    'version', version_number_value,
    'previousStatus', p_previous_status,
    'nextStatus', p_next_status,
    'actorId', p_actor_id
  ) || coalesce(p_extra_payload, '{}'::jsonb);

  insert into public.quote_events (
    quote_id, quote_version_id, contact_id, lead_id, actor_id,
    event_type, payload, idempotency_key
  ) values (
    p_quote_id, p_quote_version_id, quote_row.contact_id, quote_row.lead_id,
    p_actor_id, p_event_type, event_payload, p_idempotency_key
  )
  on conflict (quote_id, idempotency_key) where idempotency_key is not null do nothing
  returning id into event_id;

  if event_id is not null then
    insert into public.lead_events (lead_id, actor_id, event_type, payload)
    values (quote_row.lead_id, p_actor_id, p_event_type, event_payload);
    return true;
  end if;

  return false;
end;
$function$;

revoke all on function public.crm_validate_quote_commercial_input(text, text, text, numeric, numeric, text, text)
  from public, anon, authenticated, service_role;
revoke all on function public.crm_record_quote_mutation(uuid, uuid, uuid, text, text, text, text, jsonb)
  from public, anon, authenticated, service_role;

create or replace function public.crm_create_quote(
  p_opportunity_id uuid,
  p_title text,
  p_summary text,
  p_currency text,
  p_total_amount numeric,
  p_deposit_amount numeric,
  p_valid_until date,
  p_notes text,
  p_originating_request_id uuid,
  p_idempotency_key text
)
returns table(
  quote_id uuid,
  quote_version_id uuid,
  quote_number text,
  version_number integer,
  quote_status text,
  lock_version integer,
  idempotent_replay boolean
)
language plpgsql
security definer
set search_path = ''
as $function$
declare
  actor_id uuid := auth.uid();
  contact_hint uuid;
  scope_row record;
  existing_row record;
  created_quote public.quotes%rowtype;
  created_version public.quote_versions%rowtype;
begin
  perform public.crm_validate_quote_commercial_input(
    p_title, p_summary, p_currency, p_total_amount, p_deposit_amount,
    p_notes, p_idempotency_key
  );
  if p_opportunity_id is null then
    raise invalid_parameter_value using message = 'Opportunity is required';
  end if;

  select l.contact_id into contact_hint
  from public.leads l where l.id = p_opportunity_id;
  if contact_hint is null then
    raise exception 'Quote opportunity was not found';
  end if;

  perform 1 from public.contacts c where c.id = contact_hint for update;
  perform 1 from public.leads l where l.id = p_opportunity_id for update;
  perform 1 from public.quotes q where q.lead_id = p_opportunity_id order by q.id for update;

  select
    l.id as lead_id,
    l.contact_id,
    l.assigned_to,
    l.deleted_at as lead_deleted_at,
    c.deleted_at as contact_deleted_at
  into scope_row
  from public.leads l
  join public.contacts c on c.id = l.contact_id
  where l.id = p_opportunity_id;

  if scope_row.lead_id is null
    or scope_row.contact_id is distinct from contact_hint
    or scope_row.lead_deleted_at is not null
    or scope_row.contact_deleted_at is not null
  then
    raise exception 'Quote creation requires a live contact and opportunity';
  end if;
  if actor_id is null or not (
    public.is_admin()
    or (public.has_role('asesor') and scope_row.assigned_to = actor_id)
  ) then
    raise insufficient_privilege using message = 'Quote creation requires an administrator or assigned advisor';
  end if;

  select
    q.id as quote_id,
    q.quote_number,
    q.status,
    q.lock_version,
    qv.id as quote_version_id,
    qv.version_number
  into existing_row
  from public.quotes q
  join public.quote_versions qv
    on qv.quote_id = q.id and qv.idempotency_key = p_idempotency_key
  where q.lead_id = p_opportunity_id
    and q.idempotency_key = p_idempotency_key;

  if existing_row.quote_id is not null then
    return query select
      existing_row.quote_id,
      existing_row.quote_version_id,
      existing_row.quote_number,
      existing_row.version_number,
      existing_row.status,
      existing_row.lock_version,
      true;
    return;
  end if;

  if p_originating_request_id is not null and not exists (
    select 1 from public.quote_requests qr
    where qr.id = p_originating_request_id
      and qr.lead_id = scope_row.lead_id
      and qr.contact_id = scope_row.contact_id
  ) then
    raise exception 'Originating request must belong to the same contact and opportunity';
  end if;

  insert into public.quotes (
    contact_id, lead_id, title, status, owner_id, created_by,
    next_version_number, idempotency_key
  ) values (
    scope_row.contact_id, scope_row.lead_id, trim(p_title), 'draft',
    scope_row.assigned_to, actor_id, 2, p_idempotency_key
  ) returning * into created_quote;

  insert into public.quote_versions (
    quote_id, lead_id, contact_id, quote_request_id, idempotency_key,
    version_number, title, summary, currency, total_amount, deposit_amount,
    notes, status, valid_until, created_by
  ) values (
    created_quote.id, scope_row.lead_id, scope_row.contact_id,
    p_originating_request_id, p_idempotency_key, 1, trim(p_title),
    nullif(trim(p_summary), ''), p_currency, p_total_amount, p_deposit_amount,
    nullif(trim(p_notes), ''), 'draft', p_valid_until, actor_id
  ) returning * into created_version;

  if p_originating_request_id is not null then
    insert into public.quote_request_quote_links (
      quote_id, quote_request_id, relation, created_by
    ) values (
      created_quote.id, p_originating_request_id, 'originating', actor_id
    );
  end if;

  perform public.crm_record_quote_mutation(
    created_quote.id,
    created_version.id,
    actor_id,
    'quote_created',
    null,
    'draft',
    'create:' || p_idempotency_key,
    jsonb_build_object('originatingRequestId', p_originating_request_id)
  );

  select * into created_quote from public.quotes q where q.id = created_quote.id;
  return query select
    created_quote.id,
    created_version.id,
    created_quote.quote_number,
    created_version.version_number,
    created_quote.status,
    created_quote.lock_version,
    false;
end;
$function$;

create or replace function public.crm_add_quote_version(
  p_quote_id uuid,
  p_expected_lock_version integer,
  p_title text,
  p_summary text,
  p_currency text,
  p_total_amount numeric,
  p_deposit_amount numeric,
  p_valid_until date,
  p_notes text,
  p_quote_request_id uuid,
  p_clone_version_id uuid,
  p_idempotency_key text
)
returns table(
  quote_id uuid,
  quote_version_id uuid,
  quote_number text,
  version_number integer,
  quote_status text,
  lock_version integer,
  idempotent_replay boolean
)
language plpgsql
security definer
set search_path = ''
as $function$
declare
  actor_id uuid := auth.uid();
  contact_hint uuid;
  lead_hint uuid;
  scope_row record;
  quote_row public.quotes%rowtype;
  source_row public.quote_versions%rowtype;
  previous_current public.quote_versions%rowtype;
  existing_version public.quote_versions%rowtype;
  created_version public.quote_versions%rowtype;
  allocated_version integer;
  final_title text;
  final_summary text;
  final_currency text;
  final_total numeric;
  final_deposit numeric;
  final_valid_until date;
  final_notes text;
  final_request_id uuid;
begin
  if p_quote_id is null or p_expected_lock_version is null or p_expected_lock_version < 0 then
    raise invalid_parameter_value using message = 'Quote and expected lock version are required';
  end if;
  if nullif(trim(p_idempotency_key), '') is null
    or length(p_idempotency_key) > 120
    or p_idempotency_key !~ '^[A-Za-z0-9_-]+$'
  then
    raise invalid_parameter_value using message = 'A valid idempotency key is required';
  end if;

  select q.contact_id, q.lead_id into contact_hint, lead_hint
  from public.quotes q where q.id = p_quote_id;
  if contact_hint is null or lead_hint is null then
    raise exception 'Quote was not found';
  end if;

  perform 1 from public.contacts c where c.id = contact_hint for update;
  perform 1 from public.leads l where l.id = lead_hint for update;
  perform 1 from public.quotes q where q.lead_id = lead_hint order by q.id for update;
  perform 1 from public.quote_versions qv where qv.lead_id = lead_hint order by qv.quote_id, qv.version_number, qv.id for update;

  select
    q.*,
    l.assigned_to,
    l.deleted_at as lead_deleted_at,
    c.deleted_at as contact_deleted_at
  into scope_row
  from public.quotes q
  join public.leads l on l.id = q.lead_id
  join public.contacts c on c.id = q.contact_id
  where q.id = p_quote_id;

  if scope_row.id is null
    or scope_row.deleted_at is not null
    or scope_row.lead_deleted_at is not null
    or scope_row.contact_deleted_at is not null
  then
    raise exception 'Adding a quote version requires a live quote scope';
  end if;
  if actor_id is null or not (
    public.is_admin()
    or (public.has_role('asesor') and scope_row.assigned_to = actor_id)
  ) then
    raise insufficient_privilege using message = 'Adding a quote version requires an administrator or assigned advisor';
  end if;

  select * into existing_version
  from public.quote_versions qv
  where qv.quote_id = p_quote_id and qv.idempotency_key = p_idempotency_key;
  if existing_version.id is not null then
    select * into quote_row from public.quotes q where q.id = p_quote_id;
    return query select
      quote_row.id, existing_version.id, quote_row.quote_number,
      existing_version.version_number, quote_row.status,
      quote_row.lock_version, true;
    return;
  end if;

  if scope_row.lock_version <> p_expected_lock_version then
    raise serialization_failure using message = 'Quote lock version changed';
  end if;

  if p_clone_version_id is not null then
    if p_title is not null or p_summary is not null or p_currency is not null
      or p_total_amount is not null or p_deposit_amount is not null
      or p_valid_until is not null or p_notes is not null
      or p_quote_request_id is not null
    then
      raise invalid_parameter_value using message = 'Clone mode cannot include explicit commercial content';
    end if;
    select * into source_row
    from public.quote_versions qv
    where qv.id = p_clone_version_id and qv.quote_id = p_quote_id;
    if source_row.id is null then
      raise exception 'Clone source must belong to the same quote';
    end if;
    final_title := source_row.title;
    final_summary := source_row.summary;
    final_currency := source_row.currency;
    final_total := source_row.total_amount;
    final_deposit := source_row.deposit_amount;
    final_valid_until := source_row.valid_until;
    final_notes := source_row.notes;
    final_request_id := source_row.quote_request_id;
  else
    perform public.crm_validate_quote_commercial_input(
      p_title, p_summary, p_currency, p_total_amount, p_deposit_amount,
      p_notes, p_idempotency_key
    );
    final_title := trim(p_title);
    final_summary := nullif(trim(p_summary), '');
    final_currency := p_currency;
    final_total := p_total_amount;
    final_deposit := p_deposit_amount;
    final_valid_until := p_valid_until;
    final_notes := nullif(trim(p_notes), '');
    final_request_id := p_quote_request_id;
  end if;

  if final_request_id is not null and not exists (
    select 1 from public.quote_requests qr
    where qr.id = final_request_id
      and qr.lead_id = scope_row.lead_id
      and qr.contact_id = scope_row.contact_id
  ) then
    raise exception 'Quote request must belong to the same contact and opportunity';
  end if;

  select * into previous_current
  from public.quote_versions qv where qv.id = scope_row.current_version_id;
  select greatest(scope_row.next_version_number, coalesce(max(qv.version_number) + 1, 1))
  into allocated_version
  from public.quote_versions qv where qv.quote_id = p_quote_id;

  update public.quotes q
  set next_version_number = allocated_version + 1,
      lock_version = q.lock_version + 1
  where q.id = p_quote_id;

  if previous_current.id is not null
    and previous_current.id is distinct from scope_row.accepted_version_id
    and previous_current.status in ('draft', 'ready')
  then
    update public.quote_versions
    set status = 'superseded'
    where id = previous_current.id;
  end if;

  insert into public.quote_versions (
    quote_id, lead_id, contact_id, quote_request_id, idempotency_key,
    version_number, title, summary, currency, total_amount, deposit_amount,
    notes, status, valid_until, created_by
  ) values (
    p_quote_id, scope_row.lead_id, scope_row.contact_id, final_request_id,
    p_idempotency_key, allocated_version, final_title, final_summary,
    final_currency, final_total, final_deposit, final_notes, 'draft',
    final_valid_until, actor_id
  ) returning * into created_version;

  if final_request_id is not null then
    insert into public.quote_request_quote_links (
      quote_id, quote_request_id, relation, created_by
    ) values (p_quote_id, final_request_id, 'related', actor_id)
    on conflict (quote_id, quote_request_id) do nothing;
  end if;

  perform public.crm_record_quote_mutation(
    p_quote_id,
    created_version.id,
    actor_id,
    'quote_version_created',
    scope_row.status,
    'draft',
    'version-create:' || p_idempotency_key,
    jsonb_build_object(
      'clonedFromVersionId', p_clone_version_id,
      'supersededVersionId', case
        when previous_current.status in ('draft', 'ready')
          and previous_current.id is distinct from scope_row.accepted_version_id
        then previous_current.id
      end
    )
  );

  select * into quote_row from public.quotes q where q.id = p_quote_id;
  return query select
    quote_row.id, created_version.id, quote_row.quote_number,
    created_version.version_number, quote_row.status,
    quote_row.lock_version, false;
end;
$function$;

create or replace function public.crm_begin_quote_pdf_upload(
  p_quote_id uuid,
  p_quote_version_id uuid,
  p_expected_size_bytes bigint,
  p_idempotency_key text
)
returns table(
  quote_id uuid,
  quote_version_id uuid,
  document_id uuid,
  intent_id uuid,
  bucket text,
  path text,
  intent_status text,
  expires_at timestamptz,
  expected_size_bytes bigint,
  attempt_count integer,
  idempotent_replay boolean
)
language plpgsql
security definer
set search_path = ''
as $function$
declare
  upload_actor_id uuid := auth.uid();
  contact_hint uuid;
  lead_hint uuid;
  scope_row record;
  version_row public.quote_versions%rowtype;
  document_row public.documents%rowtype;
  intent_row public.quote_upload_intents%rowtype;
  new_document_id uuid := gen_random_uuid();
  new_intent_id uuid := gen_random_uuid();
  object_path text;
  expiry timestamptz := now() + interval '15 minutes';
begin
  if p_quote_id is null or p_quote_version_id is null then
    raise invalid_parameter_value using message = 'Quote and version are required';
  end if;
  if p_expected_size_bytes is null or p_expected_size_bytes < 1 or p_expected_size_bytes > 20971520 then
    raise invalid_parameter_value using message = 'Expected PDF size must be between 1 byte and 20 MB';
  end if;
  if nullif(trim(p_idempotency_key), '') is null
    or length(p_idempotency_key) > 120
    or p_idempotency_key !~ '^[A-Za-z0-9_-]+$'
  then
    raise invalid_parameter_value using message = 'A valid idempotency key is required';
  end if;

  select q.contact_id, q.lead_id into contact_hint, lead_hint
  from public.quotes q where q.id = p_quote_id;
  if contact_hint is null or lead_hint is null then
    raise exception 'Quote was not found';
  end if;

  perform 1 from public.contacts c where c.id = contact_hint for update;
  perform 1 from public.leads l where l.id = lead_hint for update;
  perform 1 from public.quotes q where q.lead_id = lead_hint order by q.id for update;
  perform 1 from public.quote_versions qv where qv.lead_id = lead_hint order by qv.quote_id, qv.version_number, qv.id for update;
  perform 1
  from public.documents d
  join public.quote_versions qv on qv.id = d.quote_version_id
  where qv.lead_id = lead_hint
  order by d.id
  for update of d;
  perform 1 from public.quote_upload_intents qui where qui.quote_id in (
    select q.id from public.quotes q where q.lead_id = lead_hint
  ) order by qui.quote_id, qui.id for update;

  select
    q.*,
    l.assigned_to,
    l.deleted_at as lead_deleted_at,
    c.deleted_at as contact_deleted_at
  into scope_row
  from public.quotes q
  join public.leads l on l.id = q.lead_id
  join public.contacts c on c.id = q.contact_id
  where q.id = p_quote_id;
  select * into version_row
  from public.quote_versions qv
  where qv.id = p_quote_version_id and qv.quote_id = p_quote_id;

  if scope_row.id is null or version_row.id is null
    or scope_row.deleted_at is not null
    or scope_row.lead_deleted_at is not null
    or scope_row.contact_deleted_at is not null
  then
    raise exception 'PDF upload requires a live quote scope';
  end if;
  if upload_actor_id is null or not (
    public.is_admin()
    or (public.has_role('asesor') and scope_row.assigned_to = upload_actor_id)
  ) then
    raise insufficient_privilege using message = 'PDF upload requires an administrator or assigned advisor';
  end if;
  if version_row.status <> 'draft' or version_row.finalized_at is not null then
    raise exception 'Only an unfinalized draft version can begin a PDF upload';
  end if;

  select * into document_row
  from public.documents d where d.quote_version_id = p_quote_version_id;
  select * into intent_row
  from public.quote_upload_intents qui where qui.quote_version_id = p_quote_version_id;

  if intent_row.id is not null
    and intent_row.status = 'pending'
    and intent_row.expires_at > now()
    and intent_row.idempotency_key = p_idempotency_key
  then
    if intent_row.actor_id <> upload_actor_id then
      raise insufficient_privilege using message = 'Only the upload intent actor can reuse this pending upload';
    end if;
    if intent_row.expected_size_bytes <> p_expected_size_bytes then
      raise invalid_parameter_value using message = 'Idempotent upload retry changed the expected PDF size';
    end if;
    return query select
      intent_row.quote_id, intent_row.quote_version_id, intent_row.document_id,
      intent_row.id, intent_row.bucket, intent_row.path, intent_row.status,
      intent_row.expires_at, intent_row.expected_size_bytes,
      intent_row.attempt_count, true;
    return;
  end if;

  if intent_row.id is not null and intent_row.status = 'pending' and intent_row.expires_at <= now() then
    update public.documents set storage_state = 'failed' where id = intent_row.document_id;
    update public.quote_upload_intents
    set status = 'failed', last_error_code = 'intent_expired',
        last_error_message = 'Upload intent expired before finalization'
    where id = intent_row.id;
    select * into document_row from public.documents d where d.id = intent_row.document_id;
    select * into intent_row from public.quote_upload_intents qui where qui.id = intent_row.id;
  end if;

  if intent_row.id is not null and intent_row.status <> 'failed' then
    raise exception 'Canonical PDF upload is already active or finalized';
  end if;

  if intent_row.id is not null then
    if document_row.storage_state = 'ready' then
      raise exception 'Ready canonical PDF documents cannot be replaced';
    end if;
    update public.documents
    set storage_state = 'pending', status = 'active'
    where id = document_row.id;
    update public.quote_upload_intents qui
    set actor_id = upload_actor_id,
        status = 'pending',
        expected_size_bytes = p_expected_size_bytes,
        expires_at = expiry,
        idempotency_key = p_idempotency_key,
        attempt_count = qui.attempt_count + 1,
        last_error_code = null,
        last_error_message = null,
        uploaded_at = null
    where qui.id = intent_row.id
    returning * into intent_row;
  else
    object_path := format(
      'contacts/%s/opportunities/%s/quotes/%s/versions/%s/%s.pdf',
      scope_row.contact_id, scope_row.lead_id, p_quote_id,
      p_quote_version_id, new_document_id
    );
    insert into public.documents (
      id, booking_id, lead_id, contact_id, uploaded_by, document_type,
      title, bucket, path, status, quote_version_id, storage_state,
      mime_type, quote_link_source
    ) values (
      new_document_id, null, scope_row.lead_id, scope_row.contact_id,
      upload_actor_id, 'quote', scope_row.quote_number || ' V' || version_row.version_number,
      'quote-pdfs', object_path, 'active', p_quote_version_id, 'pending',
      'application/pdf', 'native'
    ) returning * into document_row;

    insert into public.quote_upload_intents (
      id, quote_id, quote_version_id, document_id, actor_id, bucket, path,
      status, expected_mime_type, max_size_bytes, expected_size_bytes,
      attempt_count, expires_at, idempotency_key
    ) values (
      new_intent_id, p_quote_id, p_quote_version_id, document_row.id, upload_actor_id,
      'quote-pdfs', object_path, 'pending', 'application/pdf', 20971520,
      p_expected_size_bytes, 1, expiry, p_idempotency_key
    ) returning * into intent_row;
  end if;

  perform public.crm_record_quote_mutation(
    p_quote_id, p_quote_version_id, upload_actor_id, 'quote_pdf_upload_started',
    scope_row.status, scope_row.status,
    'upload-begin:' || p_idempotency_key,
    jsonb_build_object(
      'documentId', intent_row.document_id,
      'intentId', intent_row.id,
      'expectedSizeBytes', p_expected_size_bytes,
      'attempt', intent_row.attempt_count
    )
  );

  return query select
    intent_row.quote_id, intent_row.quote_version_id, intent_row.document_id,
    intent_row.id, intent_row.bucket, intent_row.path, intent_row.status,
    intent_row.expires_at, intent_row.expected_size_bytes,
    intent_row.attempt_count, false;
end;
$function$;

create or replace function public.crm_finalize_quote_pdf_upload(
  p_intent_id uuid,
  p_sha256 text,
  p_idempotency_key text
)
returns table(
  quote_id uuid,
  quote_version_id uuid,
  document_id uuid,
  intent_id uuid,
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
  actor_id uuid;
  contact_hint uuid;
  lead_hint uuid;
  quote_hint uuid;
  scope_row record;
  version_row public.quote_versions%rowtype;
  document_row public.documents%rowtype;
  intent_row public.quote_upload_intents%rowtype;
  object_row record;
  object_size bigint;
  object_size_text text;
  object_mime text;
  final_quote public.quotes%rowtype;
begin
  if auth.role() is distinct from 'service_role' then
    raise insufficient_privilege using message = 'PDF finalization requires the trusted server boundary';
  end if;
  if p_intent_id is null then
    raise invalid_parameter_value using message = 'Upload intent is required';
  end if;
  if p_sha256 is null or p_sha256 !~ '^[0-9a-f]{64}$' then
    raise invalid_parameter_value using message = 'A lowercase SHA-256 checksum is required';
  end if;
  if nullif(trim(p_idempotency_key), '') is null
    or length(p_idempotency_key) > 120
    or p_idempotency_key !~ '^[A-Za-z0-9_-]+$'
  then
    raise invalid_parameter_value using message = 'A valid idempotency key is required';
  end if;

  select qui.quote_id into quote_hint
  from public.quote_upload_intents qui where qui.id = p_intent_id;
  select q.contact_id, q.lead_id into contact_hint, lead_hint
  from public.quotes q where q.id = quote_hint;
  if quote_hint is null or contact_hint is null or lead_hint is null then
    raise exception 'Quote upload intent was not found';
  end if;

  perform 1 from public.contacts c where c.id = contact_hint for update;
  perform 1 from public.leads l where l.id = lead_hint for update;
  perform 1 from public.quotes q where q.lead_id = lead_hint order by q.id for update;
  perform 1 from public.quote_versions qv where qv.lead_id = lead_hint order by qv.quote_id, qv.version_number, qv.id for update;
  perform 1
  from public.documents d
  join public.quote_versions qv on qv.id = d.quote_version_id
  where qv.lead_id = lead_hint
  order by d.id
  for update of d;
  perform 1 from public.quote_upload_intents qui where qui.quote_id in (
    select q.id from public.quotes q where q.lead_id = lead_hint
  ) order by qui.quote_id, qui.id for update;

  select * into intent_row from public.quote_upload_intents qui where qui.id = p_intent_id;
  select * into version_row from public.quote_versions qv where qv.id = intent_row.quote_version_id;
  select * into document_row from public.documents d where d.id = intent_row.document_id;
  actor_id := intent_row.actor_id;
  select
    q.*,
    l.assigned_to,
    l.deleted_at as lead_deleted_at,
    c.deleted_at as contact_deleted_at
  into scope_row
  from public.quotes q
  join public.leads l on l.id = q.lead_id
  join public.contacts c on c.id = q.contact_id
  where q.id = intent_row.quote_id;

  if intent_row.id is null or actor_id is null or version_row.id is null or document_row.id is null
    or version_row.quote_id is distinct from intent_row.quote_id
    or document_row.quote_version_id is distinct from intent_row.quote_version_id
    or scope_row.id is null or scope_row.deleted_at is not null
    or scope_row.lead_deleted_at is not null
    or scope_row.contact_deleted_at is not null
  then
    raise exception 'PDF finalization requires a live canonical quote scope';
  end if;
  if not exists (
    select 1
    from public.profile_roles pr
    join public.roles r on r.id = pr.role_id
    join public.profiles p on p.id = pr.profile_id
    where pr.profile_id = actor_id and p.is_active
      and (r.name = 'admin' or (r.name = 'asesor' and scope_row.assigned_to = actor_id))
  ) then
    raise insufficient_privilege using message = 'The upload intent actor no longer has scope to finalize this PDF';
  end if;

  if intent_row.status = 'finalized' then
    if document_row.storage_state <> 'ready' or document_row.sha256 <> p_sha256 then
      raise exception 'Finalized upload state is inconsistent with the requested checksum';
    end if;
    return query select
      intent_row.quote_id, intent_row.quote_version_id, intent_row.document_id,
      intent_row.id, document_row.storage_state, version_row.status,
      scope_row.status, scope_row.lock_version, true;
    return;
  end if;

  if intent_row.status not in ('pending', 'uploaded') or intent_row.expires_at <= now() then
    raise exception 'Upload intent is not pending and unexpired';
  end if;
  if version_row.status <> 'draft' or version_row.finalized_at is not null then
    raise exception 'Only an unfinalized draft version can finalize a PDF upload';
  end if;
  if document_row.storage_state <> 'pending'
    or document_row.bucket <> intent_row.bucket
    or document_row.path <> intent_row.path
    or document_row.quote_version_id <> intent_row.quote_version_id
    or document_row.mime_type <> 'application/pdf'
  then
    raise exception 'Canonical quote document does not match the upload intent';
  end if;

  select so.id, so.bucket_id, so.name, so.metadata
  into object_row
  from storage.objects so
  where so.bucket_id = intent_row.bucket and so.name = intent_row.path
  for update;
  if object_row.id is null then
    raise exception 'Uploaded PDF object was not found';
  end if;

  object_size_text := coalesce(
    nullif(object_row.metadata ->> 'size', ''),
    nullif(object_row.metadata ->> 'contentLength', '')
  );
  if object_size_text is null or object_size_text !~ '^[0-9]+$' then
    raise exception 'Uploaded PDF object size metadata is invalid';
  end if;
  object_size := object_size_text::bigint;
  object_mime := lower(coalesce(
    nullif(object_row.metadata ->> 'mimetype', ''),
    nullif(object_row.metadata ->> 'contentType', '')
  ));

  if object_row.bucket_id <> 'quote-pdfs'
    or object_row.name <> intent_row.path
    or lower(storage.extension(object_row.name)) <> 'pdf'
    or object_mime <> 'application/pdf'
    or object_size <> intent_row.expected_size_bytes
    or object_size < 1
    or object_size > intent_row.max_size_bytes
  then
    raise exception 'Uploaded object metadata does not match the PDF upload intent';
  end if;

  if intent_row.status = 'pending' then
    update public.quote_upload_intents
    set status = 'uploaded', uploaded_at = now()
    where id = intent_row.id;
  end if;

  update public.documents
  set storage_state = 'ready', status = 'active', mime_type = 'application/pdf',
      byte_size = object_size, sha256 = p_sha256, uploaded_at = now()
  where id = document_row.id
  returning * into document_row;

  update public.quote_versions
  set status = 'ready'
  where id = version_row.id
  returning * into version_row;

  update public.quote_upload_intents
  set status = 'finalized', finalized_at = now(),
      last_error_code = null, last_error_message = null
  where id = intent_row.id
  returning * into intent_row;

  select * into final_quote from public.quotes q where q.id = scope_row.id;
  perform public.crm_record_quote_mutation(
    final_quote.id, version_row.id, actor_id, 'quote_pdf_upload_finalized',
    'draft', final_quote.status,
    'upload-finalize:' || p_idempotency_key,
    jsonb_build_object(
      'documentId', document_row.id,
      'intentId', intent_row.id,
      'byteSize', object_size,
      'sha256', p_sha256
    )
  );

  return query select
    final_quote.id, version_row.id, document_row.id, intent_row.id,
    document_row.storage_state, version_row.status, final_quote.status,
    final_quote.lock_version, false;
end;
$function$;

create or replace function public.crm_fail_quote_pdf_upload(
  p_intent_id uuid,
  p_error_code text,
  p_error_message text,
  p_idempotency_key text
)
returns table(
  quote_id uuid,
  quote_version_id uuid,
  document_id uuid,
  intent_id uuid,
  document_state text,
  intent_status text,
  attempt_count integer,
  idempotent_replay boolean
)
language plpgsql
security definer
set search_path = ''
as $function$
declare
  actor_id uuid := auth.uid();
  contact_hint uuid;
  lead_hint uuid;
  quote_hint uuid;
  scope_row record;
  document_row public.documents%rowtype;
  intent_row public.quote_upload_intents%rowtype;
  replay_exists boolean;
begin
  if p_intent_id is null
    or nullif(trim(p_error_code), '') is null
    or length(p_error_code) > 80
    or p_error_code !~ '^[a-z0-9_:-]+$'
    or nullif(trim(p_error_message), '') is null
    or length(p_error_message) > 500
  then
    raise invalid_parameter_value using message = 'A bounded upload failure code and message are required';
  end if;
  if nullif(trim(p_idempotency_key), '') is null
    or length(p_idempotency_key) > 120
    or p_idempotency_key !~ '^[A-Za-z0-9_-]+$'
  then
    raise invalid_parameter_value using message = 'A valid idempotency key is required';
  end if;

  select qui.quote_id into quote_hint
  from public.quote_upload_intents qui where qui.id = p_intent_id;
  select q.contact_id, q.lead_id into contact_hint, lead_hint
  from public.quotes q where q.id = quote_hint;
  if quote_hint is null or contact_hint is null or lead_hint is null then
    raise exception 'Quote upload intent was not found';
  end if;

  perform 1 from public.contacts c where c.id = contact_hint for update;
  perform 1 from public.leads l where l.id = lead_hint for update;
  perform 1 from public.quotes q where q.lead_id = lead_hint order by q.id for update;
  perform 1 from public.quote_versions qv where qv.lead_id = lead_hint order by qv.quote_id, qv.version_number, qv.id for update;
  perform 1
  from public.documents d
  join public.quote_versions qv on qv.id = d.quote_version_id
  where qv.lead_id = lead_hint
  order by d.id
  for update of d;
  perform 1 from public.quote_upload_intents qui where qui.quote_id in (
    select q.id from public.quotes q where q.lead_id = lead_hint
  ) order by qui.quote_id, qui.id for update;

  select * into intent_row from public.quote_upload_intents qui where qui.id = p_intent_id;
  select * into document_row from public.documents d where d.id = intent_row.document_id;
  select
    q.id,
    q.status,
    q.deleted_at,
    l.assigned_to,
    l.deleted_at as lead_deleted_at,
    c.deleted_at as contact_deleted_at
  into scope_row
  from public.quotes q
  join public.leads l on l.id = q.lead_id
  join public.contacts c on c.id = q.contact_id
  where q.id = intent_row.quote_id;

  if intent_row.id is null or document_row.id is null or scope_row.id is null
    or scope_row.deleted_at is not null
    or scope_row.lead_deleted_at is not null
    or scope_row.contact_deleted_at is not null
  then
    raise exception 'Upload failure requires a live canonical quote scope';
  end if;
  if actor_id is null or intent_row.actor_id <> actor_id or not (
    public.is_admin()
    or (public.has_role('asesor') and scope_row.assigned_to = actor_id)
  ) then
    raise insufficient_privilege using message = 'Only the upload intent actor can fail this PDF upload';
  end if;
  if intent_row.status = 'finalized' or document_row.storage_state = 'ready' then
    return query select
      intent_row.quote_id, intent_row.quote_version_id, intent_row.document_id,
      intent_row.id, document_row.storage_state, intent_row.status,
      intent_row.attempt_count, true;
    return;
  end if;
  if intent_row.status not in ('pending', 'uploaded', 'failed') then
    raise exception 'Upload intent cannot fail from its current state';
  end if;

  select exists (
    select 1 from public.quote_events qe
    where qe.quote_id = intent_row.quote_id
      and qe.idempotency_key = 'upload-fail:' || p_idempotency_key
  ) into replay_exists;
  if replay_exists then
    return query select
      intent_row.quote_id, intent_row.quote_version_id, intent_row.document_id,
      intent_row.id, document_row.storage_state, intent_row.status,
      intent_row.attempt_count, true;
    return;
  end if;

  if document_row.storage_state <> 'failed' then
    update public.documents set storage_state = 'failed'
    where id = document_row.id
    returning * into document_row;
  end if;
  update public.quote_upload_intents
  set status = 'failed', last_error_code = trim(p_error_code),
      last_error_message = trim(p_error_message)
  where id = intent_row.id
  returning * into intent_row;

  perform public.crm_record_quote_mutation(
    intent_row.quote_id, intent_row.quote_version_id, actor_id,
    'quote_pdf_upload_failed', scope_row.status, scope_row.status,
    'upload-fail:' || p_idempotency_key,
    jsonb_build_object(
      'documentId', document_row.id,
      'intentId', intent_row.id,
      'errorCode', trim(p_error_code),
      'attempt', intent_row.attempt_count
    )
  );

  return query select
    intent_row.quote_id, intent_row.quote_version_id, intent_row.document_id,
    intent_row.id, document_row.storage_state, intent_row.status,
    intent_row.attempt_count, false;
end;
$function$;

-- Migration 0057 is the planned UI cutover boundary. It must revoke the legacy
-- direct INSERT/UPDATE grants and policies on quote_versions after every caller
-- has moved to these RPCs. They remain unchanged here to avoid a deploy-order outage.

revoke all on function public.crm_transition_quote(text, uuid, uuid, integer, uuid, text, text)
  from public, anon, authenticated, service_role;
revoke all on function public.crm_create_quote(uuid, text, text, text, numeric, numeric, date, text, uuid, text)
  from public, anon, service_role;
revoke all on function public.crm_add_quote_version(uuid, integer, text, text, text, numeric, numeric, date, text, uuid, uuid, text)
  from public, anon, service_role;
revoke all on function public.crm_begin_quote_pdf_upload(uuid, uuid, bigint, text)
  from public, anon, service_role;
revoke all on function public.crm_finalize_quote_pdf_upload(uuid, text, text)
  from public, anon, authenticated, service_role;
revoke all on function public.crm_fail_quote_pdf_upload(uuid, text, text, text)
  from public, anon, service_role;
revoke all on function public.crm_mark_quote_ready(uuid, uuid, integer, text)
  from public, anon, service_role;
revoke all on function public.crm_mark_quote_sent(uuid, uuid, integer, text)
  from public, anon, service_role;
revoke all on function public.crm_accept_quote(uuid, uuid, integer, uuid, text, text)
  from public, anon, service_role;
revoke all on function public.crm_reject_quote(uuid, uuid, integer, text)
  from public, anon, service_role;
revoke all on function public.crm_expire_quote(uuid, uuid, integer, text)
  from public, anon, service_role;
revoke all on function public.crm_cancel_quote(uuid, uuid, integer, text)
  from public, anon, service_role;
revoke all on function public.crm_soft_delete_quote(uuid, integer, text, text, text)
  from public, anon, service_role;
revoke all on function public.crm_restore_quote(uuid, integer, text, text)
  from public, anon, service_role;
revoke all on function public.crm_accept_quote_version(uuid, uuid)
  from public, anon, service_role;

grant execute on function public.crm_create_quote(uuid, text, text, text, numeric, numeric, date, text, uuid, text)
  to authenticated;
grant execute on function public.crm_add_quote_version(uuid, integer, text, text, text, numeric, numeric, date, text, uuid, uuid, text)
  to authenticated;
grant execute on function public.crm_begin_quote_pdf_upload(uuid, uuid, bigint, text)
  to authenticated;
grant execute on function public.crm_finalize_quote_pdf_upload(uuid, text, text)
  to service_role;
grant execute on function public.crm_fail_quote_pdf_upload(uuid, text, text, text)
  to authenticated;
grant execute on function public.crm_mark_quote_ready(uuid, uuid, integer, text)
  to authenticated;
grant execute on function public.crm_mark_quote_sent(uuid, uuid, integer, text)
  to authenticated;
grant execute on function public.crm_accept_quote(uuid, uuid, integer, uuid, text, text)
  to authenticated;
grant execute on function public.crm_reject_quote(uuid, uuid, integer, text)
  to authenticated;
grant execute on function public.crm_expire_quote(uuid, uuid, integer, text)
  to authenticated;
grant execute on function public.crm_cancel_quote(uuid, uuid, integer, text)
  to authenticated;
grant execute on function public.crm_soft_delete_quote(uuid, integer, text, text, text)
  to authenticated;
grant execute on function public.crm_restore_quote(uuid, integer, text, text)
  to authenticated;
grant execute on function public.crm_accept_quote_version(uuid, uuid)
  to authenticated;
