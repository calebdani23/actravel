# Validation and Fail-Closed Evidence

Captured `2026-08-17T21:05:21Z` UTC. Correction RED harness is deterministic, temporary, ignored runtime storage only.

| Guard case | Exact command / case | Exit | Result reference |
|---|---|---:|---|
| README/MDX/image rejection | `python3 tmp/audit-evidence/correction-red-harness.py`; `documentation_rejection` | 0 | `true`; harness SHA `218762257b6d606d080be4a57321eebd486a2c6c04405b5ad86331a440fe0f1c` |
| Absolute repo vs relative/foreign `-C` | same; `absolute_repo_selection` | 0 | `true` |
| clean/staged/dirty semantics | same; `clean_staged_dirty_semantics` | 0 | `true` |
| protected preimage collision refusal | same; `protected_preimage_collision` | 0 | `true` |
| missing review | same; `missing_review` | 0 | `true` (review remains unreviewed) |
| duplicate dispositions | same; `duplicate_dispositions` | 0 | `true` (duplicate rejected) |
| invalid rehearsal transition | same; `invalid_rehearsal_transition` | 0 | `true` (transition rejected) |
| prohibited mutation request | same; `prohibited_mutation` | 0 | `true` (DDL/type overwrite rejected) |
| invalid final gate | same; `invalid_final_gate` | 0 | `true` (CLOSED rejected) |

Harness stdout result SHA-256: `7ec2b64d7bf3992d22e3edd2d20d2fe84d3577206a263cd5faa349242c0ed7cf`; result file SHA-256 `60fbf0e04f25973a17ec18485587b0f5115818ad43a9b8baac6149ea62fa12c5`. Runtime harness is evidence-only; no production/provider mutation boundary exists for this work unit.

## Work Unit Evidence

| Evidence | Required result |
|---|---|
| Focused test command and exact result | `python3 tmp/audit-evidence/correction-red-harness.py` → exit `0`; 9/9 cases true; result SHA above. `git diff --check` → exit `0`. |
| Runtime harness command/scenario and exact result | Same deterministic harness; runtime boundary is N/A because correction only changes packet markdown and ignored evidence. |
| Rollback boundary | Revert only this change directory's packet evidence and `apply-progress.md`; do not revert durable docs, migrations, tracked types, or image. |

Safe baseline commands were not rerun because correction changed only evidence; prior exits remain lint/build/quote tests `0` in apply-progress. No external traffic or database mutation occurred.
