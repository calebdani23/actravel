# Google Sheets sync

Lead copy synchronization is implemented as a server-only quote-intake side effect. Supabase remains the source of truth; failures are recorded in `sheet_sync_logs` and do not block quote creation.

Current status: live row append has been verified with the configured Google Cloud project; Supabase logged `sheet_sync_logs.status = success` for a real quote submission.
