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

## Slice 2 Completion (attempt `notifications-foundation-slice2-20260831c`)

- Parent token: `sha256:3f76352273697c3f9b9ebd0a7bfdcfc1ed345b2175a2e14d64334482024a5d28`.
- [x] 3.1 Added runtime RED/GREEN tests for canonical normalization/keying, invalid input, and SQLSTATE-only mapping.
- [x] 3.2 Added the typed adapter with service creation, recipient listing/mark-read, exact SHA-256 UTF-8 key, and stable error mapping. Nullable generated context Args are handled by a local adapter seam; generated output and shared factories were not edited.
- [x] 3.3 Added adapter compile assertions and ran focused notifications, Tasks, auth/staff, CRM, and quote regressions: 36/36 tests passed; `npx tsc --noEmit` passed; `npm run lint` passed with zero errors/warnings after cleanup.

### Work Unit Evidence

| Evidence | Result |
|---|---|
| Focused test command and exact result | `node --conditions react-server --import tsx --test tests/staff-notifications-runtime.test.ts tests/staff-notifications-types.test.ts tests/staff-notifications-contract.test.ts` — exit 0; 7/7 passed. Regression command — exit 0; 36/36 passed. |
| Runtime harness command/scenario and exact result | Fresh Supabase CLI `2.115.0` minimal shadow `/tmp/opencode/notifications-foundation-slice2-20260831c`, migrations `0001`–`0063`: service create/replay yielded one row; authenticated active recipient listed and marked read twice with unchanged immutable fields; cleanup stopped shadow with `--no-backup`. No remote operation. |
| Rollback boundary | Remove `lib/admin/staff-notifications.ts`, `tests/staff-notifications-runtime.test.ts`, the added type assertions, and notification-owned active-recipient RLS helper; preserve slice 1 ledger/types and unrelated files. |

### Final Slice Boundary

Tasks `3.1–3.3` are complete. Tasks `4.1–4.2`, final verification/review/archive, UI, delivery, automation, audit, remote/staging, commit, push, and PR remain explicitly pending/out of scope. Implementation diff is within the 300-line request limit; no size exception.

## Final Apply Attempt (attempt `notifications-foundation-final-apply-20260831d`)

- Parent token: `sha256:f67d1cb11ec924852ae6191d87f05cd6d075da3d12f939113962216eb3940abe`.
- Exact candidate `0063` was applied once in a fresh Supabase CLI `2.115.0` minimal shadow through `0062`; ledger recorded `0061`, `0062`, `0063` exactly once.
- Catalog receipt: `staff_notifications` RLS enabled; one authenticated recipient SELECT policy; notification RPCs are `SECURITY DEFINER`; client table grant is SELECT to authenticated only; service-role create and authenticated mark execute grants were present; no remote/linked operation occurred.
- Runtime receipt: service create/exact replay remained one row; conflicting replay returned `SN005`; invalid task context returned `SN004`; active recipient listed and marked read twice idempotently; other, anonymous, and service-role access was denied. Runtime scenarios PASS.
- Generated types receipt: local `gen types` completed successfully; generated notification table/RPC symbols matched the checked-in notification contract.
- Focused notifications command: `node --conditions react-server --import tsx --test tests/staff-notifications-contract.test.ts tests/staff-notifications-runtime.test.ts tests/staff-notifications-types.test.ts` — 7/7 passed.
- Full Tasks/staff/auth/CRM/quote regression command — 182 tests, 180 passed, 1 failed, 1 skipped. Failure: existing `quote-transaction-rpc-contract.test.ts` expects nullable `p_expected_accepted_quote_id`/`superseded_quote_id`; no implementation edit was made.
- `npx tsc --noEmit`, `npm run lint`, `npm run build`, and `npm run test:quote-notifications` passed; `next-env.d.ts` restored byte-for-byte (SHA-256 `7ad303e40d4fddf44f156129e397511953a71481c5cfd86b1862649aaaf240cc`).
- Cleanup receipt: shadow stopped with `--no-backup`; exact temporary root and matching Docker container, volume, and network resources are absent. `supabase/.temp/cli-latest` was restored; no unrelated tracked/index drift remains.
- Tasks `4.1–4.2` remain unchecked because the required full regression gate did not pass. Rollback boundary: remove only this attempt's apply-progress evidence; no implementation rollback is applicable.

## Corrective Retry (attempt `notifications-foundation-final-apply-retry-20260831e`)

- Parent token: `sha256:49c2679735352d743a074e4fd131c2af4e68ad0c65059e1bc2e3d5f34ec3cfa5`.
- Differential proof: `quote-transaction-rpc-contract.test.ts` failed identically on immutable base `d115ba8` and current candidate: 17 tests, 16 passed, 1 failed; same test/assertion for quote nullable type fields.
- Causality proof: base→candidate diff for `lib/supabase/database.types.ts` is notification-only (+111 lines); no changes to `p_expected_accepted_quote_id` or `superseded_quote_id`. Quote test file is unchanged.
- Candidate-excluding-failure regressions passed: 165 tests, 164 passed, 0 failed, 1 skipped. Notifications focused evidence remains 7/7; typecheck/lint/build/quote-notifications remained passing from the clean prior attempt.
- Cleanup: isolated base worktree `/tmp/opencode/notifications-foundation-final-apply-retry-20260831e-base` removed; no Docker resources or remote mutation. Existing clean notification shadow evidence was reused; no new shadow residue.
- Deterministic base-only failure is non-blocking. Tasks `4.1–4.2` are now complete. Rollback boundary: remove only this retry evidence and the two task checkbox changes; no implementation rollback.
