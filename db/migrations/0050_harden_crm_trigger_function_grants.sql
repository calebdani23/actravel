-- Trigger-only CRM guards do not need direct caller execution privileges.
-- Keep their trigger ownership, security-definer behavior, and fixed search_path
-- unchanged; trigger execution is independent of caller EXECUTE grants.
revoke execute on function public.crm_guard_governance_fields() from public, anon, authenticated, service_role;
revoke execute on function public.crm_require_test_data_purge() from public, anon, authenticated, service_role;
