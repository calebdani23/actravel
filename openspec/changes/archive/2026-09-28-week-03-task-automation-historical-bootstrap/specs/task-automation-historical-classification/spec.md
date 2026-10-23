# Task Automation Historical Classification Specification

## Purpose

Define a pure, deterministic classification of every pre-`0080` first-contact and sent quote-version root into one canonical historical bootstrap plan. This capability performs no authorization, source reads, approval, mutation, rollout, or readiness decision.

## Requirements

### Requirement: Closed historical root universe

The classifier MUST receive the immutable `0080` source cutoffs for exactly `opportunity_assignment` and `quote_sent`. The Opportunity root universe MUST contain every extant Opportunity whose canonical `created_at` is strictly before the `opportunity_assignment` cutoff. The quote root universe MUST contain every extant quote version whose canonical persisted `sent_at` is non-null and strictly before the `quote_sent` cutoff. A root remains in the universe when its current context is deleted, archived, terminal, unassigned, invalid, already projected, already suppressed, or occupied.

The input MUST include an explicit census for each source family and complete decoded facts for every root, required join, relevant evidence occurrence, current owner and role state, candidate identity occupancy, origin, outcome, and tombstone. An authoritative empty evidence set MUST be represented explicitly. A missing page, missing join, duplicate root, malformed fact, out-of-boundary fact, or census mismatch MUST fail the whole classification with no partial plan. Each root MUST produce exactly one canonical row.

#### Scenario: Both source families are completely represented

- GIVEN three pre-cutoff Opportunities and two pre-cutoff sent quote versions, including non-operational and already-processed roots
- WHEN classification succeeds
- THEN the canonical plan contains exactly five rows
- AND each root appears exactly once

#### Scenario: Incomplete census fails closed

- GIVEN the declared Opportunity census is ten but only nine distinct Opportunity facts are supplied
- WHEN classification runs
- THEN classification fails with `IncompleteFacts`
- AND no plan or partial rows are returned

### Requirement: Provable assignment evidence only

A first-contact root MUST use the earliest durable valid assignment occurrence that can be proved from authoritative historical evidence. A valid occurrence MUST identify the Opportunity, assigned owner, canonical occurrence timestamp, and immutable occurrence identity; it MUST be internally consistent and strictly before the planning snapshot boundary. The earliest occurrence MUST be selected by `(occurredAt ASC, occurrenceId ASC)` only after all assignment evidence for that Opportunity is proven complete.

Opportunity creation MUST participate only after assignment is proved: `anchorAt=max(opportunity.createdAt,earliestValidAssignment.occurredAt)`. Opportunity creation MUST NOT prove assignment and MUST NOT be used as an assignment fallback. Current assignment, `updated_at`, preview time, approval time, apply time, or any inferred timestamp MUST NOT substitute for a durable assignment occurrence. Missing assignment evidence MUST yield `manual-review/context-invalid` with `ASSIGNMENT_EVIDENCE_MISSING`. Contradictory ownership, duplicate occurrence identity, irreconcilable equal-time evidence, or an incomplete assignment history MUST yield `manual-review/context-invalid` with `ASSIGNMENT_EVIDENCE_CONTRADICTORY`.

#### Scenario: Creation participates only after assignment proof

- GIVEN an Opportunity was created at `2026-02-02T10:00:00.000000Z` and its earliest proved valid assignment occurred at `2026-02-02T10:05:00.000000Z`
- WHEN first-contact classification runs
- THEN `anchorAt` is exactly `2026-02-02T10:05:00.000000Z`
- AND the creation timestamp is not treated as the assignment occurrence

#### Scenario: Initially assigned row without durable occurrence is not enough

- GIVEN an Opportunity has a current `assigned_to` value and a creation timestamp but no durable valid assignment occurrence
- WHEN first-contact classification runs
- THEN its disposition is `manual-review/context-invalid`
- AND its reason is `ASSIGNMENT_EVIDENCE_MISSING`
- AND no generate or suppress action is planned

#### Scenario: Mutable timestamps are forbidden fallbacks

- GIVEN assignment evidence is missing but `updated_at`, preview time, approval time, and apply time are available
- WHEN first-contact classification runs
- THEN none of those timestamps is used as assignment evidence or `anchorAt`
- AND the root remains `manual-review/context-invalid`

### Requirement: Exact first-contact projection

An actionable first-contact root MUST have current, unambiguous Opportunity context and one current owner. The owner MUST have an active profile and a nonempty role set containing only `admin`, `manager`, or `asesor`. Owner failures MUST map exactly to `OWNER_UNASSIGNED`, `PROFILE_MISSING`, `PROFILE_INACTIVE`, or `ROLE_INVALID` under `manual-review/owner-invalid`.

