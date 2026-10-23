# Proposal: Week 03 Task Automation Historical Bootstrap

## Intent

Safely project eligible pre-`0080` first-contact and quote-version work into native Tasks without weakening the future-only automation boundary. The change establishes a reviewable canonical preview, immutable Admin approval, and atomic apply path that accounts for every historical root and never invents assignment or quote context.

## Scope

### In Scope

1. **Canonical classification and accounting**: classify every pre-cutoff Opportunity and sent quote-version root exactly once using the closed disposition order `[apply/generate, apply/suppress, already/projected, already/suppressed, excluded/not-actionable, manual-review/owner-invalid, manual-review/context-invalid, collision/manual-review]`.
2. **Admin preview**: read a bounded, convergent snapshot against the immutable `0080` source cutoffs and return no partial plan when roots, joins, evidence, occupancy, limits, or convergence cannot be proven.
3. **Immutable approval**: persist one Admin-owned canonical plan and its projections, cutoffs, hashes, counts, UTF-8 byte counts, actor identity, and request fingerprint with exact replay and changed-identity conflict behavior.
4. **Atomic apply and readiness**: revalidate the approved plan and live state, apply only exact generate/suppress projections, append a purge-independent receipt, support deterministic replay/concurrency, and report readiness from complete receipt parity and zero unresolved manual-review counts.

For historical first contact, assignment evidence is valid only when the earliest durable valid assignment occurrence is provable. Opportunity creation participates only in the established `max(created_at, first-valid-assignment-at)` anchor after assignment is proven; it is never an assignment fallback. Missing or contradictory evidence is `manual-review/context-invalid`. `updated_at`, preview time, approval time, and apply time MUST NOT substitute for assignment evidence. Historical quote reconstruction likewise requires a provable first persisted `quote_sent` occurrence and exact-version invalidation context.

The four product phases may decompose into dependency-ordered, behavior-complete native slices of at most 400 authored lines each and auto-chain. The 400-line limit governs every native slice; splitting by file type or compressing proof is not acceptable. Review packets auto-split at the nearest native boundary before they would exceed 1,200 authored changed lines.

### Out of Scope

- Changes to future `0080` hooks or their established first-contact and quote policies.
- Role-aware Mi día, Dashboard/CRM read changes, notifications, and new SLA policy.
- Remote access, migration application, rollout, or production-readiness claims.
- Final Week 03 closure or reopening archived automation/action-audit decisions.
- Event rewriting, Task adoption, broad quote/WhatsApp inference, or destructive history repair.

## Capabilities

### New Capabilities

- `task-automation-historical-classification`: Pure two-source classification, evidence rules, deterministic identities/due/source order, and complete disposition accounting.
- `task-automation-historical-preview`: Admin-only bounded convergent reading, immutable cutoff membership, complete root census, canonical plan construction, and fail-closed diagnostics.
- `task-automation-historical-approval`: Immutable approval ledger, canonical hash/byte equations, Admin ownership, replay, and idempotency-conflict behavior.
- `task-automation-historical-apply`: Atomic approved-plan generation/suppression, live revalidation, no-adoption occupancy checks, purge-independent receipts, replay/concurrency, readiness, and rollback boundaries.

### Modified Capabilities

None. The archived canonical capabilities remain authoritative and are composed by the new bootstrap capabilities without changing their requirements.

## Approach

Reuse the archived follow-up preview/approval/apply architecture as an additive historical path. Freeze membership from the immutable `0080` source cutoffs: extant Opportunities created before the assignment cutoff and extant quote versions with non-null `sent_at` before the quote-sent cutoff. A pure classifier consumes complete decoded facts; an Admin-gated reader uses fixed cursors and repeated snapshot-digest convergence, bounded to 2,000 roots per source family, before producing one canonical plan.

