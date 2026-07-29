-- Harden the serialized opportunity resolver in already-deployed environments.
-- PostgreSQL functions inherit EXECUTE for PUBLIC by default, which is unsafe for
-- this security definer RPC because auth.uid() is null for anonymous callers.

revoke all on function public.crm_resolve_opportunity_lead(
  uuid,
  uuid,
  uuid,
  text,
  text,
  text,
  uuid,
  uuid,
  date,
  date,
  integer,
  numeric,
  numeric,
  text,
  smallint,
  jsonb
) from public;

revoke all on function public.crm_resolve_opportunity_lead(
  uuid,
  uuid,
  uuid,
  text,
  text,
  text,
  uuid,
  uuid,
  date,
  date,
  integer,
  numeric,
  numeric,
  text,
  smallint,
  jsonb
) from anon;

grant execute on function public.crm_resolve_opportunity_lead(
  uuid,
  uuid,
  uuid,
  text,
  text,
  text,
  uuid,
  uuid,
  date,
  date,
  integer,
  numeric,
  numeric,
  text,
  smallint,
  jsonb
) to authenticated;

grant execute on function public.crm_resolve_opportunity_lead(
  uuid,
  uuid,
  uuid,
  text,
  text,
  text,
  uuid,
  uuid,
  date,
  date,
  integer,
  numeric,
  numeric,
  text,
  smallint,
  jsonb
) to service_role;
