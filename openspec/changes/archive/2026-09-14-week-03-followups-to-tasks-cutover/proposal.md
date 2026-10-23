# Proposal: Week 03 Follow-ups-to-Tasks Cutover

## Intent

Complete the local cutover: canonical Tasks drive pending work and `lead_events` remains immutable history. Expose unresolved outcomes and make writes atomic and replay-safe.

## Scope

### In Scope
1. Request-scoped parity/readiness for one selected applied approval; unassigned-owner and collision/manual-review rows block readiness.
2. Atomic, idempotent future writes to note, immutable event, and Task. Missing dates are history-only; active `in_progress` rescheduling preserves status, identity, provenance, and key.
3. Task-backed CRM/contact contracts over visible nonterminal follow-up Tasks.
4. Dashboard, lead, and Contact read cutover with stable DTO/RPC names where possible.

### Out of Scope
- SLA/automation, general Task action receipts, notifications, role-aware Mi día, remote reconciliation/application, production rollout, and final Week 03 closure.

## Capabilities

### New Capabilities
- `follow-up-task-disposition-readiness`: Closed accounting/readiness for one request.
- `follow-up-task-future-write`: Atomic note/event/Task writes and replays.
- `follow-up-task-read-contracts`: Task-derived pending-work contracts.
- `follow-up-task-application-cutover`: Task-backed application readers.

### Modified Capabilities
- None; canonical contracts remain unchanged.

## Approach

Add migrations from tentative `0068`: Admin-gated parity RPC, authenticated `SECURITY DEFINER` write RPC, compatibility read definitions, then application replacement. Inherit Task RLS and event history. Delivery is `auto-chain` with `stacked-to-main`: forecast 2,400–3,200 lines, authorized 401–1,200-line exceptions, and automatic split above 1,200 subject to stricter native caps.

## Affected Areas

| Area | Impact | Description |
|---|---|---|
| `db/migrations/0068+` | New | Parity, write, read contracts |
| `lib/admin/*.ts` | Modified | Adapters and Task projections |
| `app/admin/(protected)/` | Modified | Write/read consumers |
| `lib/supabase/database.types.ts`, `tests/` | Modified | Types and local proof |

## Risks

| Risk | Likelihood | Mitigation |
|---|---|---|
| Parity gaps | High | Closed accounting; blockers fail readiness |
| Replay/provenance drift | Medium | Locks, fingerprints, immutable identity |
| Read/RLS regression | Medium | Preserve aliases; prove visibility/history |
| Remote drift | High | No remote claim or operation |

## Rollback Plan

Revert readers, read definitions/indexes, future-write caller/RPC, then parity RPC. Restore definitions additively; never edit `0061`–`0067` or delete committed notes, events, or Tasks.

## Dependencies

- Canonical Tasks, representation, approval, and apply contracts through `0067`.
- Clean approved-plan apply baseline.

## Local/Remote Boundary

Disposable PostgreSQL and local contracts may prove behavior. Remote migration, schema, and data remain unknown; reconciliation, application, repair, and rollout need separate authorization.

## Success Criteria

- [ ] One selected request accounts for every disposition once; unresolved rows block readiness.
- [ ] Future writes are atomic, replay-safe, history-only when undated, and preserve active Task invariants.
- [ ] Pending work uses visible `pending`/`in_progress` follow-up Tasks; event history remains intact.
- [ ] Four local slices provide bounded proof and independent rollback without remote access.
