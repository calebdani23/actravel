# Apply Progress: Approved Follow-up Plan Apply

**Change**: `week-03-followup-task-approved-plan-apply`  
**Artifact store**: Hybrid (OpenSpec and Engram)  
**Implementation mode**: Prior slices Standard; bounded integrity/UTF-8 and required-row JSON-null remediations Strict TDD  
**Delivery**: `auto-chain`, `stacked-to-main`; authorized local remediations `remediate-integrity-and-utf8` and `remediate-json-null-guards`, each capped at 400 changed lines; no PR created

## Cumulative Task State

- [x] Slice 1, tasks 1.1–1.3: receipt and security foundation.
- [x] Slice 2, tasks 2.1–2.3: atomic apply RPC and disposable runtime proof.
- [x] Slice 3, tasks 3.1–3.3: manual receipt/apply type boundary.
- [x] Slice 4, tasks 4.1–4.3: authenticated adapter, strict decoding, and living evidence.
- [x] Corrective work unit, tasks 5.1–5.3: approval response compatibility after `0067`.
- [x] Pre-archive checks, tasks 6.1–6.2: fresh verification and preservation readback.
- [x] Remediation work unit, tasks 7.1–7.3: complete immutable approval validation and UTF-8 bounds.
- [x] Final remediation work unit, tasks 8.1–8.3: required canonical row JSON-null rejection and regression proof.

## Retained Slice 1–4 Evidence

### Slice 1 — Receipt/security foundation

- The no-FK append-only receipt, complete result-integrity helper/trigger, forced RLS, grants, and rollback remain implemented in `0066`.
- Focused receipt proof passed 4/4 with zero skips in disposable PostgreSQL.
- Receipt validation retains canonical identity, exact ordered and distinct Task IDs, count/cardinality, result hash/bytes, purge survival, and immutable-write coverage.

### Slice 2 — Atomic apply behavior

- Focused apply runtime proof passed 10/10 with zero skips; the prior complete four-file DB-enabled suite passed 20/20 with zero skips.
- Retained proof covers auth/no-DML, invalid or absent approval, approval integrity, stale-before-occupancy-before-bounds, all three isolated occupancy namespaces, mixed dispositions, exact 14-field Tasks, zero candidates, ordered multi-Task receipts, concurrency, second-row rollback, limits, RLS, grants, purge-surviving replay, and zero unrelated DML.
- Receipt-only replay recomputes the canonical apply-request fingerprint and rejects a well-formed mismatch as `APPLY_IDEMPOTENCY_CONFLICT`. Occupancy fixtures prove one intended namespace match and zero matches in the other two.
- Exact `0067` rollback proof passed. The approved Slice 2 `size:exception` remained below its hard 800-line cap.

### Slice 3 — Manual apply types

- The exact receipt Row/Insert/Update/Relationships and apply RPC Args/Returns contract passed its standalone 1/1 proof.
- The boundary remains manually maintained; no linked type generation or downstream read was introduced.

### Slice 4 — Adapter/strict decoding

- The authenticated `{requestId}` adapter and strict RPC/result decoders passed 5/5 focused tests.
- Auth-before-client, closed domain errors, canonical UUIDs, identity equality, exact ordered distinct Task IDs, count/cardinality equality, malformed providers, and public camel-case mapping remain covered.
- Prior lint, TypeScript, safe 96-page build, and diff hygiene passed. Remote migration/schema state remained unknown and untouched.

## Corrective Work Unit 5 — Approval Compatibility

Migration `0067` adds a non-null `approval_fingerprint` to `follow_up_task_approvals`, so `to_jsonb(v_existing)` legitimately includes it in fresh and replayed approval RPC results. The approval adapter's private exact-key decoder still described the archived `0065` response and rejected those valid rows.

The correction requires and validates the private field as lowercase 64-hex, adds it to approval Row/Insert/Update manual types, and intentionally omits it from the public `ApprovalSuccess` result. The approval runtime harness now applies `0066` and `0067` and proves fresh/replay fingerprint equality. Migration `0065` was not edited.

### RED-first Evidence

