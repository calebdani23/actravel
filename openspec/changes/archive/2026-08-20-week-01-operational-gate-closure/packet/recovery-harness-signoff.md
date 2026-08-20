# Recovery Harness Sign-off

- Verifier: OpenCode independent verifier (`openai/gpt-5.6-sol`)
- Verified UTC: `2026-08-19T17:08:38Z`
- Parent token: `sha256:8b006ad2f288a9a85c6b167898a0fe33f949df21d5f004dafef41c23fa110ae4`
- Harness: `tmp/audit-evidence/week01-harness-candidate/recovery-harness.sh`
- Harness SHA-256: `e52606f25197691d184150fde0e8e62bac8c6e1c6ff8c505689673beebcabfd8`
- Source identity: 258 lines, mode `0444`; expected SHA and mode match.
- Inputs reviewed: updated harness request, proposal, specification, design, tasks, and prior audit remediation checklist.
- Method: static source review, `bash -n`, eight embedded-Python AST parses, and isolated in-memory parser/unit fixtures only. The harness was not executed.

## Verdict

`WITHHELD`

## Findings

- PASS: The parent token is runtime-only, shape-validated, and bound into receipts/manifest; no parent token is embedded (lines 15, 49-53, 189-192, 236-237).
- PASS: Expected source SHA/mode/line count match; Bash and all embedded Python parse; tracing is disabled and trap state is initialized (lines 5-19).
- PARTIAL: `set -Eeuo pipefail` and signal/error traps now exist, but `EXIT_STATUS` is never propagated and cleanup failure can leave the normal process status successful (lines 206-230, 255-258).
- PARTIAL: All nine `tomllib` paths parse and are unique, but configs are written as workspace-root `config.toml`, not installed as `supabase/config.toml`; a temporary copied script also resolves `REPO` to `/` (lines 21, 84-117, 234-235, 251-252).
- PARTIAL: argv is JSON-safe and preserves boundaries; URL and `--token=value` fixtures sanitize, but split credentials such as `--token value` remain exposed (lines 30-41, 68-80).
- FAIL: The normal path performs only config records and declares the lifecycle absent. It never starts A/B, applies migrations, backs up, restores, captures/compares invariants, reconciles receipts, scans retained evidence, or writes a manifest (lines 232-258).
- FAIL: Receipt reconciliation is impossible: 49 IDs are required, 14 have no record path, `backup` is recordable but not required, and required aggregate/reconcile/secret IDs are never emitted (lines 137-203, 248-249).
- FAIL: `port-free-a` has no implementation. Cleanup only checks `docker ps` exit status, not empty selector output or configured socket freedom (lines 214-216, 248).
- FAIL: Fresh B preparation drops only `public` and `supabase_migrations`, not dumped `auth`/`storage`, and performs no empty-target assertion (lines 174-183).
- FAIL: The custom dump excludes owner/ACL data, roles/grants are not separately backed up/restored, grant SQL omits sequence/routine/default privileges, and `PG_RESTORE` is unused (lines 151-152, 174-179, 245).
- FAIL: Mandatory invariants are not sound: table "data counts" count columns, ownership is relation-only, migration SQL assumes a stored `checksum`, psql output is unstructured, and line-sorting canonicalization loses function/body order (lines 140-165).
- FAIL: Tool versions/hashes/compatibility, actual image use/digest, migration bytes/manifest, backup validation, isolated HOME/cache/config/network, and comprehensive retained-file/argv secret proof are absent (lines 18, 73-79, 244-245).
- FAIL: Deadline has no required receipt; cleanup does not remove networks/volumes or prove port absence, targets a predicted path rather than actual `$0`, records self-removal as merely planned, and the declared-only EXIT trap would still issue Docker stop/rm/ps (lines 206-230, 243-255).
- PARTIAL: Unique roots and temp-file rename exist, but manifest publication is unreachable, categories come from an unset environment variable, cleanup receipts cannot precede reconciliation, and generic failure does not prove no stale PASS/tmp manifest (lines 186-203, 239-250).
- FAIL: `dirty-worktree` is only a required name; no Git state, allowlist, HEAD, image, migration, app, or type guard is implemented (line 248).
- PARTIAL: Normal control flow has no provider/app/type/image or Git-write call and the protected image remains SHA-256 `1a0322e51ed8acc21f3e152907cc0fa65b26137bd5449e0aa058ad67561d9715`; mutating SQL accepts an unverified DB URL, so provider isolation is not proven (lines 181-183, 245).

Not every prior finding is resolved. Execution authorization remains withheld.

## Preservation

- No harness, Docker, Supabase, database, provider, Git-write, or image operation was executed.
- The candidate remains mode `0444` at the verified SHA; request/proposal/spec/design/tasks were not modified.
- Only this sign-off artifact was overwritten; existing unrelated worktree changes were preserved.
