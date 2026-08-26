# Design: Independently Verified Gate 0 Baseline

## Decision

This change is a one-off factual baseline, not a harness. It has no self-authorizing
pointer, authority receipt/manifest, command-record engine, reusable runner, or child
execution surface. Its only proposed apply artifact is `baseline-report.md`.

Gate 0 is accepted only when all three independent layers agree:

1. `baseline-report.md` records the apply operator's exact observations and PASS checks.
2. Native `sdd-verify` writes `verify-report.md` after independently rerunning the remote
   and isolated-local checks with its own temporary resources.
3. After `sdd-verify`, an external parent performs the native bounded review/post-apply
   gate for that exact verified change. Apply/verify executors do not invoke it or mutate
   Git. No change-local file substitutes for the native receipt or gate.

Prior reports, receipts, manifests, validators, command records, schemas, pointer
preimages, and raw outputs are non-authoritative provenance. The two false pointers are
absent and must not be recreated.

## Review Bound

The maintainer grants a size exception for untouched incident and failed-run provenance.
New authored active Harness files (`proposal.md`, this design, the delta spec, `tasks.md`,
`apply-progress.md`, and `baseline-report.md`) target at most 800 physical lines;
`baseline-report.md` is capped at 177. Native `verify-report.md` is a separate artifact in
delivery review scope and outside that active-report budget. Provenance is never rewritten
merely to meet either target.

## Evidence Locations

| File or location | Disposition |
|---|---|
| `baseline-report.md` | Proposed factual apply report; absent until the bounded run completes |
| `verify-report.md` | Native `sdd-verify` output; absent until independent verification |
| Native review/post-apply record | External-parent lifecycle authority after verification; outside implementation |
| `/tmp/opencode/actravel-gate0-<UTC>-<pid>/command-capture/` | Sole disposable apply command/request/stream capture directory |
| A separate verifier temp root | Disposable raw output for `sdd-verify`; never reuse apply output |
| `evidence/**`, `schemas/**`, `incident-report*.md`, `invalidated-authority*.json` | Preserved failed-run or incident provenance only |
| `history/evidence-protocol-design.invalidated.md` | Invalidated self-authorizing protocol design |

Raw successful-run output is deleted after its ordered aggregate and the hashes/facts needed
by the report are captured; the report is finalized after cleanup proves temp absence.
Failed runs also delete disposable capture after aggregation; only separately redacted,
nonsecret incident facts may remain. No secret value, raw Supabase status, connection URL,
or full generated type file is retained.

## Fresh Parent Remote Capture

The parent, not the apply child, performs these read-only Supabase operations against the
configured project. It records each operation name, arguments or SQL hash, UTC completion
time, result hash, and concise result in the temporary root:

| Operation | Exact arguments | Required result |
|---|---|---|
| `supabase_get_project_url` | `{}` | ref `bdyhakpmxegoipbmbtjb`; URL `https://bdyhakpmxegoipbmbtjb.supabase.co` |
| R002 `supabase_list_migrations` | `{}` | canonical sorted, duplicate-free 59-object `{version,name}` table and exact bytes/hash; remote-only `0051`, no `0057`, tail `0060`, no `0061+` |
| `supabase_list_tables` | `{"schemas":["public"],"verbose":true}` | no `tasks` or `staff_notifications` table |
| `supabase_execute_sql` | the exact query below | no remote Manager role effect and no deferred tables |

```sql
select jsonb_build_object(
  'migration_ledger', (
    select jsonb_agg(jsonb_build_object('version', version, 'name', name)
      order by version, name)
    from supabase_migrations.schema_migrations
  ),
  'manager_count', (select count(*) from public.roles where name = 'manager'),
  'roles_name_check', (
    select pg_get_constraintdef(oid, true)
    from pg_constraint
    where conrelid = 'public.roles'::regclass and conname = 'roles_name_check'
  ),
  'roles_staff_read', (
    select qual
    from pg_policies
    where schemaname = 'public' and tablename = 'roles'
      and policyname = 'roles staff read'
  ),
  'tasks', to_regclass('public.tasks'),
  'staff_notifications', to_regclass('public.staff_notifications')
) as gate0_remote_facts;
```

R002's normalized exact bytes become the expected remote table. PASS requires its complete
59-object hash to equal the hash of the complete SQL `migration_ledger`, not merely selected
names; `manager_count = 0`, neither role definition contains `manager`, and both relation
values are null. Missing `0057` remains effect equivalence, not execution provenance. Any
unavailable operation, duplicate, incomplete-set mismatch, or wrong target is BLOCKED.
Canonical table bytes are compact UTF-8 JSON, object keys `version,name`, rows sorted by
those keys, no duplicates, and one trailing LF; the SQL ledger uses identical bytes.

## Bounded Apply Blocks

An unnumbered bootstrap creates one mode-0700 temp root and its sole
`command-capture/` directory before materializing B001-B006. For each block it retains the
exact UTF-8 command bytes actually sourced under `bash -o pipefail`, complete stdout/stderr,
decimal exit, and SHA-256 of each file. R001-R004 request/result bytes and nonstream result
files live there too. Nonzero exits mark `BLOCKED` but cannot skip eligible B006 cleanup.

