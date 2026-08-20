# Delta for Baseline Reconciliation

## ADDED Requirements

### Requirement: Preserve generated snapshot and align nullable quote consumers

The system MUST verify that `lib/supabase/database.types.ts` already contains only the fixed snapshot bytes: mode `100644`, 113159 bytes, 3697 LF lines, SHA-256 `b6e3ea6876dd32c1e817d9f9f8ff7b28571a75ed5b29fd2faa5e10449b492637`. It MUST NOT regenerate or edit that file. Application consumers MUST use a minimum nullable overlay for `crm_quote_page` and `crm_quote_detail` `current_currency` and `accepted_currency` fields, preserving SQL nullability semantics at the mapper boundary.

#### Scenario: Exact snapshot is preserved
- GIVEN the tracked generated file and fixed snapshot have the required identity
- WHEN remediation is applied
- THEN the generated file is byte-for-byte unchanged and the nullable overlay is the only application compatibility correction

#### Scenario: Snapshot identity differs
- GIVEN any protected path, mode, byte count, line count, or hash differs
- WHEN remediation is requested
- THEN the operation fails closed before any source edit and records `BLOCKED`

### Requirement: Record generated semantic identity

The evidence MUST record the semantic generated diff as 1105 additions, 765 deletions, and 2238 unified-diff lines, together with a stable patch/hash identity. Generated changes MUST count in review and rollback accounting but MUST NOT count as authored-line budget.

#### Scenario: Generated diff is reviewed
- GIVEN the exact postimage is present
- WHEN the diff ledger is produced
- THEN its counts and stable identity are recorded without treating generated lines as authored work

### Requirement: Capture bounded validation diagnostics

The packet MUST capture the existing captured-type diagnostic and direct generated-type contract suite, direct `tsc --noEmit`, lint, guarded build, and quote-notification checks. Build MUST disable external boundaries and MAY use the existing local environment read-only. If build rewrites `next-env.d.ts`, the packet MAY restore it to its captured preimage and still report PASS only when the path was at that preimage when the command began, its post-command bytes are attributed exactly to that command, and restoration re-verifies the preimage identity. A collision, unknown bytes, or failed restoration/verification MUST report `BLOCKED`.

#### Scenario: Validation is safe and complete
- GIVEN external boundaries are disabled and all required inputs are available
- WHEN the validation ledger runs
- THEN every result is recorded with its command and outcome, with no external traffic

#### Scenario: Validation exposes consumer remediation
- GIVEN any check fails or requires an application or test source edit
- WHEN the result is reviewed
- THEN this child is `BLOCKED` and remediation is deferred to a separate consumer/app follow-up

#### Scenario: Differential validation isolates a pre-existing harness warning
- GIVEN the exact direct contract suite was run on the target preimage and postimage
- WHEN a server-only harness-only failure has identical test name, message, and diagnostic hash before and after alignment
- THEN it is recorded as pre-existing differential evidence and does not mask the alignment result
- BUT any new or changed failure MUST report `BLOCKED`

#### Scenario: Exact command-owned next-env rewrite is cleaned up
- GIVEN the captured preimage and exact command-owned post-command bytes of `next-env.d.ts` are verified
- WHEN the exact preimage is restored and re-verified
- THEN the cleanup does not prevent an otherwise passing validation ledger from reporting PASS

#### Scenario: next-env ownership or restoration is unsafe
- GIVEN `next-env.d.ts` has collided, contains unknown bytes, or cannot be restored and verified exactly
- WHEN cleanup is evaluated
- THEN the child reports `BLOCKED` and does not overwrite the unsafe bytes

## MODIFIED Requirements

### Requirement: Gate risky actions and preserve scope

The implementation source allowlist MUST be exactly `lib/supabase/database.types.ts`, `lib/admin/quotes.ts`, `tests/quotes-foundation-contract.test.ts`, and `tests/quote-registration-intents-contract.test.ts`. The generated file is read-only and must remain exact; only the named overlay and contract corrections are permitted. It MUST NOT perform generation, provider operations, migrations, package/config changes, other application/test edits, or modifications to unrelated paths. (Previously: the packet prohibited type overwrite as part of baseline drift inspection.)

#### Scenario: Protected scope is requested
- GIVEN an operation targets any path or action outside the named overlay/test allowlist
- WHEN scope is evaluated
- THEN it is rejected, recorded as `BLOCKED`, and no unrelated action occurs

### Requirement: Preserve generated-type and historical boundaries

The packet MUST preserve the captured diagnostic, snapshot identity, and historical evidence as labeled inputs. Alignment MAY prove only exact tracked-byte replacement and the listed local compatibility/validation outcomes. It MUST NOT claim fresh provider provenance, schema-history alignment, recovery readiness, authorization for `0061+`, or Week 01 closure. (Previously: the packet MUST NOT regenerate or modify tracked generated types.)

#### Scenario: Alignment passes narrowly
- GIVEN exact identity and required checks pass
- WHEN the result is published
- THEN it is reported only as bounded generated-type alignment and compatibility evidence

#### Scenario: Historical or provenance claim is requested
- GIVEN a conclusion depends on fresh provider evidence, recovery, or closure
- WHEN the conclusion is evaluated
- THEN it remains unproven and the parent status stays `BLOCKED`

## REMOVED Requirements

None.

## ROLLBACK

Rollback MUST preflight all rollback targets before writing. The generated type target MUST match its recorded postimage, and any exact command-owned `next-env.d.ts` rewrite MUST match its recorded command postimage. If either rollback target has collided or has unknown bytes, rollback MUST stop and report `BLOCKED`. Otherwise rollback MUST always restore and verify the exact generated type preimage bytes/mode and, when present, the exact captured `next-env.d.ts` preimage. Captured unchanged unrelated dirty paths and other unrelated paths MUST NOT stop rollback and MUST never be touched.
