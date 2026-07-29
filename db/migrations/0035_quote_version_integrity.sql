-- Harden quote version relationship invariants, workflow timestamps, and atomic acceptance audit.

create or replace function public.crm_enforce_quote_version_integrity()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  lead_contact_id uuid;
  request_row record;
  previous_sent_at timestamptz := case when tg_op = 'UPDATE' then old.sent_at else null end;
  previous_accepted_at timestamptz := case when tg_op = 'UPDATE' then old.accepted_at else null end;
  previous_rejected_at timestamptz := case when tg_op = 'UPDATE' then old.rejected_at else null end;
  previous_expired_at timestamptz := case when tg_op = 'UPDATE' then old.expired_at else null end;
begin
  if tg_op = 'UPDATE'
    and (
      new.lead_id is distinct from old.lead_id
      or new.contact_id is distinct from old.contact_id
      or new.quote_request_id is distinct from old.quote_request_id
    )
  then
    raise exception 'Quote version relationships are immutable after creation';
  end if;

  select l.contact_id
  into lead_contact_id
  from public.leads l
  where l.id = new.lead_id;

  if lead_contact_id is null then
    raise exception 'Quote version lead was not found';
  end if;

  if new.contact_id is distinct from lead_contact_id then
    raise exception 'Quote version contact must match the lead contact';
  end if;

  if new.quote_request_id is not null then
    select qr.lead_id, qr.contact_id
    into request_row
    from public.quote_requests qr
    where qr.id = new.quote_request_id;

    if request_row.lead_id is null or request_row.contact_id is null then
      raise exception 'Quote version intake request must stay linked to the same lead and contact';
    end if;

    if request_row.lead_id is distinct from new.lead_id
      or request_row.contact_id is distinct from new.contact_id
    then
      raise exception 'Quote version intake request must belong to the same lead and contact';
    end if;
  end if;

  if new.status = 'draft' then
    new.sent_at := null;
    new.accepted_at := null;
    new.rejected_at := null;
    new.expired_at := null;
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
  end if;

  return new;
end;
$$;

alter table public.quote_versions
  drop constraint if exists quote_versions_status_timestamps_coherent;

alter table public.quote_versions
  add constraint quote_versions_status_timestamps_coherent
  check (
    case
      when status = 'draft' then sent_at is null and accepted_at is null and rejected_at is null and expired_at is null
      when status = 'sent' then accepted_at is null and rejected_at is null and expired_at is null
      when status = 'accepted' then accepted_at is not null and rejected_at is null and expired_at is null
      when status = 'rejected' then rejected_at is not null and accepted_at is null and expired_at is null
      when status = 'expired' then expired_at is not null and accepted_at is null and rejected_at is null
      else false
    end
  ) not valid;

drop trigger if exists enforce_quote_version_integrity on public.quote_versions;

create trigger enforce_quote_version_integrity
  before insert or update on public.quote_versions
  for each row
  execute function public.crm_enforce_quote_version_integrity();

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
  actor_role text := coalesce(auth.role(), '');
  target_version record;
  lead_row record;
  rejected_count integer := 0;
  changed_state boolean := false;
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

  perform 1
  from public.quote_versions qv
  where qv.lead_id = p_lead_id
  for update;

  select qv.id, qv.lead_id, qv.status, qv.title, qv.version_number, qv.accepted_at
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
  set status = 'rejected',
      accepted_at = null,
      rejected_at = coalesce(rejected_at, now()),
      expired_at = null,
      updated_at = now()
  where lead_id = p_lead_id
    and id <> target_version.id
    and status in ('draft', 'sent', 'accepted');

  get diagnostics rejected_count = row_count;

  update public.quote_versions
  set status = 'accepted',
      accepted_at = coalesce(accepted_at, now()),
      rejected_at = null,
      expired_at = null,
      updated_at = now()
  where id = target_version.id
    and (
      status is distinct from 'accepted'
      or accepted_at is null
    );

  changed_state := rejected_count > 0 or found;

  if changed_state then
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

  return query
    select target_version.id, rejected_count;
end;
$$;

revoke all on function public.crm_accept_quote_version(uuid, uuid) from public;
revoke all on function public.crm_accept_quote_version(uuid, uuid) from anon;
grant execute on function public.crm_accept_quote_version(uuid, uuid) to authenticated;
grant execute on function public.crm_accept_quote_version(uuid, uuid) to service_role;
