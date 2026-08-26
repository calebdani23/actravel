# Gate 0 Harness Provenance

## Current Decision

The reusable custom Harness and its later self-authorizing evidence protocol are both
invalidated. The active change is now a concise factual Gate 0 baseline. Its authority is
`baseline-report.md` plus an independent native `sdd-verify` report plus the native bounded
review receipt/post-apply gate. No pointer, custom receipt/manifest, command-record engine,
or reusable child engine is active.

## External Provenance Location

Bulky provenance is stored outside the review candidate at
`tmp/audit-evidence/week02-closure-provenance/`, preserving each original
repository-relative path. The complete LF-only manifest is `manifest.tsv`; its aggregate
SHA-256 is `764a1cb3827368f0f5a1b38f681accee29bfbe9b2def3f592caf6acccda2604e`.
The tracked summary is `../provenance-manifest.json`.

## Design History

| Original repository-relative path below the external root | Disposition |
|---|---|
| `openspec/changes/week-02-gate0-shadow-harness/history/custom-harness-design.blocked.md` | First rejected reusable implementation design; provenance only |
| `openspec/changes/week-02-gate0-shadow-harness/history/evidence-protocol-design.invalidated.md` | Failed self-authorizing one-off protocol moved from active `design.md`; provenance only |
| `openspec/changes/week-02-gate0-shadow-harness/history/gate0-contracts.schema.invalidated.json` | Legacy custom protocol schema moved from active `schemas/`; provenance only |

Historical files may contain exact commands, schemas, pointers, authority claims, or future
instructions. None are active instructions and none may satisfy a current Gate 0 task.

## Incident and Evidence Preservation

The tracked incident records remain at their existing paths:

- `../incident-report.md` and `../invalidated-authority.json`;
- `../incident-report-2.md` and `../invalidated-authority-2.json`.

The external root contains the original-path copies of `../evidence/**`, including
BLOCKED, diagnostic, and invalidated PASS attempts, plus the three design/schema history
files listed above. Historical report/receipt/manifest, command-record, validation, and
deleted-pointer preimage evidence is bound by the aggregate hash above.

These artifacts are non-authoritative provenance. They are preserved to retain incident
facts and hash lineage, not for protocol, tooling, receipt, or pointer reuse. Both false
live `gate0-approved.json` pointers are absent.

## Downstream Rule

Only after the active Harness change has a factual PASS report, independent `sdd-verify`
PASS, native review/post-apply approval, and archive may Tasks or Notifications cite its
baseline facts. Each child must still own fresh migration/schema verification in its own
design and tasks.