For `apply/generate`, `sourceKind` MUST be `opportunity_assignment`, `sourceId` MUST be the Opportunity ID, `sourceKey` MUST be `H(["task-automation-source.v1","opportunity_assignment",opportunityId,ownerId,assignmentOccurredAt])`, `originKey` MUST be `H(["task-automation:v1","first_contact",opportunityId])`, `taskKind` MUST be `first_contact`, `dueRuleVersion` MUST be `mx-calendar.v1`, and `dueAt` MUST be the canonical result of the archived calendar rule applied to `anchorAt`. The Task context MUST be the Opportunity, the quote context MUST be null, and the description implied by the projection MUST be `Complete first contact`.

An exact durable `opportunity_unassigned`, `opportunity_archived`, or `opportunity_terminal` occurrence after the proved assignment MAY instead establish `apply/suppress`. Its source ID MUST be the Opportunity ID and its source key MUST be `H(["task-automation-source.v1",invalidationSourceKind,opportunityId,invalidationOccurredAt])`. A current non-actionable state without the complete exact occurrence required to distinguish the invalidation MUST NOT be inferred into suppression; it MUST be classified as context-invalid or, only when the root is independently and permanently outside the operational model, `excluded/not-actionable`.

#### Scenario: Valid historical first contact is generated deterministically

- GIVEN complete assignment evidence, an operational Opportunity, a current active valid-role owner, supported calendar range, and no occupied identity
- WHEN classification runs
- THEN the root is `apply/generate` with reason `ELIGIBLE_GENERATE`
- AND its source, origin, owner, anchor, rule version, and due values equal the closed formulas

#### Scenario: Exact unassignment suppresses generation

- GIVEN a proved first assignment followed by one exact durable unassignment occurrence and no existing suppression
- WHEN classification runs
- THEN the root is `apply/suppress` with reason `SOURCE_INVALIDATED`
- AND no Task identity or due value is planned

### Requirement: Exact quote-version reconstruction and invalidation

A quote root MUST have exactly one provable first persisted `quote_sent` occurrence selected by `(createdAt ASC,eventId ASC)` from the complete exact-version event history. The occurrence MUST identify the same quote version, and the version MUST identify exactly one quote and owner context. `anchorAt` MUST equal the persisted version `sent_at`, not event read time or any mutable timestamp. Missing first-sent evidence MUST yield `FIRST_SENT_EVENT_MISSING`; contradictory or duplicate-first evidence MUST yield `FIRST_SENT_EVENT_CONTRADICTORY`; ambiguous quote, version, owner, response, WhatsApp, or payment linkage MUST yield `SOURCE_AMBIGUOUS`. All three are `manual-review/context-invalid` and plan no write.

For `apply/generate`, `sourceKind` MUST be `quote_sent`, `sourceId` and `sentEventId` MUST be the first persisted sent-event ID, `sourceKey` MUST be `H(["task-automation-source.v1","quote_sent",quoteVersionId,sentEventId])`, `originKey` MUST be `H(["task-automation:v1","quote_follow_up",quoteVersionId,sentEventId])`, `taskKind` MUST be `quote_follow_up`, `dueRuleVersion` MUST be `elapsed-48h.v1`, and `dueAt` MUST equal canonical `sent_at + 48 elapsed hours`. The Task context MUST be the quote, Opportunity context MUST be null, and the description implied by the projection MUST be `Follow up on quote version`.

Suppression MUST be planned only from one complete exact-version invalidation occurrence admitted by the archived source policy: durable exact-version response; `accepted|rejected|expired|cancelled|superseded` transition; inbound WhatsApp proved to have exactly one active sent version at that occurrence; or verified payment carrying that exact `accepted_quote_version_id`. `received` payment, broad matching, current-state inference without occurrence proof, and unrelated versions MUST NOT suppress. Source keys MUST preserve the archived formulas: response `H(["task-automation-source.v1","quote_version_response",quoteVersionId,eventId])`; terminal state `H(["task-automation-source.v1",sourceKind,quoteVersionId,status])`; WhatsApp `H(["task-automation-source.v1","whatsapp_inbound",eventId,opportunityId,quoteVersionId])`; payment `H(["task-automation-source.v1","payment_verified",paymentId,quoteVersionId])`.

#### Scenario: First persisted sent occurrence anchors one version

- GIVEN a quote version has a complete event history with repeated sent events and a persisted canonical `sent_at`
- WHEN classification runs
- THEN only the earliest persisted `quote_sent` occurrence determines `sourceId`, `sentEventId`, `sourceKey`, and `originKey`
- AND `dueAt` is exactly 48 elapsed hours after `sent_at`