| Stage | Command | Exact result |
|---|---|---|
| RED | `node --conditions react-server --import tsx --test tests/follow-up-task-approval.test.ts` | FAIL: 7/8 passed; valid fresh response with `approval_fingerprint` was rejected in the success/replay subtest. |
| Database reproduction | `RUN_FOLLOW_UP_APPROVAL_DB_TESTS=1 node --conditions react-server --import tsx --test tests/follow-up-task-approval-ledger-runtime.test.ts` | PASS: 1/1, 0 skipped; `0067` fresh/replay rows included the same valid fingerprint. |
| GREEN | `node --conditions react-server --import tsx --test tests/follow-up-task-approval.test.ts` | PASS: 8/8, 0 skipped. |
| GREEN runtime | `RUN_FOLLOW_UP_APPROVAL_DB_TESTS=1 node --conditions react-server --import tsx --test tests/follow-up-task-approval-ledger-runtime.test.ts` | PASS: 1/1, 0 skipped. |

### Work Unit Evidence

| Evidence | Result |
|---|---|
| Focused test command and exact result | `node --conditions react-server --import tsx --test tests/follow-up-task-approval.test.ts` — PASS 8/8, 0 skipped. |
| Runtime harness command/scenario and exact result | `RUN_FOLLOW_UP_APPROVAL_DB_TESTS=1 node --conditions react-server --import tsx --test tests/follow-up-task-approval-ledger-runtime.test.ts` — PASS 1/1, 0 skipped; disposable `0057`–`0067` database, fresh and replayed approval rows. |
| Rollback boundary | Revert only the private decoder field/validation in `lib/admin/follow-up-task-approval.ts`, the three manual type entries, focused approval test changes, and this work unit's living docs/artifacts. No migration rollback or unrelated work is required. |

## Prior Fresh Required Verification (Compatibility Work Unit)

| Command | Observed result |
|---|---|
| `node --conditions react-server --import tsx --test tests/follow-up-task-approval.test.ts` | PASS, 8/8, 0 skipped. |
| `RUN_FOLLOW_UP_APPROVAL_DB_TESTS=1 node --conditions react-server --import tsx --test tests/follow-up-task-approval-ledger-runtime.test.ts` | PASS, 1/1, 0 skipped. |
| `RUN_FOLLOW_UP_APPROVAL_DB_TESTS=1 node --conditions react-server --import tsx --test tests/follow-up-task-approved-plan-apply-receipt.test.ts tests/follow-up-task-approved-plan-apply-runtime.test.ts tests/follow-up-task-approved-plan-apply-types.test.ts tests/follow-up-task-approved-plan-apply-adapter.test.ts` | PASS, 20/20, 0 skipped. |
| `npm run lint` | PASS, exit 0. |
| `npx tsc --noEmit` | PASS, exit 0, no diagnostics. |
| `npm run build` | PASS, 96/96 pages generated. Build-owned `next-env.d.ts` was restored to its pre-build bytes. |
| `git diff --check` | PASS, exit 0, no output. |

## Remediation Work Unit 6 — Integrity and UTF-8 Bounds

This bounded successor addresses only failed evidence revision
`sha256:72892645a4268512cc3c55af5e7b94b406340660ff3ec9541d3ae5d5e37fcc31`.
The failed verify report remains unchanged. The RPC now validates complete plan/header/row shape,
canonical row values, the closed disposition/reason/nullability matrix, all seven actual/stored count
equations, ordered exact projections, hashes, bytes, and fingerprint before mutation. It explicitly
computes the 512-byte row, 2048-byte projection-item, and 4096-byte static-header flags, then preserves
stale → occupancy → bounds ordering for otherwise valid over-limit approvals.

### TDD Cycle Evidence

