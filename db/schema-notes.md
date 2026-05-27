# Supabase schema notes

Database migrations for the Supabase foundation live in `db/migrations/0001_extensions.sql` through `0012_grant_authenticated_helper_execute.sql`.

The schema uses Supabase Auth users with `profiles`, fixed roles in `roles`/`profile_roles`, public bilingual catalog tables, private CRM/operations tables, storage buckets, and conservative RLS. Anonymous access is limited to published catalog content and public catalog media; lead/quote creation is reserved for later server-side service-role endpoints.

RLS policy helper functions (`public.has_role(text)`, `public.is_admin()`, and `public.is_assigned_lead(uuid)`) are `security definer` functions with `search_path = public`. Their execute grants are intentionally restricted to `authenticated` and `service_role` so staff policies can evaluate role checks while anonymous callers cannot invoke the helpers directly.
