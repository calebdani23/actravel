insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('catalog-media', 'catalog-media', true, 10485760, array['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'video/mp4']),
  ('documents', 'documents', false, 20971520, array['application/pdf', 'image/jpeg', 'image/png', 'image/webp']),
  ('payment-proofs', 'payment-proofs', false, 10485760, array['application/pdf', 'image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;