| Task | Test File | Layer | Safety Net | RED | GREEN | TRIANGULATE | REFACTOR |
|---|---|---|---|---|---|---|---|
| 7.1 | `tests/follow-up-task-approved-plan-apply-runtime.test.ts` | Integration | PASS 10/10, 0 skipped | FAIL: accepted 13/16 tamper cases or returned late `LIMIT_EXCEEDED` | PASS: focused tamper matrix 1/1 | 16 shape/count/UTF-8 cases | Test helper isolates cryptographic consistency and full-state DML hashes |
| 7.2 | Same | Integration | Existing receipt/replay/atomic scenarios retained | RED from 7.1 | PASS: runtime 11/11, 0 skipped | Valid 2,001-row case proves occupancy before bounds | Complete validation remains one pre-mutation block |
| 7.3 | Required command set | Integration/static | Prior compatibility proof retained | Remediation tests remained the release gate before evidence updates | PASS: all required commands | Focused, aggregate, and approval compatibility suites | Build byproduct restored; no code refactor needed |

### Work Unit Evidence

| Evidence | Result |
|---|---|
| Focused test command and exact result | `RUN_FOLLOW_UP_APPROVAL_DB_TESTS=1 node --conditions react-server --import tsx --test tests/follow-up-task-approved-plan-apply-runtime.test.ts` — PASS 11/11, 0 skipped. |
| Runtime harness command/scenario and exact result | Same disposable `0057`–`0067` command — PASS 11/11, 0 skipped; self-consistent tamper matrix, zero DML, and retained apply/replay/concurrency/rollback scenarios. |
| Rollback boundary | Revert only the remediation branches in `0067`, the focused runtime helper/cases, Phase 7 task/progress entries, and the new top entries in `docs/DECISIONS.md` and `docs/PROGRESS.md`. |

### Remediation Verification

| Command | Observed result |
|---|---|
| Focused DB runtime | PASS 11/11, 0 skipped. |
| Four-file DB-enabled suite | PASS 21/21, 0 skipped. |
| Approval unit | PASS 8/8, 0 skipped. |
| `npm run lint` | PASS, exit 0, no diagnostics. |
| `npx tsc --noEmit` | PASS, exit 0, no diagnostics. |
| `npm run build` | PASS, 96/96 pages; `next-env.d.ts` restored to pre-build SHA-256 `7ad303e4…`. |
| `git diff --check` | PASS, exit 0, no output. |

## Remediation Work Unit 7 — Required Canonical Row JSON Null

This single bounded correction addresses only remaining F-01 in the current failed verify report,
whose unchanged file revision is
`sha256:2d2aa6232f115cef7e89bef5632766bf807360cfba6c157ccf45f3d0d4bbbfc6`.
The RPC now rejects SQL null extracted from required canonical row members `eventId`, `leadId`,
`eventCreatedAt`, `disposition`, and `reason` immediately after row shape validation and before regex,
the disposition/reason matrix, count equations, bounds, live/occupancy checks, or writes.

### TDD Cycle Evidence

| Task | Test File | Layer | Safety Net | RED | GREEN | TRIANGULATE | REFACTOR |
|---|---|---|---|---|---|---|---|
| 8.1 | `tests/follow-up-task-approved-plan-apply-runtime.test.ts` | Integration | Initial exact runtime command reached 7 passing subtests before its 600-second wrapper terminated; the orphaned disposable container was removed and no test failed | Focused matrix FAIL 0/1: 5/10 JSON-null cases applied and changed DML state | Focused matrix PASS 1/1, 0 skipped | All five required fields in both eligible and retained noneligible rows; exact result, full-state hash, and count snapshots | Shared matrix and snapshots avoid duplicated fixtures; no further refactor needed |
| 8.2 | Same | Integration | Retained runtime scenarios remained the safety net | RED from 8.1 | Minimal two-line pre-predicate guard; complete runtime PASS 12/12, 0 skipped | Eligible and retained noneligible behavior close identically without changing legal nullable members | Guard remains in the existing pre-mutation integrity block |
| 8.3 | Required command set | Integration/static/build | Prior cumulative evidence retained | The new focused matrix remained the release gate before evidence updates | Every required command passed; database suites had zero skips | Focused 10-case proof plus complete apply, receipt, type, adapter, and approval compatibility suites | Build byproduct restored; no production refactor needed |

### Work Unit Evidence

