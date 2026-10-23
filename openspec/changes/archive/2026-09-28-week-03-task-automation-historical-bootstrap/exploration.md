## Exploration: Week 03 Task Automation Historical Bootstrap

### Current State

This exploration is based on local `main@50c82a05d5516320f514be43714e032484ac6eda` and the repository's pre-existing mixed staged, modified, and untracked Week 03 state. It performed no tests, database mutation, remote access, rollout, or implementation.

Migration `0080` intentionally admits only future first-contact and quote-follow-up sources. It persists immutable source cutoffs, prevents pre-cutoff generation through tombstones, and routes future generation/suppression through the `0079` origin/outcome projector. Existing pre-`0080` Opportunities and quote versions therefore remain unprojected unless a separate approved bootstrap applies them.

The established policies are already closed and MUST be reused rather than reopened:

| Concern | Established policy |
|---|---|
| First contact | One Task per Opportunity; later of Opportunity creation and first valid assignment; `mx-calendar.v1`; reassignment transfers active ownership; unassignment/archive/terminal state invalidates; only audited `first_contact_completed` completes. |
| Quote follow-up | One Task per version's first persisted `quote_sent`; anchor is persisted `sent_at`; due is exact elapsed `+48h`; exact response, terminal state, unambiguous WhatsApp, or verified exact-version payment invalidates. |
| Identity and safety | Source-namespaced SHA-256 origin/outcome/tombstone identities, immutable source order, no Task adoption, zero duplicates, source → origin → Task → receipt locking, and first-terminal-wins. |
| Owner/context failures | Unassigned, missing, inactive, invalid-role, ambiguous, or occupied facts are retained explicitly; source work does not create an invalid Task. |
| Approved execution | Admin-only read-only preview, canonical plan, immutable approval, request-scoped atomic apply, purge-independent receipt, exact replay/conflict behavior, and separate readiness accounting. |

The historical candidate universe can be frozen from the immutable `0080` cutoffs: every extant Opportunity with `created_at < opportunity_assignment.cutoff_at`, and every extant quote version with non-null `sent_at < quote_sent.cutoff_at`. Every root must appear exactly once in the canonical plan, including non-operational, invalid-owner, missing-event, already-projected, tombstoned, and occupied cases. Partial pages or unaccounted roots must fail closed.

Historical Opportunities do not have a complete authoritative first-valid-assignment timestamp. `leads` stores only current `assigned_to`, `created_at`, and general `updated_at`; the application writes an `assigned` event only after a separate update and ignores event-write failure, while initially assigned Opportunities may have no assignment event.

The product decision is confirmed as **`provable assignment only`**. A first-contact root may use only the earliest durable valid assignment occurrence proved from complete, internally consistent authoritative historical evidence; Opportunity creation participates only after assignment is proved, with `anchorAt=max(opportunity.createdAt,earliestValidAssignment.occurredAt)`. Opportunity creation, current assignment, `updated_at`, preview time, approval time, apply time, and inferred timestamps are never assignment fallbacks. Missing evidence yields `manual-review/context-invalid` with `ASSIGNMENT_EVIDENCE_MISSING`; contradictory ownership, duplicate occurrence identity, irreconcilable equal-time evidence, or incomplete assignment history yields `manual-review/context-invalid` with `ASSIGNMENT_EVIDENCE_CONTRADICTORY`. Those retained manual-review rows receive no Task, origin, outcome, or tombstone write.

Historical quote reconstruction does not require a new product policy: reuse exact-version rules and fail closed. A quote version without one provable first `quote_sent` event, or a WhatsApp occurrence whose exact single-active-version context cannot be reconstructed, is context-invalid/manual-review rather than broadly inferred.

**External research need:** None. The confirmed rule is an AC Travel historical-evidence policy, not a third-party API, framework, calendar, or legal question.

### Affected Areas