#### Scenario: Ambiguous historical WhatsApp does not suppress

- GIVEN an inbound WhatsApp occurrence cannot be proved to map to exactly one active sent version at occurrence time
- WHEN quote classification runs
- THEN no suppression is planned
- AND the affected root is `manual-review/context-invalid` with reason `SOURCE_AMBIGUOUS`

#### Scenario: Verified exact-version payment suppresses only its version

- GIVEN two sent quote-version roots and a durable verified payment naming exactly one accepted quote version
- WHEN classification runs
- THEN only the named version may receive `apply/suppress`
- AND the other version remains classified from its own independent facts

### Requirement: Closed dispositions, reasons, and precedence

The disposition set and count order MUST be exactly:

`[apply/generate, apply/suppress, already/projected, already/suppressed, excluded/not-actionable, manual-review/owner-invalid, manual-review/context-invalid, collision/manual-review]`.

Reasons MUST be limited to:

- `ELIGIBLE_GENERATE` for `apply/generate`;
- `SOURCE_INVALIDATED` for `apply/suppress`;
- `ALREADY_PROJECTED` for `already/projected`;
- `ALREADY_SUPPRESSED` for `already/suppressed`;
- `OPPORTUNITY_NOT_OPERATIONAL|QUOTE_NOT_OPERATIONAL` for `excluded/not-actionable`;
- `OWNER_UNASSIGNED|PROFILE_MISSING|PROFILE_INACTIVE|ROLE_INVALID` for `manual-review/owner-invalid`;
- `ASSIGNMENT_EVIDENCE_MISSING|ASSIGNMENT_EVIDENCE_CONTRADICTORY|FIRST_SENT_EVENT_MISSING|FIRST_SENT_EVENT_CONTRADICTORY|SOURCE_AMBIGUOUS|INVALIDATION_EVIDENCE_MISSING|DUE_UNSUPPORTED` for `manual-review/context-invalid`;
- `IDENTITY_OCCUPIED|STATE_MISMATCH|DUPLICATE_SOURCE_STATE|SOURCE_ORDER_EXHAUSTED` for `collision/manual-review`.

For each root, exact compatible existing origin/Task/outcome state MUST classify as `already/projected`; exact compatible tombstone/outcome state MUST classify as `already/suppressed`; duplicate, partial, mismatched, or foreign occupancy in any expected namespace MUST classify as collision and MUST NOT be adopted. Exact existing state takes precedence over a new action. A proven permanent exclusion takes precedence over owner validation. Context required to prove the source, anchor, due, or invalidation takes precedence over generation. Exact invalidation takes precedence over generation. No catch-all reason or provider text is allowed.

#### Scenario: Exact state is already projected

- GIVEN the expected immutable origin, deterministic Task, and applied generate outcome all exist with exact values
- WHEN classification runs
- THEN the root is `already/projected`
- AND no action is planned

#### Scenario: Partial state is a collision, not adoption

- GIVEN the deterministic Task ID exists but its origin, owner, kind, context, due, or key differs
- WHEN classification runs
- THEN the root is `collision/manual-review` with `IDENTITY_OCCUPIED` or `STATE_MISMATCH`
- AND the existing Task is neither adopted nor rewritten

### Requirement: Deterministic source order and identities

Let `C(value)` be canonical JSON with ASCII-sorted object keys, preserved array order, exact JSON primitives, and no unsupported value. Let `H(value)=lowerhex(SHA-256(UTF-8(C(value))))`. All UUIDs MUST be lowercase canonical UUID text and all timestamps MUST be UTC with exactly six fractional digits and `Z`.

For a planned action, `sourceOrder` MUST equal one plus the greatest existing source order for the same `originKey` across outcomes and tombstones, or `1` when none exists. It MUST be between `1` and `2147483647`; it MUST be frozen in the plan and MUST NOT be recomputed or renumbered by approval.

Every generate row MUST use a deterministic bootstrap Task UUID `U(originKey)`. `U` MUST hash `C(["task-automation-historical-task-id.v1",originKey])` with SHA-256, take the first 16 digest bytes, set byte 6 to `(byte6 AND 0x0f) OR 0x50`, set byte 8 to `(byte8 AND 0x3f) OR 0x80`, and format those bytes as lowercase canonical UUID text. The mapping MUST be identical for every caller and retry. It does not authorize adoption.