| Evidence | Result |
|---|---|
| Focused test command and exact result | `RUN_FOLLOW_UP_APPROVAL_DB_TESTS=1 node --conditions react-server --import tsx --test --test-name-pattern="JSON null in every required canonical field" tests/follow-up-task-approved-plan-apply-runtime.test.ts` — PASS 1/1, 0 skipped; ten field/row-kind cases. |
| Runtime harness command/scenario and exact result | `RUN_FOLLOW_UP_APPROVAL_DB_TESTS=1 node --conditions react-server --import tsx --test tests/follow-up-task-approved-plan-apply-runtime.test.ts` — PASS 12/12, 0 skipped in disposable PostgreSQL; all retained apply/replay/concurrency/rollback scenarios passed. |
| Rollback boundary | Revert only the two required-field null-guard lines in `0067`, the focused ten-case runtime matrix/static assertion, Phase 8 tasks/progress, and the new top entries in `docs/DECISIONS.md` and `docs/PROGRESS.md`. |

### Required Verification

| Command | Observed result |
|---|---|
| Focused DB runtime | PASS 12/12, 0 skipped. |
| Four-file DB-enabled suite | PASS 22/22, 0 skipped. |
| Approval unit | PASS 8/8, 0 skipped. |
| `npm run lint` | PASS, exit 0, no diagnostics. |
| `npx tsc --noEmit` | PASS, exit 0, no diagnostics. |
| `npm run build` | PASS, 96/96 pages; `next-env.d.ts` restored to SHA-256 `7ad303e4…`. |
| `git diff --check` | PASS, exit 0, no output; rerun after artifact completion. |

### Final Remediation Boundary

- The correction preserves approval compatibility, both fingerprints, purge replay, stale → occupancy → bounds precedence, concurrency/atomicity, disposition accounting, exact 14-field Task projection, authorization/policy, rollback, types, and adapter contracts.
- Migrations `0061`–`0066`, the current failed verify report, protected unrelated paths, staged content, remote state, and Week 1 remain untouched.
- The bounded correction authored 133 additions+deletions (2 migration, 37 focused test, 6 tasks, 29 living docs, and 59 cumulative progress), below its independent 400-line cap.
- Status: 23/23 tasks complete. Ready for fresh independent SDD verification; apply does not launch review.

## Preservation and Scope

- Baseline and final SHA-256 values match for migrations `0061`–`0066`: `979f03da…`, `0e2504ac…`, `615f35d7…`, `feb523e2…`, `b68cfb09…`, and `b24e255e…`, respectively.
- Prior failed evidence remained byte-identical at SHA-256 `72892645…`; the current F-01 failed verify report remained byte-identical at SHA-256 `2d2aa623…` throughout Work Unit 7.
- Baseline and final SHA-256 values match for protected unrelated files: `opencode.json` `1df11910…`; `scripts/gentle-ai` `aea6940e…`; `.gentle-ai-default-agent.json` `9daad823…`; `.gga` `d844e608…`; `scripts/gentle-ai-config-merge.mjs` `33f5aa94…`; and `tests/gentle-ai-wrapper.test.mjs` `aeb568b8…`.
- No staging operation occurred, and the baseline/final `git diff --cached --name-status` manifests are identical. The raw index checksum changed from `9f5db530…` to `78c04e0f…` because Git refreshed index stat metadata during read-only status operations; staged paths/content were not changed. The pre-existing Week 1 directory remained untracked and no path under it was read, edited, staged, or deleted.
- For this remediation, the cached path manifests also compare byte-identically and the cached-content diff hash remains `4aef0553…`; raw index metadata changed from `c1276f33…` to `95bb3a86…` without changing staged content.
- `next-env.d.ts` was restored to SHA-256 `7ad303e4…` after the safe build.
- No package, remote, remote database, migration, commit, stage, push, or PR operation occurred. No remote parity, rollout, archive, or production-readiness claim is made.

## Review Budget and Status

- Prior Slice 5 accounting is retained above. The successor remediation authored 288 additions+deletions; final F-01 Work Unit 7 authored 133 additions+deletions, and each remained below its independent 400-line cap.
- Boundary: cumulative failed findings F-01/F-02, with Work Unit 7 limited to required-row JSON-null rejection, regression proof, and living evidence.
- Status: 23/23 tasks complete. Ready for fresh independent SDD verification; apply does not launch review.
