# Proposal: Follow-up-to-Task Classifier and Canonical Plan

## Intent

Define a pure, side-effect-free classifier for validated follow-up facts and a canonical plan; readers, cutoff acquisition, and mutation remain successors.

## Scope

### In Scope
- Immutable facts, strict UTC date parsing, cutoff selection, seven dispositions, exact future-Task mapping, collision comparison, bounded non-PII rows, canonical bytes/hash, counts, and typed errors.
- Determinism, precedence, limits, accounting, canonical equality, and purity behavior coverage.

### Out of Scope
- Admin/session adapters, Supabase reads, pagination, convergence, source decoding, approval, revalidation, DML, ledger, cancellation, cutover, schema, UI, automation, SLA, notifications, and CRM changes.

## Approach

Accept complete immutable, pre-decoded facts only. Parse dates strictly to UTC with the ±14:00 ceiling and normalized year 1970..9999. Apply the inclusive cutoff `createdAt < cutoffCreatedAt OR (createdAt === cutoffCreatedAt AND eventId <= cutoffId)`, select latest valid per operational lead, or latest invalid if none is valid, then classify and emit bounded non-PII primitives. Canonicalize exactly `[ruleVersion,cutoffCreatedAt,cutoffId,rows,counts,totalCount,0,0,0,false]` as compact UTF-8 JSON and hash it. Enforce 2,000 rows, 512-byte canonical rows, the 4,096-byte static header/count/constants ceiling, and a defensive 1MiB limit. No padding or exact-size builder exists.

The ordered error precedence is: absent boundary/fact/join/property → `IncompleteFacts`; malformed present boundary → `InvalidBoundary`; malformed/out-of-cutoff/duplicate individual fact/illegal tag → `InvalidFact`; contradiction or accounting failure → `InvariantViolation`; serialization/hash/limit failure → `CanonicalizationFailure`.

## Affected Areas

| Area | Action | Description |
|---|---|---|
| `lib/admin/follow-up-backfill-preview.ts` | Create | Pure validation, parser, classifier, Task mapping/equality, canonicalization, and errors. |
| `tests/follow-up-backfill-preview.test.ts` | Create | Executable behavior tests; exact fixtures belong to tasks. |

## Success Criteria

- [ ] Seven dispositions, closed reason unions, selection/cutoff, collision precedence, nullability, accounting, limits, canonical vector, Task vector/equality, typed errors, and zero side effects are implementation-closed.
- [ ] Executable tests construct legal facts and assert count/limit behavior without an exhaustive literal fixture catalog.

## Rollback Plan

Revert the pure implementation and tests; no operational state is changed.