- `openspec/specs/task-automation-foundation/spec.md` — canonical identity, no-adoption, due, outcome, and race invariants to preserve.
- `openspec/specs/task-source-automation/spec.md` — canonical first-contact and quote source policies; future-only boundary must be extended only by this approved bootstrap.
- `openspec/specs/task-action-audit/spec.md` — immutable receipt, replay, authorization, and rollback precedent.
- `openspec/specs/follow-up-backfill-preview*.md` — pure classifier, bounded convergent reader, cutoff, canonicalization, and complete disposition-accounting precedent.
- `openspec/specs/follow-up-task-approval-ledger/spec.md` — one-row immutable approval and canonical hash/byte equations precedent.
- `openspec/specs/follow-up-task-approved-plan-apply/spec.md` — request lock, live revalidation, occupancy, atomic apply, receipt, replay, and concurrency precedent.
- `db/migrations/0077_task_action_audit_foundation.sql`–`0080_task_automation_sources.sql` — immutable current schema and source behavior; bootstrap must be additive and must not edit these files.
- Local migrations `0081`–`0088` — exact allocation resolved after Gate 0: `0081_task_automation_historical_preview_boundary.sql` owns canonical hash/UUID helpers and the Admin cutoff/high-water/census boundary; `0082_task_automation_historical_approval_foundation.sql` owns immutable approval storage, integrity, RLS, and grants; `0083_task_automation_historical_approval_rpc.sql` owns approval validation, request locking, replay, and conflict handling; `0084_task_automation_historical_apply_receipt.sql` owns immutable self-validating receipt storage, RLS, and grants; `0085_task_automation_historical_apply_validation.sql` owns universe guards and approval, cutoff/census/evidence, live-context, order, and occupancy revalidation; `0086_task_automation_historical_apply_writers.sql` owns private exact generate/suppress writers; `0087_task_automation_historical_apply_rpc.sql` owns the public receipt-first atomic apply coordinator; and `0088_task_automation_historical_readiness.sql` owns read-only exact accounting/parity. This local allocation does not authorize migration application or remote work.
- `lib/admin/<task-automation-bootstrap-preview|approval|apply>.ts` — likely strict server-only classifier/reader and adapters with injected local transports.
- `lib/supabase/database.types.ts` — exact additive table/RPC contracts only; no linked remote generation.
- `tests/task-automation-historical-*.test.ts` — pure, adapter, static SQL, disposable PostgreSQL, replay, concurrency, rollback, and preservation proof.
- `docs/implementation/ACTIVE.md`, `docs/DECISIONS.md`, `docs/PROGRESS.md` — later slice-level routing and verified local evidence; not changed by this exploration.

### Approaches

1. **Dedicated canonical preview → approval → apply pipeline** — Build a pure two-source classifier and bounded convergent reader, then persist an immutable approval and apply only its exact generate/suppress projections through additive RPCs and ledgers.
   - Pros: Reuses the proven architecture; freezes every candidate and disposition; supports review before mutation; gives exact replay, concurrency, receipt, rollback, and no-adoption guarantees.
   - Cons: Highest contract and proof volume; the confirmed provable-assignment rule can retain substantial missing, contradictory, or incomplete history for manual review; requires disciplined canonicalization and lock ordering across both source families.
   - Effort: High

2. **Direct rerunnable database reconciler** — Scan pre-cutoff rows and call the existing projector without a retained approved plan.
   - Pros: Less adapter and ledger code; reuses `0079` projection mechanics.
   - Cons: No separately reviewable frozen population, weak disposition accountability, mutable reruns can change eligibility, and approval/receipt semantics become implicit.
   - Effort: Medium, but does not satisfy scope

3. **One-off data migration/backfill** — Insert Tasks/origins/tombstones directly in a migration.
   - Pros: Small operational surface.
   - Cons: Couples schema and historical DML, has no explicit approval/replay boundary, is difficult to roll back safely, and risks adoption or partial accounting.
   - Effort: Medium, but unacceptable

### Recommendation

Use **Approach 1** and keep it separate from future hooks. The preview must be read-only and Admin-gated before client construction; its pure classifier must receive complete decoded facts and emit a canonical plan with no operational side effect. The immutable `0080` source cutoffs define historical membership, while fixed table cursors plus repeated digest convergence freeze the observed rows. Limits should remain bounded (recommended maximum 2,000 roots per source family); overflow, incomplete joins, malformed rows, or nonconvergence return no partial plan.

Use one closed accounting vector in this order:

`[apply/generate, apply/suppress, already/projected, already/suppressed, excluded/not-actionable, manual-review/owner-invalid, manual-review/context-invalid, collision/manual-review]`.

Every candidate root must contribute to exactly one count, and the count sum must equal row count and total count. Owner reasons reuse `OWNER_UNASSIGNED|PROFILE_MISSING|PROFILE_INACTIVE|ROLE_INVALID`. Context/collision reasons should be closed around `ASSIGNMENT_EVIDENCE_MISSING|ASSIGNMENT_EVIDENCE_CONTRADICTORY|FIRST_SENT_EVENT_MISSING|SOURCE_AMBIGUOUS|DUE_UNSUPPORTED|IDENTITY_OCCUPIED|STATE_MISMATCH`; the confirmed assignment reason names are fixed, while proposal/spec may rename the others but must not introduce catch-all provider text.

`apply/generate` rows must freeze source tuple, source key, source order, origin key, deterministic Task UUID, owner/context, anchor, due rule/version, and due time. Quote rows use the existing first-event origin/source formulas and `sent_at + 48h`. First-contact rows use only evidence admitted by the confirmed `provable assignment only` policy and `task_automation_due_at(...,'mx-calendar.v1')`; no apply-time timestamp is allowed. The deterministic Task UUID should be a closed hash-to-canonical-UUID mapping under a new bootstrap namespace and must be checked against every existing Task ID/key/origin namespace; it must never authorize adoption.

`apply/suppress` is only for a source already proven non-actionable under the established invalidation rules. It writes the existing-compatible tombstone plus immutable suppress outcome. Owner/context/manual-review and collision rows remain retained in the approval but receive no Task, origin, outcome, or tombstone write. Existing origin/outcome/tombstone/Task state is classified as already or conflict, never adopted or rewritten.

