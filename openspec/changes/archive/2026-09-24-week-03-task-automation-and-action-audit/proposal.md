# Proposal: Week 03 Task Automation and Action Audit

## Intent

Define future Task automation and immutable replay-safe action receipts while preserving cutover through `0076`.

## Scope

### In Scope
1. **`0077` audit**: immutable, authorization-aware receipts/outcomes.
2. **`0078` actions**: server-only RPC/adapter; start forbids metadata, cancel needs a closed reason, completion allows a closed outcome, terminal notes are bounded. Calls reauthorize; first terminal wins.
3. **`0079` foundation**: immutable origins/identity/due and non-blocking unresolved owner/context outcomes. Use pinned `America/Mexico_City` IANA/holiday rules, Mon–Fri 09:00–18:00; `+15m` inside hours, next opening `+15m` otherwise.
4. **`0080` sources**: one first-contact Task per Opportunity, anchored at later creation/first valid assignment; transfer on reassignment, cancel on unassignment/archive/terminal state, and complete only through audited `first_contact_completed`, never notes/follow-ups. Create quote follow-up per version's first sent transition at `+48h`; cancel for exact-version response/acceptance, unambiguous WhatsApp, verified exact `accepted_quote_version_id` payment, or rejected/expired/cancelled/superseded state.

These are product workstreams, not a native-slice count. Each may use any number of dependency-ordered, behavior-complete native slices. Each slice MUST be ≤400 authored lines including tests/types/docs/`ACTIVE.md`. Aggregate work of ≤1,200 authored lines is authorized; aggregate work of >1,200 authored lines automatically splits. Native ≤400 governs: no types-only/artificial file-type slices or compression.

The exploration's eleven formerly unresolved choices are confirmed here and in the corrected design.

### Out of Scope
- Pre-`0077` bootstrap, role-aware Mi día queues/UI, notifications, initial-quote SLA, remote access/rollout, event rewriting, and production/Week 03 closure.

## Capabilities

### New Capabilities
- `task-action-audit`: Receipts, replay, races.
- `task-automation-foundation`: Origins, due rules, unresolved outcomes.
- `task-source-automation`: First-contact and quote-version automation.

### Modified Capabilities
- `tasks-foundation`: Add native kinds/audited transitions; preserve lifecycle/RLS/authorization.

## Approach

Apply database ledgers/projectors in logical order `0077` audit → `0078` actions → `0079` foundation → `0080` sources, with canonical locks, source-namespaced SHA-256 identities, and no Task adoption.

## Affected Areas

| Area | Impact | Description |
|---|---|---|
| `db/migrations/0077_*`–`0080_*` | Planned/Create | Workstreams |
| `lib/admin/task-actions.ts`, focused `tests/task-{action,automation,source}-*.test.ts` | Planned/Create | Adapter/proof |
| `lib/admin/tasks.ts`, `lib/supabase/database.types.ts` | Modified | Adapter/types |
| `docs/implementation/ACTIVE.md`, `docs/DECISIONS.md`, `docs/PROGRESS.md` | Modified | Routing/evidence |

## Risks

| Risk | Likelihood | Mitigation |
|---|---|---|
| Calendar drift | Medium | Versioned vectors |
| Races/deadlocks | High | Canonical locks |
| Wrong target | High | Exact links |

## Rollback Plan

Destructive reversal is permitted only before any rows created by `0077`–`0080` exist, not merely before receipts exist. After any persisted `0077`–`0080` state exists—including any Task, origin, outcome, tombstone, receipt, event-linked automation state, or terminal action state—forward-disable hooks/execution; retain all such records and terminal status; preserve a compatible audited adapter boundary while keeping legacy `task_transition` revoked. Never contact remotes.

## Dependencies

- Canonical local cutover through `0076`; separate preview/apply bootstrap before Mi día.

## Success Criteria

- [ ] Receipt replay/no-op/races and both automations match confirmed policy.
- [ ] Invalid owners record unresolved without blocking sources.
- [ ] Workstreams use dependency-ordered, complete ≤400-line slices with colocated proof and no artificial splitting/compression.
- [ ] `0077`–`0080` preserve `0061`–`0076`, history, exclusions, and order.
