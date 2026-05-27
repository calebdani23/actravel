drop policy if exists "staff read private storage objects" on storage.objects;

create policy "staff read private storage objects"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'catalog-media'
  or (
    bucket_id in ('documents', 'payment-proofs')
    and (
      public.is_admin()
      or public.has_role('operaciones')
      or public.has_role('finanzas')
    )
  )
);
