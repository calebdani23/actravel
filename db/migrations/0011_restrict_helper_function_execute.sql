revoke execute on function public.has_role(text) from public;
revoke execute on function public.is_admin() from public;
revoke execute on function public.is_assigned_lead(uuid) from public;
grant execute on function public.has_role(text) to service_role;
grant execute on function public.is_admin() to service_role;
grant execute on function public.is_assigned_lead(uuid) to service_role;
