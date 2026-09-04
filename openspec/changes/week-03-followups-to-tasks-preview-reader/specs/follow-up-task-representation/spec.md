# Delta for Follow-up Task Representation

## MODIFIED Requirements

### Requirement: Read-only representation and security contract

Contract tests MUST verify the existing representation and invariants: exact future Task mapping,
source-namespaced idempotency, exact-match conversion semantics as a pure decision, source,
owner-idempotency, and owner-lead collision reasons, closed reasons, nullability, precedence,
accounting, canonicalization, and limits. Equality MUST compare every deterministic proposed value
using recursive canonical JSON and exclude generated `id`, `created_at`, and `updated_at`. The reader
MUST represent every Task row as occupancy regardless of kind/source, while `ExistingTaskFact` remains
limited to exact complete follow-up-source equality. A complete follow-up DTO has exactly the 0064
selected fields, exact five-key string metadata, and exact `{followUpAt:string,hasNote:boolean}` payload;
an incomplete follow-up representation is `MalformedRow`. Tests MUST use injected local transports and perform zero
Task insert, update, delete, convert, or other mutation, schema change, remote access, or UI work.
(Previously: tests described lifecycle/deletion coverage and a migration-run premise.)

#### Scenario: Collision coverage preserves manual Tasks
- GIVEN a manual Task and a source-linked Task in the bounded population
- WHEN preview facts are decoded and classified
- THEN both are occupancy facts, only the exact source match is existing, and canonical output is unchanged

#### Scenario: Preview has no operational effect
- GIVEN the preview suite runs with an injected local transport
- WHEN it completes
- THEN no Task row, schema, approval, execution, or remote state changes

### Requirement: Closed row and response boundaries

Raw follow-up dates MUST produce null due fields when invalid. Projections MUST use closed column
allowlists and bounded 200/2001 paging. The reader response MUST be exactly
`{ok:true,plan,readerSnapshotHash,eventCutoff:{createdAt,id},taskCutoff:{createdAt,id}|null}` or
`{ok:false,error:{code:ReaderErrorCode,message:constant}}`, with no provider message or PII. Cutoffs
are acquired once after auth/client and before P1 and reused by every pass. Approval, execution, ledger, cancellation, revalidation, cutover,
rollout, operational Task creation, automation, SLA, notifications, Mi día, and UI are deferred.
(Previously: these boundaries were distributed across test prose.)

#### Scenario: Representation remains pure
- GIVEN valid manual and follow-up representations
- WHEN pure classification runs
- THEN existing decisions remain unchanged and no DML occurs
