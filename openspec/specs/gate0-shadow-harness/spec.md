# Gate 0 Factual Baseline Specification

## Purpose

Gate 0 SHALL establish current baseline facts without self-authorizing machinery. A factual
apply report, independent native verification, and the native review/post-apply gate SHALL
all pass before the change is ready to archive or be consumed downstream.

## Requirements

### Requirement: Fresh read-only remote facts

The parent MUST freshly capture the configured project ref/URL, R002 migration list, public
table list, and fixed read-only role/catalog/ledger query. R002 MUST normalize to an ordered,
duplicate-free table of exactly 59 `{version,name}` objects and bind its exact UTF-8 bytes
and SHA-256 as the expected remote list. PASS requires ref `bdyhakpmxegoipbmbtjb`, its
matching URL, the complete SQL ledger exactly equal to that expected table, remote-only
`0051`, accepted missing `0057`, and no remote `0061+`. Selected-name checks alone cannot
PASS.

Remote `tasks` and `staff_notifications` MUST be absent. The Manager role row MUST be
absent, and the remote `roles_name_check` and `roles staff read` definitions MUST NOT
contain Manager. Missing `0057` is accepted only as the independently verified Week 01
`ABSENT_WITH_EFFECT_EQUIVALENCE` disposition, never as execution provenance.

#### Scenario: Expected remote baseline
- GIVEN all parent operations are fresh, read-only, and bound to the exact project
- WHEN migration and catalog facts are checked
- THEN the complete R002 table/hash equals the complete SQL ledger and every other remote
  fact passes

#### Scenario: Remote ambiguity
- GIVEN any operation is unavailable, stale, targets another project, or differs
- WHEN Gate 0 is evaluated
- THEN the factual outcome is `BLOCKED` and no local result overrides it

### Requirement: Exact local migration source

The apply run MUST bind an ordered, duplicate-free manifest of exactly 60
`{filename,sha256}` rows through `0061_manager_capability_foundation.sql`. The individual file
`0061_manager_capability_foundation.sql` MUST equal SHA-256
`979f03da567e32c12e2a5eef1c6b1f093332776719830b09dcb8474c327c81dd`; that value is not the
aggregate 60-row manifest hash. The complete isolated-copy and post-run source manifests
MUST equal the complete initial manifest. The complete 60-row local ledger, normalized to
`{version,name}`, MUST equal all manifest filenames normalized by removing `.sql` and
splitting the four-digit version.

#### Scenario: Local manifest passes
- GIVEN current repository migration bytes
- WHEN the sorted source and isolated-copy manifests are compared
- THEN all three filename/hash manifests and the complete 60-row ledger agree and end at
  the required `0061` hash

### Requirement: Isolated local facts

Supabase CLI `2.115.0` MUST initialize a temporary external project, start successfully,
and reset successfully with all local migrations. There MUST be no linked or remote
fallback and no persistent local database.

A fixed read-only local query MUST prove:

- migration ledger count `60`, version `0061`, name `manager_capability_foundation`;
- exactly one `manager` role row;
- exact `roles_name_check` definition including the six role names and Manager;
- exact `roles staff read` expression including Admin, Asesor, Operaciones, Finanzas,
  Marketing, and Manager;
- absent `tasks` and `staff_notifications` relations;
- present `crm_accept_quote(uuid,uuid,integer,uuid,text,text)` and
  `crm_register_quote_with_pdf(uuid,bigint,text)`;
- absent `crm_accept_quote_version(uuid,uuid)`,
  `crm_create_quote(uuid,text,text,text,numeric,numeric,date,text,uuid,text)`, and
  `crm_link_legacy_quote_document(uuid,uuid,text)`.

#### Scenario: Local reset and catalog pass
- GIVEN the exact migration copy and pinned temporary CLI
- WHEN start, reset, ledger, and fixed catalog query complete
- THEN every listed local fact matches exactly

### Requirement: Temporary generated types

Generated TypeScript MUST exist only under the disposable root. It MUST prove
`roles.Row.name: string` and the absence of `tasks` and `staff_notifications`. Only its
hash, byte/line counts, and those three results MAY enter `baseline-report.md`; the full
file MUST be deleted. Package manifests, lockfiles, and tracked generated types MUST remain
unchanged.

#### Scenario: Type proof is temporary
- GIVEN local generation succeeds
- WHEN shape checks finish
- THEN only nonsecret summary facts remain and no tracked install occurs

### Requirement: Collision-free ownership and exact cleanup

