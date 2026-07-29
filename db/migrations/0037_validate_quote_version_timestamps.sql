-- The quote_versions table is empty at rollout, so validate the lifecycle constraint now.
alter table public.quote_versions
  validate constraint quote_versions_status_timestamps_coherent;