`outcomeKey` MUST be `H(["task-automation-outcome.v1",operationSourceKind,operationSourceId,sourceKey,action,originKey])`. A suppress row's `tombstoneKey` MUST be `H(["task-automation-tombstone.v1",operationSourceKind,operationSourceId,sourceKey,sourceOrder,originKey,"source_invalidated"])`. Generate rows MUST have null `tombstoneKey`.

#### Scenario: Repeated classification is byte-stable

- GIVEN identical normalized facts, cutoffs, snapshot metadata, and occupancy
- WHEN classification runs repeatedly
- THEN source keys, source order, origin keys, Task UUIDs, outcome keys, tombstone keys, due values, rows, and hashes are identical

#### Scenario: Existing sequence is frozen

- GIVEN an origin has existing source orders `1`, `2`, and `4`
- WHEN a new action is planned
- THEN its `sourceOrder` is exactly `5`
- AND approval cannot renumber it

### Requirement: Canonical row, order, plan, and accounting

Each row MUST be an object with exactly these keys:

`ordinal, sourceKind, rootId, anchorAt, sourceId, ownerId, opportunityId, quoteId, quoteVersionId, sentEventId, disposition, reason, action, operationSourceKind, operationSourceId, sourceKey, sourceOrder, originKey, taskId, taskKind, dueRuleVersion, dueAt, outcomeKey, tombstoneKey`.

`sourceKind` is the root family `opportunity_assignment|quote_sent`; `rootId` is the Opportunity or quote-version ID. `action` is exactly `generate|suppress` only for the two apply dispositions and is null for every other disposition. Any identity or context field that is not proved MUST be null; no value may be invented. Rows MUST sort by `(sourceKind ASC, anchorAt ASC NULLS LAST, sourceId ASC NULLS LAST, rootId ASC)` under bytewise ASCII comparison, then receive contiguous zero-based `ordinal` values.

The canonical plan MUST be exactly `{schema,ruleVersion,sourceCutoffs,snapshotCutoffs,snapshotHash,rows,counts,totalCount}` with `schema="task-automation-historical-plan.v1"` and `ruleVersion="task-automation-historical.v1"`. `counts` MUST be the eight-element nonnegative integer vector in the closed disposition order. Every row MUST increment exactly one element; `sum(counts)=rows.length=totalCount`; `totalCount=opportunityRootCount+quoteVersionRootCount`. `planHash` MUST be `H(plan)`.

#### Scenario: Null-bearing rows have deterministic order

- GIVEN valid manual-review rows with missing anchors or source IDs and valid rows with complete anchors
- WHEN the plan is canonicalized
- THEN complete timestamps and IDs sort before nulls within their source family
- AND `rootId` breaks every remaining tie
- AND ordinals are contiguous from zero

#### Scenario: Count mismatch fails classification

- GIVEN a row set in which a root is omitted, duplicated, or counted in two dispositions
- WHEN accounting is validated
- THEN classification fails with `InvariantViolation`
- AND no canonical plan is returned

### Requirement: Canonical limits and failure precedence

Each source family MUST contain at most 2,000 roots and the plan MUST contain at most 4,000 rows. Canonical UTF-8 bytes MUST be bounded to 4,096 bytes per row, 65,536 bytes for the plan with `rows=[]`, 16,777,216 bytes for the full plan, and 33,554,432 bytes for the normalized snapshot preimage. Counts and ordinals MUST be integers within their declared bounds. Hashes MUST be exactly 64 lowercase hexadecimal characters.

Failure precedence MUST be `IncompleteFacts`, `InvalidBoundary`, `InvalidFact`, `InvariantViolation`, then `CanonicalizationFailure`. Limit, serialization, byte-count, unsupported primitive, and hashing failures MUST be `CanonicalizationFailure`. No failure may include source payloads, PII, or provider text, and no failure may return a partial plan.

#### Scenario: Per-family overflow returns no plan

- GIVEN 2,001 Opportunity roots and otherwise valid complete facts
- WHEN classification runs
- THEN it fails with `CanonicalizationFailure`
- AND no quote-only partial plan is returned

### Requirement: Pure boundary and explicit exclusions

Classification MUST be referentially transparent for equal normalized inputs and MUST perform zero reads, authorization calls, inserts, updates, deletes, approvals, applies, receipt writes, Task actions, or remote operations. It MUST NOT change future `0080` hooks, infer event rewrites, adopt existing Tasks, implement Mi día, alter CRM reads, notify users, claim rollout, or close Week 03.

#### Scenario: Classification has no operational side effect

- GIVEN a complete snapshot containing generate, suppress, already, excluded, manual-review, and collision roots
- WHEN classification succeeds
- THEN it returns only the canonical descriptive plan and hashes
- AND every operational data set remains unchanged
