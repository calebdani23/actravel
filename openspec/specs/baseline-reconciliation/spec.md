# Baseline Reconciliation Specification

## Purpose

Establish an evidence-first, non-destructive account of repository, Supabase history, live schema, generated types, environments, and recovery readiness before any new migration identifier is allocated.

## Requirements

### Requirement: Capture and classify the repository baseline

The reconciliation report MUST record current Git HEAD, branch, working-tree state, migration filenames/order/checksums where available, and classify documentation-only commits separately from executable application or schema changes. It MUST identify gaps such as the local `0051` gap without treating documentation as database evidence.

#### Scenario: Git evidence is complete
- GIVEN the repository contains code, migrations, and documentation commits
- WHEN the baseline is inspected
- THEN the report records exact Git evidence and identifies documentation-only commits without claiming remote application

### Requirement: Reconcile complete local and authoritative remote history

The report MUST inventory every local migration and the authoritative remote Supabase migration history, including names, versions, order, checksums when available, project identity, and environment. It MUST provide one explicit disposition for each version `0053` through `0060`.

#### Scenario: Version dispositions are explicit
- GIVEN local and remote histories may differ or lack checksums
- WHEN `0053`–`0060` are compared
- THEN each version has exactly one disposition and missing evidence is `ambiguous/manual-review`, never inferred

### Requirement: Use exclusive discrepancy labels

Every history or schema discrepancy MUST be classified exactly once as `represented/applied`, `local pending`, `remote-only/untracked`, or `ambiguous/manual-review`, with evidence and a remediation/disposition. Local presence or documentation MUST NOT prove remote application.

#### Scenario: A discrepancy cannot be silently resolved
- GIVEN evidence is incomplete or contradictory
- WHEN a discrepancy is recorded
- THEN it receives `ambiguous/manual-review` and no implementation or repair proceeds

### Requirement: Compare history to live schema

The report MUST compare migration history with live schema for targeted critical CRM and quote tables, functions/RPCs/helpers, RLS policies, triggers, constraints, and, when indicated, Storage policies and buckets. Comparisons MUST identify unexplained objects, missing objects, and behaviorally relevant differences without mutation.

#### Scenario: Live drift is found
- GIVEN history appears aligned but a targeted live object differs
- WHEN read-only schema evidence is compared
- THEN the object is reported and classified, with no destructive cleanup or history repair

### Requirement: Detect generated type drift safely

Generated Supabase types MUST first be compared using a temporary/read-only artifact that preserves diff or hash evidence. Regeneration MAY occur only after schema alignment is proven and drift exists; the prior artifact MUST remain reviewable.

#### Scenario: Types are stale
- GIVEN live schema and migration history are proven aligned
- WHEN the temporary comparison detects type drift
- THEN regeneration is permitted and its before/after evidence is retained; otherwise no regeneration occurs

### Requirement: Verify validation and environment safety

The baseline MUST run `npm run lint`, `npm run build`, and `npm run test:quote-notifications`, plus relevant DB, contract, and E2E suites when schema/contracts are touched. External traffic MUST remain disabled. The report MUST distinguish verified production state from staging/rehearsal availability and record backup, recovery, rollback, and restore-test capability separately from tested proof.

#### Scenario: Required proof is unavailable
- GIVEN staging or a restore test cannot be verified
- WHEN completion is evaluated
- THEN the capability is marked unavailable or unproven and cannot be represented as tested evidence

### Requirement: Gate all risky actions and preserve scope

Any remote mutation, history repair, destructive cleanup, or other significant-risk operation MUST stop before execution and produce a seven-part approval packet: evidence, exact problem, proposed action, expected impact, rollback/recovery plan, exact command/change, and specific approval needed. The work MUST NOT print, copy, log, or commit secrets; create `0061+`; rewrite `0053`–`0060` or quotes; or include prohibited features, dependency-baseline, ci-safety-gates, or Week 02.

#### Scenario: A repair is proposed
- GIVEN reconciliation identifies a remote-risk remediation
- WHEN the operator reaches the proposed action
- THEN execution stops at the complete approval packet pending specific approval

### Requirement: Publish a bounded final decision

The report MUST contain one classified disposition for every discrepancy, update `docs/DECISIONS.md` only for durable decisions and `docs/PROGRESS.md` only for verified facts, and end with exactly one gate: `PASS`, `BLOCKED`, or `PASS WITH FOLLOW-UP`. It MUST answer explicitly whether allocating the next migration identifier is safe.

#### Scenario: Reconciliation closes
- GIVEN all collected evidence and dispositions are reviewable
- WHEN the final gate is issued
- THEN the report states the gate and gives an explicit safe/not-safe answer for next migration allocation
