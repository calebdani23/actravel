# Tasks: Week 02 Gate 0 Factual Baseline

## Review Workload Forecast

| Field | Value |
|---|---|
| New active Harness target | At most 800 physical lines; `baseline-report.md` at most 177 |
| Native verify artifact | `verify-report.md` is separate and outside the active-report budget |
| Preserved provenance | Maintainer size exception; untouched and excluded from active authored target |
| Chained PRs | No |
| Product/code scope | None |
| Runtime | Bounded apply, separate native `sdd-verify`, then external-parent review/post-apply |

## Ordered Checklist

- [x] 0.1 Preserve `incident-report.md`, `incident-report-2.md`, both
  `invalidated-authority*.json` files, failed-run evidence, and deleted pointer preimages as
  non-authoritative provenance. Both false live pointers are absent; incident cleanup and
  preservation are evidenced by the two incident reports.
- [x] 0.2 Abandon the self-authorizing protocol. Preserve its design at
  `history/evidence-protocol-design.invalidated.md`; make active proposal/spec/design use
  factual report plus independent native verification and review/post-apply authority.
- [x] 1.1 Parent freshly captures project ref/URL and binds the exact canonical 59-object
  R002 version/name table/hash. Compare the complete table to the complete SQL ledger, then
  verify remote-only `0051`, accepted missing `0057`, no `0061+`, deferred tables, or
  Manager effect. Selected-name checks and prior captures cannot satisfy this task.
- [x] 2.1 Bind the exact sorted 60-row local filename/hash manifest through `0061`; compare
  complete initial/copy/post-run manifests and the complete normalized local ledger; record
  exact `0061` SHA-256
  `979f03da567e32c12e2a5eef1c6b1f093332776719830b09dcb8474c327c81dd`.
- [x] 3.1 Allocate a collision-free short ID in at most eight attempts or BLOCK. Capture a
  complete preimage path/type/mode/byte manifest, run isolated CLI `2.115.0` start/reset and
  fixed checks, and capture B001-B006 command bytes/stdout/stderr/exit/result hashes in one
  disposable directory. Stop/remove only exact inspected ownership; compare complete final
  preservation while allowing only planned report/progress/tasks changes; aggregate/hash,
  delete temp output, and retain no secret/full-type bytes.
- [x] 4.1 Write `baseline-report.md` in at most 177 lines with every remote/block hash and
  exit, aggregate hash, complete-set equalities, required facts, cleanup/preservation, and
  factual PASS/BLOCKED. Do not create a receipt, pointer, validator, or authority claim.
## Post-Task Gates

- Run native `sdd-verify` independently with fresh remote capture and a separate temporary
  local project. Rerun/check every fact and hash, clean its resources, and write separate
  native `verify-report.md`; consume no prior output, mutate no Git state, and do not invoke
  review lifecycle.
- After SDD verify, require the external parent to run native bounded review and post-apply
  for the exact revision. This is mandatory delivery review scope, outside Harness
  implementation/apply/verify executors. Archive only after PASS.

## Current State

All six planning/provenance and factual baseline tasks are complete. Independent verification,
external-parent review/post-apply, and archive remain open. This grants no downstream readiness.