Apply locking should be: request identity → approval/receipt → deduplicated source identities in bytewise order → deduplicated origin identities → existing Task identities → inserts → receipt. A planned source order is `max(existing origin-local order)+1`; apply must revalidate the exact prior sequence before writing and return a stale-plan failure rather than renumber dynamically. Identical concurrent apply calls converge to one receipt; same request with changed actor/plan returns an idempotency conflict; a different request encountering any occupied namespace fails without adoption or partial writes.

**Result Contract.** The planning phase should formalize these exact boundaries:

- Preview success: `{ok:true,schema,ruleVersion,sourceCutoffs,snapshotCutoffs,snapshotHash,plan,planHash,counts,totalCount,diagnostics}`; failure is a closed code-only union. Canonical rows are ordered by `(sourceKind,anchorAt,sourceId)` with UUID tie-breakers and contain all frozen identities, action, disposition, and reason.
- Approval input: exactly `{requestId,preview}`. One immutable Admin-owned approval stores canonical plan/projections, all cutoffs/hashes/counts/UTF-8 byte counts, actor identity, and request fingerprint. Exact retry replays; changed identity conflicts.
- Apply input: exactly `{requestId}`. One atomic transaction revalidates approval integrity, current owner/context, cutoffs, ledger sequence, tombstones, and all occupancy namespaces before any write.
- Apply receipt: purge-independent and append-only, containing request/approval/actor identity; canonical plan/projection hashes; ordered Task/origin/outcome/tombstone IDs; per-action counts; exact canonical result/hash/byte count; and `replayed` only in the returned envelope.
- Readiness: `ready=true` only when every root is accounted, every planned write has receipt parity, and all owner/context/collision manual-review counts are zero. This gate may inform the later Mi día change but does not implement it or close Week 03.

**Rollback.** Before any bootstrap approval/apply state exists, callers, RPCs, and additive objects may be removed in reverse order. After any approval, apply receipt, Task, origin, outcome, or tombstone exists, rollback is forward-only: disable preview/approval/new apply execution, retain all immutable rows and Task state, keep `0077`–`0080` and legacy `task_transition` unchanged, and remediate any bad Task only through a separately approved audited action—not DELETE, adoption, or history rewrite.

**Local proof.** Use pure classifier vectors and injected-transport reader tests; strict adapter shape/privacy tests; static migration/type checks; and opt-in serial disposable PostgreSQL tests applying the local chain through the new migrations. Runtime proof must cover exact cutoffs, all dispositions/equations, owner/context failures, deterministic identities/due/order, existing tombstones, no adoption, exact replay/conflict, identical and competing concurrency, all-or-nothing failure, receipt survival, forward-disable rollback, `0077`–`0080` byte preservation, and the existing automation/action/cutover suites with zero skips. No remote evidence is part of this change.

**Native review forecast:** High aggregate risk; chained PRs are recommended. Keep tests/types/docs with each behavior and cap every native slice at 400 changed lines: (1) canonical classifier/accounting 300–360; (2) bounded source reader and cutoffs 330–390; (3) quote invalidation/context reconstruction 320–380; (4) approval ledger integrity 300–370; (5) approval RPC/adapter 330–390; (6) apply receipt integrity 280–350; (7) first-contact apply/revalidation 340–395; (8) quote generate/suppress apply 340–395; (9) replay/concurrency/rollback/preservation 330–395. If a slice exceeds 400, split by complete behavior, never by file type or compressed proof.

### Risks

- Treating `updated_at`, preview time, or an unreliable `assigned` event as the first valid assignment would fabricate first-contact due dates.
- Point-in-time quote/WhatsApp reconstruction can be incomplete for legacy rows; broad inference could suppress or create the wrong version Task.
- Dynamic source-order allocation at apply time would make approved bytes non-authoritative; strict stale-plan rejection is required.
- Existing Tasks, origins, outcomes, or tombstones can race preview/apply; every namespace needs ordered locking and exact live revalidation.
- Deterministic Task UUID derivation adds a new identity rule and must be specified identically in TypeScript, SQL, and tests.
- The repository is already in a mixed local state; later work must preserve unrelated bytes and use stable content receipts rather than naive `HEAD` diffs.
- Remote migration/schema/data parity remains unknown; local proof cannot authorize rollout or production readiness.

### Ready for Proposal

**Yes.** The sole product decision is resolved by the confirmed `provable assignment only` policy: exact first-contact eligibility and due values are admitted only for roots with complete, internally consistent authoritative assignment evidence; missing, contradictory, or incomplete evidence remains retained as context-invalid manual review without operational writes. Architecture, scope, accounting, apply semantics, rollback, proof, and ≤400-line delivery slices are otherwise unchanged. The exact local `0081`–`0088` allocation is resolved after Gate 0, without authorizing migration application or remote work. All other apparent policy questions are already resolved by the archived capabilities and should not be reopened. Mi día, notifications, remote rollout, future hooks, and final Week 03 closure remain explicitly excluded.