| Block | Exact responsibility |
|---|---|
| B001 | Generate at most eight `atg0-[0-9a-f]{8}` candidates. For each, full nontruncated Docker listings must find zero exact project labels and zero exact Supabase container/volume/network names ending in `_<ID>` (including `supabase_network_<ID>`), and `$TMP/projects/<ID>` plus its `supabase/` child must be absent. Select one or `BLOCKED`; create that directory and a mode-0600 owner marker binding run ID, project ID, and random owner token. Capture preservation/image preimages. Never stop/remove collisions. |
| B002 | Build the canonical sorted, duplicate-free 60-row `{filename,sha256}` source manifest. Require no local `0051`, one local `0057`, tail `0061`, and `0061` hash `979f03da567e32c12e2a5eef1c6b1f093332776719830b09dcb8474c327c81dd`. |
| B003 | With CLI `2.115.0`, initialize only the selected project directory, copy migrations, require complete copy-manifest equality, set the exact project ID, then start/reset locally with no linked/remote fallback or repository install. Inspect the exact DB container and project label. |
| B004 | Run the fixed read-only local query. Return the complete ordered 60-row `{version,name}` ledger plus count/tail, exact role row/constraint/policy facts, absent deferred tables, and exact five-function quote state from the specification. The complete normalized ledger bytes/hash must equal B002's canonical `{version,name}` filename projection bytes/hash; the separate filename/per-file-SHA source-manifest hash is compared only with complete copy and post-run source-manifest hashes. |
| B005 | Generate types only inside command capture; bind hash/byte/line counts, prove `roles.Row.name: string` and absent deferred tables, then delete the full type file. |
| B006 | Run after success or failure: ownership-gated stop/exact-ID cleanup, zero-resource checks, and complete final migration/preservation/image comparisons. It does not delete capture. |

Set files use compact UTF-8 JSON arrays with declared key order, sorted rows, no duplicates,
and one trailing LF. Local source/copy/final rows use keys `filename,sha256`; their separate
`version,name` filename projection must byte-equal the complete local ledger.

The preservation preimage is canonical null-safe JSONL over the union of
`git ls-files --cached --others --exclude-standard -z`, every path parsed from porcelain-v2
dirty bytes including rename pairs/absent paths, and explicit protected sets. Each record
binds path, `absent|regular|symlink`, lstat mode, byte length, and SHA-256 of file or symlink-
target bytes. Separate index evidence and coverage checks include `package.json`,
`package-lock.json`, every active-packet file, all migrations, `next-env.d.ts`,
`lib/supabase/database.types.ts`, and the protected image. Raw status alone cannot PASS.

Before any stop or exact-ID removal, fresh full-list discovery takes the union of exact
label/name candidates, the owner marker must match, and inspection must prove every selected
container, volume, and network label equals the selected ID. A mismatch is `BLOCKED` and that
candidate is untouched. No prune, broad fallback, or image removal is allowed.

Before the final snapshot, the operator writes the planned report draft and exact
`tasks.md`/`apply-progress.md` updates. Final preservation requires identical sorted
path/type/mode/length/hash records outside
exact planned paths. `baseline-report.md` must be absent before and may become a regular
file; regular `tasks.md` and `apply-progress.md` may change bytes but not mode. No other
addition, removal, or change is allowed. Complete initial/copy/final migration manifests
must match, every pre-existing image ID must remain, and new cached images may remain.

After B006 returns, the wrapper hashes B006's completed command/stdout/stderr/exit files.
Fixed-ID ordered rows then bind every B001-B006 hash and R001-R004 request/result hash into
one aggregate hash before deletion. An unnumbered finalizer holds only those hashes and
nonsecret summary facts in process memory, deletes the sole capture/temp root, proves
absence, and finalizes only `baseline-report.md`. Its command hash, exit, and absence result
also enter the report; no stream, raw status, secret, or full type survives.

## Baseline Report

`baseline-report.md` is at most 177 physical lines of concise prose and tables, with:

- UTC run identity, exact remote ref/URL, Supabase CLI version, local project ID, and final
  factual outcome;
- every remote-operation and B001-B006 row with command/query, stdout, stderr, result, and
  aggregate SHA-256, decimal exit or MCP result, and PASS/BLOCKED;
- equality of exact R002/SQL 59-object hashes and exact initial/copy/final/local-ledger
  60-row hashes, plus required catalog and generated-type facts;
- exact-label zero counts, temp-root absence, no retained secrets/full types, preservation
  of every pre-existing image ID with additions reported, and complete preservation-manifest
  equality outside the exact three-path planned allowance;
- explicit statement that all prior protocol artifacts and invalid runs are provenance;
- no `authoritative`, `ready`, receipt, manifest, pointer, or custom schema fields.

Any missing hash/result, nonzero required command, unavailable remote operation, mismatch,
cleanup residue, retained secret/full types, or preservation drift produces `BLOCKED`.

## Independent Verification and Readiness

Native `sdd-verify` must use a different collision-free temporary root/project ID, recapture
the complete remote set, rebuild the complete local manifest, rerun all checks, and recompute
every hash/fact. It writes normal `verify-report.md`, outside the active-report line budget.
It must not trust old/apply output. Apply and verify executors perform no Git mutation and do
not invoke review lifecycle.

Even a `verify-report.md` PASS is not self-authority. After verification, an external parent
must run the native bounded review and post-apply gate for the exact revision. This required
delivery review is outside Harness implementation scope. Only then may the change archive;
each child still owns its migration/schema verification.

## Rollback

Before verification, remove only `baseline-report.md` and disposable temporary resources.
After verification, revert only this documentation packet through normal repository review.
Never alter prior evidence, incident reports, provider history, product schema, migrations,
packages, code, tracked generated types, or remote state as rollback.