Canonical rows sort by `(sourceKind, anchorAt, sourceId)` with UUID tie-breakers. Generate rows freeze the source tuple/key/order, origin key, deterministic bootstrap-namespaced Task UUID, owner/context, anchor, due rule/version, and due time. First-contact due uses the proven assignment anchor with `mx-calendar.v1`; quote due is exact persisted `sent_at + 48h`. Planned source order is frozen as `max(existing origin-local order)+1`; apply rejects stale sequence state rather than renumbering.

Apply/suppress is allowed only for a source proven non-actionable under archived invalidation rules. Owner/context/collision manual-review rows remain in approval and produce no Task, origin, outcome, or tombstone. Existing Task/origin/outcome/tombstone occupancy is classified as already or conflict and is never adopted or rewritten. Apply takes locks in this exact order: request advisory → approval/receipt rows → exclusive universe advisory → raw source advisory → raw origin advisory → deterministic Task identity advisory (works before Task exists) → source/evidence/context rows including any occupied Task row → writes/receipt. Additive shared statement-level guards on every source/evidence/context writer cover the existing future hooks without changing them; the matching exclusive bootstrap universe advisory drains prior guarded writers and blocks later guarded writers through commit, so absent or backdated roots, evidence, and context cannot appear as phantoms between revalidation and receipt. Identical concurrent calls converge; competing occupancy fails atomically.

## Result Contract

- **Preview success**: exactly `{ok:true,schema,ruleVersion,sourceCutoffs,snapshotCutoffs,snapshotHash,plan,planHash,counts,totalCount,diagnostics}`. Failure is a closed code-only union with no partial plan, provider text, or PII.
- **Approval input**: exactly `{requestId,preview}`. Exact retry replays the immutable approval; changed actor, identity, or approved bytes conflicts.
- **Apply input**: exactly `{requestId}`. One transaction validates approval integrity, current owner/context, cutoffs, source order, tombstones, and every identity namespace before any write.
- **Apply receipt**: append-only and purge-independent, containing request/approval/actor identity; plan/projection hashes; ordered Task/origin/outcome/tombstone IDs; per-action counts; and exact canonical result/hash/UTF-8 byte count. `replayed` appears only in the returned envelope.
- **Readiness**: `ready=true` only when every root has exactly one disposition, every planned write has receipt parity, and owner/context/collision manual-review counts are all zero. Readiness does not implement Mi día or close Week 03.

## Affected Areas

| Area | Impact | Description |
|---|---|---|
| `openspec/changes/week-03-task-automation-historical-bootstrap/specs/` | New | Four capability specifications for classification, preview, approval, and apply. |
| `db/migrations/0081_task_automation_historical_preview_boundary.sql` | Planned/Create | Canonical hash/UUID helpers and Admin cutoff, high-water, and census RPC. |
| `db/migrations/0082_task_automation_historical_approval_foundation.sql` | Planned/Create | Immutable approval table, checks, fingerprint/integrity trigger, RLS, and grants. |
| `db/migrations/0083_task_automation_historical_approval_rpc.sql` | Planned/Create | Exact approval validation, request lock, and replay/conflict RPC. |
| `db/migrations/0084_task_automation_historical_apply_receipt.sql` | Planned/Create | Self-validating no-FK receipt, trigger, forced RLS, and grants. |
| `db/migrations/0085_task_automation_historical_apply_validation.sql` | Planned/Create | Private approval, cutoff/census/evidence, live-context, order, and occupancy validation helpers. |
| `db/migrations/0086_task_automation_historical_apply_writers.sql` | Planned/Create | Private exact first-contact and quote generate/suppress writers. |
| `db/migrations/0087_task_automation_historical_apply_rpc.sql` | Planned/Create | Receipt-first coordinator, total locks, atomic writes, replay, and concurrency. |
| `db/migrations/0088_task_automation_historical_readiness.sql` | Planned/Create | Read-only exact accounting/parity RPC. |
| `lib/admin/task-automation-historical-*.ts` | New | Pure classifier, Admin reader, approval adapter, apply adapter, and strict result decoding. |
| `lib/supabase/database.types.ts` | Modified | Exact additive tables and RPC contracts only; no linked remote generation. |
| `tests/task-automation-historical-*.test.ts` | New | Future pure, adapter, static, disposable PostgreSQL, replay, concurrency, rollback, and preservation proof. |
| `openspec/specs/task-{automation-foundation,source-automation,action-audit}/spec.md` | Preserved | Authoritative identity, source-policy, action, race, and rollback invariants; no requirement changes. |
| `docs/implementation/ACTIVE.md`, `docs/DECISIONS.md`, `docs/PROGRESS.md` | Modified later | Slice routing, durable decisions, and verified local evidence during implementation only. |

