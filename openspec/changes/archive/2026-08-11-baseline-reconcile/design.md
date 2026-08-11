# Design: Reconcile the Repository and Supabase Baseline

## Technical Approach

Build a read-only, evidence-first pipeline: freeze identity and Git context, inventory local migrations, query authoritative remote migration history through `0060`, compare identities/checksums, then inspect live schema only for missing or conflicting history evidence. Capture sanitized immutable evidence, classify every discrepancy, and stop at an approval packet. No `0061+`, remote write, history repair, destructive cleanup, quote rewrite, dependency-baseline, CI-safety-gates, Week 02, or prohibited Business OS feature is authorized.

## Architecture Decisions

| Decision | Choice | Alternatives / rationale |
|---|---|---|
| Evidence authority | Remote migration history is authoritative for applied state; live catalog is a conditional cross-check. | Docs or linked-ref metadata cannot prove application. Catalog queries are limited to absent/conflicting history to reduce exposure. |
| Capture safety | Ordered, append-only, sanitized JSON/SQL-result files under ignored temporary evidence storage, with hashes and a manifest. | Printing raw environments or provider output risks secrets; mutable ad-hoc notes are not auditable. |
| Type drift | Generate types to a temporary ignored path, diff/hash against the tracked file, and overwrite only after alignment is proven and drift is confirmed. | `npm run db:types` directly overwrites useful evidence and is prohibited before alignment. |
| Remediation gate | Report and seven-part approval packet precede any mutation. | Automatic repair can destroy production history; database rollback is not executed here. |

## Data Flow

`identity/Git → local inventory → remote history ≤0060 → conditional catalog cross-check → types/test evidence → discrepancy register → report + approval gate`

The local inventory records all 59 numbered SQL files (`0001`–`0060`), exact names/order/checksums, the absent `0051`, and the complete `0053`–`0060` quote chain. Remote history records version, name, order, and checksum where exposed. Every difference receives exactly one label: `represented/applied`, `local pending`, `remote-only/untracked`, or `ambiguous/manual-review`.

## File Changes

| File | Action | Description |
|---|---|---|
| `openspec/changes/baseline-reconcile/design.md` | Create | This implementation design only. |
| `openspec/changes/baseline-reconcile/reconciliation-report.md` | Later create | Sanitized evidence, register, gate result, and remediation plan; not created in design phase. |
| `docs/PROGRESS.md`, `docs/DECISIONS.md` | Conditional later modify | Update only verified shipped state or durable decisions; never record inference. |
| `lib/supabase/database.types.ts` | Conditional later modify | Regenerate only after proven schema alignment and detected drift. |

## Interfaces / Contracts

The register row is `{subject, local_evidence, remote_evidence, classification, impact, disposition, remediation, approval_required}`. Evidence must contain no secret values, tokens, credentials, cookies, database URLs, or provider payloads. Environment evidence records only variable names, linked ref/project identity, and a production/staging/rehearsal classification. Backup evidence distinguishes **capability available**, **coverage configured**, and **restore tested**.

Ordered capture: (1) Git HEAD/branch/status and protected-path exclusions; (2) environment variable names and Supabase ref without values; (3) local migration inventory/checksums; (4) read-only remote migration history through `0060`, explicitly resolving `0051` and each `0053`–`0060`; (5) catalog cross-check only for missing/conflicting history, covering CRM/quote tables, functions/helpers/RPCs, RLS/policies, triggers, constraints, and Storage buckets/policies as needed; (6) temporary generated-types diff; (7) safe verification commands and environment/backup evidence; (8) report and final gate.

## Testing Strategy

Run `npm run lint`, `npm run build`, and `npm run test:quote-notifications`; add relevant CRM/quote contract, DB, Storage, and E2E suites only when the register shows impact. Use the existing Playwright harness with `E2E_DISABLE_EXTERNAL_BOUNDARIES=1`; never send Resend/Meta traffic. Record command, exit status, timestamp, and sanitized output.

## Threat Matrix

| Boundary | Status | Safe/failure behavior; RED test |
|---|---|---|
| Shell/subprocess | Applicable | Fixed commands, controlled cwd, no secret interpolation; fail closed on non-zero/timeout. RED: command failure cannot advance gate. |
| Remote/database process | Applicable | Read-only history/catalog queries only; abort on identity uncertainty or any write request. RED: mutation-shaped command is rejected. |
| Executable classification | Applicable | Allowlist `npm`, read-only Supabase/SQL tooling, and test harness; reject unknown executables. RED: unallowlisted executable stops pipeline. |
| Routing/VCS/PR automation | N/A | No route or VCS/PR mutation is designed. |

## Migration / Rollout

No migration required. The final verification gate must be exactly one of `PASS`, `BLOCKED`, or `PASS WITH FOLLOW-UP`: use `PASS` only if history, schema/type evidence, tests, environment separation, and recovery evidence align; use `PASS WITH FOLLOW-UP` when the non-destructive baseline is usable but documented follow-up remains; otherwise use `BLOCKED`. Separately, the report must answer **Yes/No: safe to allocate the next migration identifier?** Any unresolved ambiguity is **No**. The seven-part approval packet is: evidence, exact problem, proposed action, impact, rollback/recovery, exact command/change, and specific approval requested. Hard stop before remote mutation, history repair, destructive/significant-risk action. Repository-only report/doc changes can be reverted; database rollback is not executed because this change performs no database mutation and cannot safely infer a rollback for unknown remote state.

## Open Questions

- [ ] Which environment role (production, staging, or rehearsal) does the linked ref actually have?
- [ ] Does remote history expose checksums and do configured backups include a tested restore target?