Before start, the apply run MUST try at most eight independently generated `atg0-[0-9a-f]{8}`
IDs. A candidate is usable only when full Docker listing/inspection finds zero container,
volume, or network with its exact project label or a Supabase resource name for that ID, and
its proposed Supabase project directory is absent. Exhaustion is `BLOCKED`.
Stop or removal MUST occur only after the project owner marker and every candidate selected
by exact label or name have been observed and inspected with the exact selected project ID;
an ownership mismatch blocks cleanup of that candidate. PASS requires zero scoped resources
and an absent temporary root. No prune, image removal, or broad Docker removal is allowed.

### Requirement: Byte/mode/path preservation

Before any local action, a null-safe manifest MUST record relative path, object type, mode,
byte length, and SHA-256 of bytes for every pre-existing tracked/untracked worktree entry and
every dirty path, including absent dirty paths. It MUST explicitly prove coverage of
`package.json`, `package-lock.json`, every active-packet file, every `db/migrations/*.sql`,
the Git index, `next-env.d.ts`, `lib/supabase/database.types.ts`, and
`docs/about/helps/intakes/image.png`. Symlink bytes mean link-target bytes.

After the run, complete manifests MUST compare exactly by path/type/mode/length/hash. The
only allowed path delta is planned creation of `baseline-report.md` and planned byte changes
to regular, mode-preserved `apply-progress.md` and `tasks.md`; all other additions, removals,
or changes are `BLOCKED`. Every pre-existing Docker image ID MUST remain, with additions
allowed. Raw status alone is not preservation evidence.

#### Scenario: Cleanup residue or drift
- GIVEN any collision, unowned candidate, scoped resource, temporary artifact, secret, full
  type file, unplanned path delta, or preservation comparison remains or differs
- WHEN the report is finalized
- THEN the factual outcome is `BLOCKED`

### Requirement: Disposable command capture

One disposable command-capture directory MUST contain, for every numbered apply block, the
exact canonical UTF-8 command bytes actually executed, complete stdout bytes, complete
stderr bytes, decimal exit, and SHA-256 for each. Before temporary deletion, the ordered
per-block rows MUST be aggregated and hashed. `baseline-report.md` MUST record every row and
the aggregate hash; only hashes and nonsecret summary facts survive deletion. Secret values,
raw status, command streams, and full generated types MUST NOT be retained.

### Requirement: Concise factual reporting

`baseline-report.md` MUST be at most 177 physical lines and record UTC identity, every
command/query/result/stream hash and exit or MCP outcome, the command aggregate hash,
required complete-set hashes/facts, cleanup counts, retention checks, and preservation
comparisons. It MUST be prose/tables, not a custom schema or authority object.
It MUST NOT contain `ready`/`authoritative` claims, custom authority receipt/manifest/pointer
semantics, reusable command-record objects, secrets, raw status, or full generated types.

#### Scenario: Apply facts pass
- GIVEN every required observation and cleanup check succeeds
- WHEN the report is written
- THEN it records factual `PASS` while remaining subject to independent verification and
  native review/post-apply authority

### Requirement: Independent authority

Native `sdd-verify` MUST use fresh parent evidence and a separate isolated local project to
rerun every remote, manifest, start/reset, catalog, type, cleanup, retention, and
preservation check. It MUST recompute report and command/query hashes and write the normal
`verify-report.md`. It MUST NOT trust prior runs or apply-run raw output. The apply and
verify executors MUST NOT invoke review lifecycle or Git mutations.

Readiness requires a PASS `baseline-report.md`, PASS `verify-report.md`, and approved native
bounded review receipt/post-apply gate for the same revision. After `sdd-verify`, an external
parent MUST perform that native bounded review/post-apply step; it is required delivery
review scope but outside Harness implementation scope. `verify-report.md` is a separate
native artifact outside the Harness active-report line budget. No custom pointer, receipt,
manifest, validator, or change-local authority file may replace those gates.

#### Scenario: Independently verified readiness
- GIVEN apply and verifier facts independently agree
- WHEN native review and post-apply gate approve the exact revision
- THEN the change may be archived as the baseline consumed by downstream children

#### Scenario: Prior protocol artifact is cited as authority
- GIVEN any old report, receipt, manifest, pointer preimage, validator, command record,
  custom schema, or raw output
- WHEN readiness is evaluated
- THEN it is non-authoritative provenance and cannot satisfy any current gate

### Requirement: Child and mutation boundaries

Tasks and Notifications MAY cite only the archived independently verified baseline facts.
Each child MUST specify and execute its own migration/schema verification in its own design
and tasks. This change MUST NOT allocate migrations, add product schema, modify packages or
code, install tracked types, or mutate remote state. Apply/verify executors MUST NOT perform
Git or review lifecycle actions; the required external-parent review/post-apply action is
not implementation.

#### Scenario: Child begins from baseline
- GIVEN the Harness baseline is verified, natively approved, and archived
- WHEN a child is planned
- THEN the child recaptures and verifies its own candidate without reusing Harness tooling
  or receipts
