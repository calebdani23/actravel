# Apply Progress: Week 02 Gate 0 Factual Baseline

## Current Status

`FACTUAL_BASELINE_PASS`. The bounded run performed temporary Docker/Supabase local start/reset,
read-only catalog/type checks, exact-label cleanup, and no remote mutation, package/application
change, tracked type generation, Git mutation, review lifecycle, or archive operation.
`baseline-report.md` exists; `verify-report.md` does not yet exist.

## Authority Reset

The self-authorizing evidence protocol is abandoned. The active change no longer treats a
custom schema, report/receipt pair, artifact manifest, command records, pre/post validators,
or `gate0-approved.json` as authority. The invalidated protocol design and legacy schema
are preserved at their original repository-relative paths below
`tmp/audit-evidence/week02-closure-provenance/`, bound by manifest aggregate SHA-256
`764a1cb3827368f0f5a1b38f681accee29bfbe9b2def3f592caf6acccda2604e`. The tracked summary
is `provenance-manifest.json`; no active `schemas/` directory remains.

Current authority requires all of:

1. factual `baseline-report.md` from the bounded apply run;
2. native `sdd-verify` report produced by an independent fresh rerun;
3. external-parent native bounded review receipt/post-apply gate for the exact revision.

Apply and verify executors perform no Git mutation and do not call review lifecycle. The
external-parent review/post-apply step is required after verification, but is outside
Harness implementation scope. No component may authorize itself or use a local pointer.

## Prior Runs

All prior `evidence/**` runs, reports, receipts, manifests, command records, schemas,
validation files, and pointer preimages are stored under the external ignored root above,
using their original repository-relative paths and aggregate hash. They are
non-authoritative provenance and cannot satisfy a current task or readiness gate.

- `20260826T014900Z-20260826-a7c91d2e` remains invalid because its cleanup assertion was
  false and it retained secret-bearing status and full generated types. Its pointer is
  absent. Canonical disposition is `incident-report.md` and `invalidated-authority.json`.
- `20260826T044700Z-2482553-a5499196` remains invalid because the bound PASS report and
  artifact manifest failed their own definitions. Its pointer is absent. Canonical
  disposition is `incident-report-2.md` and `invalidated-authority-2.json`.
- Earlier BLOCKED and diagnostic runs remain historical observations only.

No prior PASS, receipt, validator, pointer preimage, or command record is grandfathered
into the new baseline.

## Planned Apply Output

The sole proposed apply artifact is `baseline-report.md`, capped at 177 physical lines. It
will bind the complete R002 59-object table/hash to the complete SQL ledger; bind complete
initial/copy/final 60-row filename/hash manifests to the complete local ledger; and report
one isolated CLI `2.115.0` run, fixed catalog/type facts, collision/ownership/cleanup, and
complete preservation.

The run first rejects project-ID/resource/project-directory collisions after at most eight
attempts. One disposable command-capture directory holds every numbered block's canonical
command bytes, stdout, stderr, exit, result hashes, and ordered aggregate until temp deletion.
No stop/removal precedes exact observed ownership. Preservation uses path/type/mode/length/
byte hashes for every pre-existing tracked/untracked entry, dirty path, index, packages,
active packet, migrations, next-env, tracked types, and protected image. Only planned
`baseline-report.md`, `apply-progress.md`, and `tasks.md` deltas are allowed. No raw stream,
secret value, full generated type, or temporary root survives a successful run.

## Task State

Planning/provenance tasks 0.1 and 0.2 plus factual baseline tasks 1.1–4.1 are complete.
Run `20260826T062950Z-gate0-factual-run-20260826a` passed with command aggregate
`sha256:ae3210222e7e676315ea5b5c0ff723a4c44420d25a03438736f417cbefbee82f` and parent evidence
revision `c72f61a8207752f18d747a680512c90355797ed1d17c837c73b8eb10eeb47887`. Independent
`sdd-verify`, external-parent review/post-apply, and archive remain open. Tasks/Notifications
stay blocked.

## Scope Preservation

No product schema, migration allocation, package/code change, tracked generated type,
remote mutation, Git mutation, or persistent local database is authorized. Active planning
plus `baseline-report.md` targets at most 800 newly authored physical lines; the native
`verify-report.md` is separate, outside that active-report budget, but remains in delivery
review scope. Externalized failed-run provenance is outside the review candidate; retained
incident reports keep their maintainer size exception.
