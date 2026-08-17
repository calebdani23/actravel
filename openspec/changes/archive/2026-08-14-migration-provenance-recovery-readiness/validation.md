# Bounded Validation and RED Evidence

All checks are repository-local and read-only. No database, provider, migration, backup, restore, or remote command was run.

## Work Unit Evidence

| Evidence | Exact result |
|---|---|
| Focused check | Validation batch `2026-08-11T23:22:39Z`: `python3` read-only packet contract/table/whitespace check → exit `0` (`PASS`; evidence rows `10`, discrepancy rows `10`, comparison rows `6`, changed-path rows `14`, recovery rows `6`, one `BLOCKED` gate, completed tasks `12`); tracked `git diff --check` → exit `0`; protected-path/status query → exit `0` with no output. Ancestor check → exit `0`; raw delta SHA-256 `822fd46c30c8ba16b88120c71c02976514ab17db8431e0607faa56ba344d4a63`; protected-path filtered delta empty. Inventory count `59`; manifest SHA-256 `3dbd5b3fff96080f1f6e76840797860359e9f2b45b2ce8639db76ad59d56f9aa`; generated-type SHA-256 `3ed53c0da5eb7baf54463e62a756ab040a8a39a4d6b7d3e7e1352fb432f93436`; archived ledger SHA-256 `9c02e58c5419941d084f5526b576756dd8400ae5b079b5be0b6db152a0bcd162`; archived rehearsal SHA-256 `b89cbc5fecfb95ecbcdfd6b3f5c2558b48be91ee627685554df281a71b24387b`. |
| Native verification availability | `command -v openspec` → exit `1` with no output. No local OpenSpec CLI check is claimed; native `sdd-verify` remains the next lifecycle operation. |
| Runtime harness | `N/A — repository-only evidence packet; no runtime boundary exists and no approved target was available.` |
| Rollback boundary | Remove/supersede the packet Markdown and `apply-progress.md`; protected migrations, generated types, living spec, archived evidence, and app remain untouched. |

## RED / fail-closed cases

| Case | Expected fail-closed rule | Recorded result |
|---|---|---|
| Missing remote ledger | no inference from local/schema bytes | `MPRR-E-006` unavailable; final gate BLOCKED |
| Unsafe or unauthorized target | do not inspect | `MPRR-E-007` unavailable; no target contacted |
| Missing backup/restore/cleanup/sign-off | never call recovery ready | `MPRR-E-008` unavailable; final gate BLOCKED |
| Duplicate discrepancy classification | reject non-exclusive register | register has exactly 10 named rows and one state per row |
| Incomplete documentation/executable pair | record missing/divergent result | `MPRR-C-001`–`006` all have both fields and a limitation |
| Premature living-spec edit | preserve `openspec/specs/.../spec.md` | living spec untouched; design points to actual change-local path |
| Prohibited mutation request | reject DDL/DML, repair, allocation, regeneration, remote mutation | prohibited list recorded; no such command executed |

The focused command does not claim remote or recovery proof. Full application lint/build/quote checks are intentionally not repeated: they cannot change this packet's external blockers and are not a recovery harness.

## Delta validation

The change-local delta is the existing `specs/baseline-reconciliation/spec.md` referenced by `design.md`; packet outputs cover its identity, separated evidence, comparison, exclusive states, role boundaries, recovery fail-closed rule, protected-type boundary, and sole final gate. The living `openspec/specs/baseline-reconciliation/spec.md` is unchanged. No duplicate `baseline-reconciliation-delta.md` was created.
