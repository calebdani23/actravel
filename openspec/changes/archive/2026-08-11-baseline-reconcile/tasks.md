# Tasks: Reconcile the Repository and Supabase Baseline

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | 180–320 authored lines |
| Estimated files | 2–4 (report, optional living docs, conditional types) |
| 400-line budget risk | Low |
| Chained PRs recommended | No |
| Suggested split | Single reviewable evidence/report unit |
| Delivery strategy | auto-forecast |
| Chain strategy | pending |

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: pending
400-line budget risk: Low

### Suggested Work Units

| Unit | Goal | Likely PR | Focused test command | Runtime harness | Rollback boundary |
|---|---|---|---|---|---|
| 1 | Complete sanitized baseline evidence and report | Single PR | `npm run lint` | Read-only Supabase history/catalog queries; no provider traffic | Revert report and conditional living-doc/type changes only |

## Phase 1: Freeze and Inventory

- [x] 1.1 Record current HEAD, branch, status, protected-path exclusions, and documentation-only versus executable commits; preserve evidence without staging, committing, branching, or pushing.
- [x] 1.2 Inventory/checksum all local migrations `0001`–`0060`, explicitly record missing `0051` and the complete `0053`–`0060` chain; write sanitized ordered evidence and manifest to ignored temporary storage.
- [x] 1.3 Record environment variable names only (`.env.example` names listed in the report), linked Supabase ref/project identity, and production/staging/rehearsal role without secret values.

## Phase 2: Read-Only Reconciliation

- [x] 2.1 **RED:** prove `timeout 1s sh -c 'sleep 2'` exits 124, a fixed `delete from public.contacts` literal is rejected locally before network/database access, and the unallowlisted check exits nonzero; do not advance the gate on failure.
- [x] 2.2 Query authoritative remote migration history read-only through `0060`, recording version/name/order/checksum availability and identity; classify every mismatch exactly once as `represented/applied`, `local pending`, `remote-only/untracked`, or `ambiguous/manual-review`.
- [x] 2.3 Give each version `0053`, `0054`, `0055`, `0056`, `0057`, `0058`, `0059`, and `0060` an explicit disposition, with missing/contradictory evidence as `ambiguous/manual-review`; never infer application from local files or docs.
- [x] 2.4 For unresolved or conflicting history only, run targeted read-only comparisons of CRM/quote tables, helpers/RPCs/functions, RLS policies, triggers, constraints, and indicated Storage buckets/policies; record missing, unexplained, and behavioral drift.

## Phase 3: Types, Safety, and Verification

- [x] 3.1 Generate types to a temporary ignored path (never run `npm run db:types` against tracked output initially); retain hashes/diff, and regenerate tracked `lib/supabase/database.types.ts` only after alignment is proven and drift is confirmed. **Authenticated read-only MCP generation succeeded; temporary artifact hashes/diff were captured. Drift exists, but alignment is unproven because of remote-only `0051`, environment identity uncertainty, and recovery evidence gaps, so tracked regeneration is required but deferred.**
- [x] 3.2 Run `npm run lint`, `npm run build`, and `npm run test:quote-notifications`; add affected DB/contract/Storage/E2E suites only when evidence warrants, using `E2E_DISABLE_EXTERNAL_BOUNDARIES=1` and no real Resend/Meta traffic.
- [x] 3.3 Record production/staging/rehearsal evidence plus backup capability, configured coverage, rollback/recovery assumptions, and restore-test proof separately; mark unavailable or unproven evidence explicitly.

## Phase 4: Report and Stop Gate

- [x] 4.1 Create `openspec/changes/baseline-reconcile/reconciliation-report.md` with sanitized evidence, one register row per discrepancy, per-item disposition/remediation, explicit `0053`–`0060` outcomes, and final gate exactly `PASS`, `BLOCKED`, or `PASS WITH FOLLOW-UP`.
- [x] 4.2 If any remote mutation, history repair, destructive cleanup, or significant-risk action is proposed, stop and document the seven-part approval packet: evidence, problem, action, impact, rollback/recovery, exact command/change, and approval needed; execute nothing.
- [x] 4.3 Update `docs/PROGRESS.md` only for verified facts and `docs/DECISIONS.md` only for durable decisions, when justified; answer Yes/No whether the next migration identifier is safe.
- [x] 4.4 Record final command/results evidence, confirm no `0061+`, rewrite, cleanup, secret, provider traffic, commit/stage/push/PR, or unrelated feature occurred, then stop without beginning another change.