## Risks

| Risk | Likelihood | Mitigation |
|---|---|---|
| Historical assignment evidence is incomplete or contradictory. | High | Require the provable earliest durable valid occurrence; retain all other roots as context-invalid manual review with no fallback timestamp. |
| Legacy quote response or WhatsApp context cannot be tied to exactly one version. | High | Require exact-version proof and classify ambiguity as context-invalid rather than infer broadly. |
| Preview and apply observe changed source order or occupied identities. | High | Freeze deterministic order, use canonical lock ordering, and fail stale/conflicting plans without adoption or partial writes. |
| TypeScript and SQL derive different Task UUID, due, or canonical bytes. | Medium | Specify one closed hash-to-canonical-UUID mapping and shared golden vectors for identity, calendar, order, hashes, and byte equations. |
| Large historical populations produce partial or unreviewable plans. | Medium | Bound each source family to 2,000 roots and fail closed on overflow, incomplete joins, malformed facts, or nonconvergence. |

## Rollback Plan

Before any bootstrap approval, receipt, Task, origin, outcome, or tombstone exists, remove callers, RPCs, and additive objects in reverse dependency order. After any bootstrap state exists, rollback is forward-only: disable preview, approval, and new apply execution; retain immutable approvals, receipts, Tasks, origins, outcomes, and tombstones; preserve `0077`–`0080` and legacy `task_transition` revocation; and remediate an incorrect Task only through a separately approved audited action. Never delete, adopt, or rewrite historical state.

## Dependencies

- Canonical `task-automation-foundation`, `task-source-automation`, `task-action-audit`, and `tasks-foundation` requirements.
- Canonical follow-up classifier/reader, approval-ledger, and approved-plan-apply precedents.
- Immutable `0080` source cutoffs and unchanged `0077`–`0080` behavior.
- Exact local migration identifiers `0081`–`0088`, confirmed free after Gate 0 and allocated to this plan; this local allocation does not authorize migration application or remote work.
- No external research or third-party dependency is required.

## Success Criteria

- [ ] Every pre-cutoff Opportunity and sent quote-version root appears exactly once, and disposition counts equal row count and total count.
- [ ] Missing or contradictory assignment/quote evidence is retained as context-invalid manual review; no creation, `updated_at`, preview, approval, or apply-time fallback is used.
- [ ] Canonical bytes, Task/origin identities, due values, and source order are deterministic across preview, approval, SQL, and replay.
- [ ] Approval and apply are Admin-only, immutable, replay-safe, concurrency-safe, atomic, and purge-independent.
- [ ] Existing Task/origin/outcome/tombstone occupancy is never adopted or rewritten, and any stale or conflicting plan commits zero partial writes.
- [ ] Readiness is true only with complete accounting, receipt parity, and zero owner/context/collision manual review.
- [ ] Local pure, adapter, static, disposable PostgreSQL, replay, concurrency, rollback, and preservation proof passes with zero skips while `0077`–`0080` bytes and behavior remain unchanged.
- [ ] Delivery uses auto-chained, dependency-ordered, behavior-complete native slices of at most 400 authored lines; review packets auto-split at the nearest native boundary before exceeding 1,200 authored changed lines; and no remote, rollout, Mi día, notification, or Week 03 closure claim is made.
