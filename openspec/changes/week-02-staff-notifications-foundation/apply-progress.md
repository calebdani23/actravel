# Apply Progress: Week 02 Staff Notifications Foundation

## Envelope

- Change: `week-02-staff-notifications-foundation`
- Attempt: `notifications-foundation-slice1-retry-20260831b`
- Parent token: `sha256:e8409d1519a375fc6d984dfcb0ff58362b64d37b7f116830b225e5f9d7b60bf8`
- Slice: Notifications autonomous slice 1, tasks 1.1–2.3
- Delivery: auto-chain, stacked-to-main; current boundary is a separately parent-reviewable implementation PR 1.
- Implementation-only boundary: 371 changed lines (`0063` 153 + contract test 66 + type test 41 + additive generated types 111), within the 400-line chained-PR limit. Documentation/evidence boundary: 112 total lines (`tasks.md` 54 + `apply-progress.md` 58), excluded from implementation PR counting. No size exception.

## Fresh Gate 0 Evidence

- Evidence: `.opencode-runtime/notifications-parent-preallocation-gate.json`
- SHA-256: `c3ee8e134270bb35c371f422d06defe5813fdbc086d1141fc914b3adafc0fe91`
- Captured: `2026-08-31T21:10:34Z`; expires: `2026-08-31T22:40:34Z`
- Read-only operations were limited to project URL, migration history, and schema identity.
- Reconciled remote tail `0060`, remote-only `0051`, accepted missing `0057`, no remote `0061+`, local tail `0062`, candidate `0063`, and `remoteAuthorized: false`.
- No remote mutation, migration application, DDL, or DML was performed.
- Read-only workspace HEAD: `d115ba84c6667e4a1d9e965a5d59b7b32ad07338`.
- Local migration checksums: `0061` = `sha256:979f03da567e32c12e2a5eef1c6b1f093332776719830b09dcb8474c327c81dd`; `0062` = `sha256:0e2504acf26bebc9f507336dfd54370f5ced8659b364f10afef8e5847bb10eb6`; candidate `0063` = `sha256:748a3e0587503b531426909166bfabea68199ead2d8948f22e039fb2c320801b`.
- Archived Tasks prerequisite independently reports PASS (`sha256:21d0d169320ac4538a07835939d153d883445ce86efdc9ff57c96101c972e042`); archived Harness prerequisite reports PASS (`sha256:f21729c5467cec8f96c85c7e046952219660cdbdb8eddf82c048da538117aa3e`).

## Corrective Retry Evidence

- Fresh shadow: `/tmp/opencode/notifications-foundation-slice1-retry-20260831b`, Supabase CLI `2.115.0`, collision-free Docker project name.
- Start command used the proven minimal exclusions: `gotrue,realtime,storage-api,imgproxy,kong,mailpit,postgrest,postgres-meta,studio,edge-runtime,logflare,vector,supavisor`.
- `supabase start` applied migrations `0001` through `0063`; catalog ledger query confirmed `0061|1`, `0062|1`, `0063|1` and zero notification rows.
- Catalog/RPC/RLS/grant inspection confirmed table RLS enabled, one authenticated recipient policy, postgres-owned `SECURITY DEFINER` functions with `search_path=public`, authenticated SELECT/mark-read execute, service-role create execute, and no direct table DML grants to client roles.
- Generated types command: `npx --yes supabase@2.115.0 gen types typescript --local --workdir /tmp/opencode/notifications-foundation-slice1-retry-20260831b`; output SHA-256 `ca62bc3d24f18d81c5cc9e6575666a35b42ce0fc21a0c5cfafcf18f4e6697204`.
- Generated/current notification block hashes matched exactly: table `sha256:18ea0501ad5032b2bd5de64cc23deedd12fdcb1beaf71248137468af5cedb307`; create RPC `sha256:19dbafc8e53ba9464d2f32a218c7d0eee01b8c80a46b3c8d3be775b3d8166f0b`; mark RPC `sha256:3f18b1c3a137cd0413bb04aaf5c4a73d4eb094cd4eaa865ef4129febd55d8e34`.
- Shadow stopped with `--no-backup`; temporary root and matching Docker resources were removed. No remote or linked project operation occurred.

## Preserved Failed Attempt History

- Attempt `notifications-foundation-slice1-20260831a` remains represented by its original evidence: it stopped before runtime because host tooling was unavailable, and its original parent token/evidence references are retained in Git history and prior session memory. This corrective retry supersedes only its incomplete runtime claim; it does not erase the failed-attempt record.

## Completed Tasks

- [x] 1.1 Fresh gate/dependency reconciliation validated from the supplied immutable evidence.
- [x] 1.2 Contract/security tests were written first; initial RED was the absent `0063` migration, then GREEN after implementation.
- [x] 1.3 Added the local-only `0063_staff_notifications_foundation.sql` ledger, constraints, indexes, atomic replay comparison, and history-preserving context FKs.
- [x] 2.1 Added RED/GREEN assertions for table/function privileges, recipient RLS, ownership, definer search path, and execute grants.
- [x] 2.2 Added service-role creation and authenticated recipient mark-read RPCs with stable SN001–SN005 contracts.
- [x] 2.3 Added additive `staff_notifications` table and RPC types; Supabase factory files were unchanged because existing inferred clients preserve behavior.

## Work Unit Evidence

| Evidence | Result |
|---|---|
| Focused test command and exact result | `node --import tsx --test tests/staff-notifications-contract.test.ts tests/staff-notifications-types.test.ts` — exit 0; 4/4 tests passed |
| Type/lint checks | `npx tsc --noEmit` — exit 0; `npm run lint` — exit 0 |
| Runtime harness command/scenario and exact result | `npx --yes supabase@2.115.0 start ... --exclude gotrue,realtime,storage-api,imgproxy,kong,mailpit,postgrest,postgres-meta,studio,edge-runtime,logflare,vector,supavisor --yes`; apply through `0063`, inspect catalog/RLS/grants, then `stop --no-backup` — PASS; each of `0061`, `0062`, `0063` applied once and cleanup passed |
| Rollback boundary | Remove `db/migrations/0063_staff_notifications_foundation.sql`, the two focused tests, and the additive notification block in `lib/supabase/database.types.ts`; no unrelated files are touched |

## Scope Boundary

Slice 2 begins with adapter/runtime behavior (`3.1–3.3`). Final disposable apply, cleanup/preservation, regression, verification, review, archive, and all delivery/UI/automation/audit work remain pending and out of scope.
