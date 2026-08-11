# Proposal: Reconcile the Repository and Supabase Baseline

## Intent

Establish a trustworthy, evidence-first baseline before any new migration or Business OS work. The change will reconcile local migration inventory with authoritative remote history and schema, expose drift without mutating services, and record whether the next migration identifier is safe to allocate.

## Scope

### In Scope
- Inventory local migrations and compare authoritative remote history, explicitly resolving `0053`–`0060`.
- Detect and classify every discrepancy as exactly one of: `represented/applied`, `local pending`, `remote-only/untracked`, or `ambiguous/manual-review`.
- Compare critical CRM/quotes tables, RPCs/helpers, RLS policies, triggers, constraints, Storage policies/buckets, and generated Supabase types when drift evidence warrants it.
- Verify production/staging/rehearsal reality, backup/recovery capability, rollback assumptions, and safe baseline validation.
- Produce an active OpenSpec reconciliation report and a classified, approval-gated remediation plan.

### Out of Scope
- Migration `0061+`, migration-history repair, destructive cleanup, remote mutation, or secret exposure.
- Rewriting migrations `0053`–`0060` or the quote subsystem.
- Tasks/Mi día, Manager/Gerencia, customer portal, Trips, Travelers, Payment Plan, Suppliers, incidents, Marketing Studio, or unrelated UX/UI redesign.
- Dependency-baseline, ci-safety-gates, Week 02, commit, stage, push, branch, or PR.

## Capabilities

### New Capabilities
- `baseline-reconciliation`: Evidence capture, discrepancy classification, reconciliation reporting, and approval-gated remediation readiness.

### Modified Capabilities
- None.

## Approach

Use read-only local and Supabase evidence first. Capture migration names/order/checksums, environment identity, live objects and RLS/helpers, then compare against repository migrations and generated types. Run `npm run lint`, `npm run build`, `npm run test:quote-notifications`, plus affected DB/contract/E2E suites with external boundaries disabled and no real Resend/Meta traffic. Regenerate types only after schema alignment is proven, preserving a diff/hash as evidence. Document verified facts in `docs/PROGRESS.md` and durable decisions in `docs/DECISIONS.md` only when warranted.

Any remote-risk action must stop at a packet containing evidence, exact problem, proposed action, impact, rollback/recovery, exact command/change, and the specific user approval required.

## Affected Areas

| Area | Impact | Description |
|---|---|---|
| `db/migrations/` | Inventory/compare | Local history through `0060`, including the `0051` gap and quote chain. |
| Supabase linked project | Read-only evidence | History, schema, RLS/helpers, environment, backups; no mutation. |
| `lib/supabase/database.types.ts` | Compare/regenerate only if aligned | Determine generated type drift without overwriting evidence prematurely. |
| `openspec/changes/baseline-reconcile/` | New report | Store reconciliation evidence and dispositions. |

## Risks

| Risk | Likelihood | Mitigation |
|---|---|---|
| Linked ref is production or history lacks checksums | Med | Verify identity; classify ambiguity; stop before writes. |
| No staging or tested restore exists | High | Report unavailable capability and require approval packet for remediation. |

## Rollback Plan

This phase is non-destructive. Revert only its report/living-document additions; do not roll back database state. Any later additive change requires separate approval, backup/recovery proof, and an explicit rollback procedure.

## Dependencies

- Read-only Supabase access and controlled environment identity.
- Existing local migration, test, and Playwright safety configuration.

## Success Criteria

- [ ] Reconciliation report records local/remote baseline, every discrepancy and disposition, explicit `0053`–`0060` status, RLS/helpers checks, generated-types conclusion, final verification, staging/rehearsal reality, and backup/rollback/recovery state.
- [ ] Required lint/build/focused test baseline and relevant DB/contract/E2E evidence are captured without real external traffic.
- [ ] Remediation is classified and approval-gated; no prohibited mutation occurs.
- [ ] Report gives an explicit yes/no answer on whether allocating the next migration identifier is safe.
