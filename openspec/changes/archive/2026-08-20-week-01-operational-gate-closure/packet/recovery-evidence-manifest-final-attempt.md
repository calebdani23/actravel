# Immutable Recovery Evidence Manifest — Final Sequential-Port Attempt

- Run: `slice1-audit-final-20260819T090308Z-500317`; local-only disposable A/B; no production contact.
- Parent token: `sha256:7fbaf1b5d4231bb7ffa60440632685eefc7ff540d24c8168f21dc29b57bae521`.
- Cleanup deadline: `2026-08-19T09:48:08Z`; cleanup completed before deadline.
- Strategy: sequential A then B, same default map. A and B generated configs both declare API `54321`, DB `54322`, shadow `54320`, Studio `54323`, Inbucket `54324`, SMTP `54325`, POP3 `54326`, analytics `54327`, pooler `54329`.
- Receipt count: `36`; receipt aggregate SHA-256: `c7cc5783818096016d86e2be8d557b60d5d88ffaf7642785a69aa55673074874`.
- Backup SHA-256: `61e6c144659ebba4540d790c992caf967b74d0a43c49b4b33489536536c59992`.
- Restore exit: `0`; grants evidence exit: `0`, receipt result SHA `fbdea9f3c62bab97735d13ff889c5959d49f75989f3fe81231fee7e2c49ea8aa`.
- Invariant aggregate A/B result SHA: `46ae371b5155c03bc89bf188362260365558edce2aaeb47b5913f8831d260111` / same; exact equality.
- RLS-enabled-state and schema/data/function/trigger/policy/constraint category receipt: `46ae371b5155c03bc89bf188362260365558edce2aaeb47b5913f8831d260111` / same.
- Migration manifest receipt SHA: `8cca53937037f97e73a206dba50214dc96f16becbf51939b5dece2f8c852e96d`.
- CLI receipt: Supabase `2.101.0`; result SHA `d6edc06bc5c4fbffd475bfee92d565d1b2a6f4d7da4352c77b7a9b3889b145c9`; Docker image inspection receipt SHA `34edc52da26acae15bfe4b2e846277d1cdad681883e6c90b3ade9b123fc6409e`.
- Protected image SHA-256: `1a0322e51ed8acc21f3e152907cc0fa65b26137bd5449e0aa058ad67561d9715`; image-protected receipt SHA `c368a06bf973f1916265b1f82bb4d731d7cf6fedb54a4bf618890a285a732c23`.
- Secret scan: exit `0`, result SHA `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855`, zero findings.
- A stop: explicit `cd A && supabase stop --no-backup`, exit `0`; A port-free check exit `0`. B stop and post-cleanup absence checks exit `0`; cleanup receipt SHA `e870d933a3e5b9a808a57f5686021f71d38bdcca3161cd060165587e71c03dd3`.
- Retained ignored evidence root: `tmp/audit-evidence/week01-recovery-final/slice1-audit-final-20260819T090308Z-500317/`; raw command output and credentials were not retained.
- This manifest is immutable evidence only. Fresh independent recovery verification is still required; prior recovery sign-off is invalidated for this binding. Local-only limitation remains explicit.
