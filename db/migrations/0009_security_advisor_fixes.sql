create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

revoke execute on function public.has_role(text) from anon, authenticated;
revoke execute on function public.is_admin() from anon, authenticated;
revoke execute on function public.is_assigned_lead(uuid) from anon, authenticated;

drop policy if exists "anon read catalog media objects" on storage.objects;
