-- Remove direct authenticated DELETE access on leads so all deletes flow through the guarded RPC.

drop policy if exists "lead delete admin only" on public.leads;
