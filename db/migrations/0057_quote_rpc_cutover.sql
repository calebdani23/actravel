-- Final quote UI cutover: authenticated quote mutations are RPC-only.

-- Safe scoped reads remain available. The temporary direct write policies from
-- 0053 are no longer needed now that every rendered mutation uses the
-- transactional RPC contract introduced in 0055.
drop policy if exists "quote versions insert scoped" on public.quote_versions;
drop policy if exists "quote versions update scoped" on public.quote_versions;

revoke all on table public.quote_versions from public, anon, service_role;
revoke insert, update, delete, truncate, references, trigger
  on table public.quote_versions
  from authenticated;
grant select on table public.quote_versions to authenticated;

-- Retain the historical signature for non-rendered compatibility callers, but
-- route it through the canonical transition engine. This removes the old draft
-- acceptance bypass: the target must now be ready/sent with a finalized PDF,
-- lock checks apply, and replacing another accepted quote still requires the
-- explicit crm_accept_quote supersession contract.
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
  target_row record;
  transition_row record;
  replaced_version_count integer := 0;
begin
  if p_lead_id is null or p_quote_version_id is null then
    raise invalid_parameter_value using message = 'Quote version acceptance requires an opportunity and version';
  end if;

  select
    qv.quote_id,
    qv.lead_id,
    qv.status as version_status,
    q.lock_version,
    q.accepted_version_id
  into target_row
  from public.quote_versions qv
  join public.quotes q on q.id = qv.quote_id
  where qv.id = p_quote_version_id
    and qv.lead_id = p_lead_id;

  if target_row.quote_id is null then
    raise exception 'Quote version was not found in the requested opportunity';
  end if;

  if target_row.accepted_version_id is not null
    and target_row.accepted_version_id is distinct from p_quote_version_id
  then
    replaced_version_count := 1;
  end if;

  select * into transition_row
  from public.crm_accept_quote(
    target_row.quote_id,
    p_quote_version_id,
    target_row.lock_version,
    null,
    null,
    'compat_accept_' || replace(p_quote_version_id::text, '-', '_')
  );

  if transition_row.accepted_version_id is distinct from p_quote_version_id then
    raise exception 'Compatibility acceptance did not select the requested version';
  end if;

  return query select transition_row.accepted_version_id, replaced_version_count;
end;
$function$;

revoke all on function public.crm_accept_quote_version(uuid, uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.crm_accept_quote_version(uuid, uuid)
  to authenticated;
