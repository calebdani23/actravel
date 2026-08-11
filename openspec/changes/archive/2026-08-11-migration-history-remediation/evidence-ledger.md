# Evidence Ledger

This ledger is append-only for this work unit. Evidence planes remain separate: local bytes, archived remote ledger, behavior/RLS, generated types, and recovery. No final schema state is used to manufacture migration provenance.

**Evidence revision:** `sha256:6f006263856c951cd3045074c9d61a878aa9ec870aafde65b0cb31975103b1af`

| ID | Plane | Source and time | Sanitized result | Hash/status |
|---|---|---|---|---|
| MHR-E-001 | identity/process | `environment-identity.md`, 2026-08-11T06:57:23Z | HEAD, branch, root, and allowed scope frozen | SHA-256 recorded in identity; verified |
| MHR-E-002 | local representation | Read-only `db/migrations/` inventory, 2026-08-11T06:57:23Z | 59 numerically sorted files; canonical manifest | `ff82d24126b8539ba1f9bb118c87bbaae12dbb2f5e89ac3dbaf7db60375a8876`; verified |
| MHR-E-003 | remote ledger | archived baseline evidence #1507, 2026-08-10T21:35:23Z | Remote `0051` exists; `0053`–`0056`, `0058`–`0060` directly evidenced; `0057` absent | Archived source; verified read-only |
| MHR-E-004 | remote ledger | archived baseline evidence #1523, 2026-08-10T23:03:41Z | Remote `0044`–`0049` are identical `select 1;` placeholders; statement MD5 retained as authorized | `ccb5b4481bced39454dca6d845601d54`; verified |
| MHR-E-005 | local representation | local `0057` and `0060` read-only comparison, archived #1507 | `0060` repeats the cutover; no replay or history repair authorized | Source bytes in local manifest; verified |
| MHR-E-006 | behavior/RLS | archived baseline evidence #1507/#1526, 2026-08-10 | Targeted quote/RLS/helper/CRM contract evidence retained; no claim beyond archived scope | Archived source; verified with follow-up |
| MHR-E-007 | type plane | archived baseline verification #1526, 2026-08-10T23:18:43Z | Known generated-type drift/alignment follow-up retained; tracked types not regenerated | Protected hash `3ed53c0d…93436`; blocked follow-up |
| MHR-E-008 | threat/process | local safe fixtures, 2026-08-11T06:58:02Z | mutation classifier exit 1; timeout exit 124; unknown executable exit 1 | fixture logs hash `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855`; verified |
| MHR-E-009 | CLI/recovery | official Supabase CLI docs, fetched 2026-08-11T06:56Z | `init` is required for local project config; `start` uses Docker; dump/reset semantics identified; init prohibited here | Documentation source; unavailable rehearsal |
| MHR-E-010 | validation | lint/build/quote logs, 2026-08-11T06:57–07:01Z | lint 0; build 0; quote notifications 15/15 | Log hashes recorded in `local-rehearsal.md`; verified |
| MHR-E-011 | protected state | read-only status/diff and protected hashes, 2026-08-11T07:01Z | No migration/type/schema/application/config/package/remote mutation; build-only `next-env.d.ts` change restored | Protected hashes recorded; verified |

## Evidence rules

- Remote names and statements are cited only from archived authorized evidence; no remote body or checksum is fabricated.
- Local SHA-256 values hash file bytes, not remote statement MD5 values.
- Missing or contradictory proof is `ambiguous/manual-review` and is never replay authorization.
- Raw logs remain in ignored `/tmp/opencode/` only; this tracked ledger contains sanitized summaries and hashes.
