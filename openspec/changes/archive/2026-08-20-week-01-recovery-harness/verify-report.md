```yaml
schema: gentle-ai.verify-result/v1
evidence_revision: sha256:5c2df5b7dee3e2d72b4b75d222beba16a95a4a280a951286e22ba48d49be8d76
verdict: pass_with_warnings
blockers: 0
critical_findings: 0
requirements: 23/23
scenarios: 35/35
test_command: node --test tests/recovery-harness.test.mjs
test_exit_code: 0
test_output_hash: sha256:9a4bdaf959e0646cb732ed386922e62668efa4fa2fe2ab730890827d06eb734e
build_command: npm run lint
build_exit_code: 0
build_output_hash: sha256:27d2a3a01cf47711571e5517e9f3873f661da7f93befc61bb867f649be9b1aaf
```

## Verification Report

**Change**: `week-01-recovery-harness`
**Mode**: Standard (Strict TDD evidence present in apply-progress; no strict runner required)
**Scope**: Utility/guard core conformance only; this is not recovery readiness or Week 01 closure.

### Completeness
| Metric | Result |
|---|---:|
| Requirements | 23/23 |
| Scenarios | 35/35 |
| Tasks | 12/12 complete; 0 incomplete |
| Coverage | Not instrumented; behavioral coverage evidenced by the 17-test suite |

### Commands and runtime evidence
| Command | Exit | Result / output SHA-256 |
|---|---:|---|
| `node --test tests/recovery-harness.test.mjs` | 0 | 17 passed, 0 failed, 0 skipped; `9a4bdaf959e0646cb732ed386922e62668efa4fa2fe2ab730890827d06eb734e` |
| `npm run test:recovery-harness` | 0 | 17 passed, 0 failed, 0 skipped; `b4ddc5ceaff07b3db8f313f2bec0e57f415502e40282c3e9cabd97613f487f4b` |
| `npm run lint` | 0 | clean; `27d2a3a01cf47711571e5517e9f3873f661da7f93befc61bb867f649be9b1aaf` |

### Requirements/scenarios compliance
| Requirement group | Scenarios | Result |
|---|---:|---|
| Module surface, closed errors, config/TOML/parser/artifact | 7 | ✅ COMPLIANT |
| Canonical JSON and SHA-256 | 4 | ✅ COMPLIANT |
| Shared detectors, sanitizers, scanner | 9 | ✅ COMPLIANT |
| Runtime, URL, flag, path, worktree guards | 8 | ✅ COMPLIANT |
| Micro-slice boundary/core-only interpretation | 1 | ✅ COMPLIANT |
| External-system-free boundary and deterministic branch inventory | 2 | ✅ COMPLIANT |
| Stacked boundaries, package script, readiness delta | 4 | ✅ COMPLIANT |
| **Total** | **35** | **✅ 35/35** |

Runtime and source evidence covers exact 15 exports; frozen `REQUIRED_PORTS`; byte-exact TOML and `ConfigArtifact`; canonical/SHA domains; contextual redaction precedence; URL/PEM/JWT/key grammars; placeholders, findings, UTF-8 bounds; all guards, safe errors, immutability, traps, and adversarial branches.

### Correctness and design coherence
| Area | Result | Evidence |
|---|---|---|
| Implementation correctness | ✅ | Node built-ins only; pure deterministic APIs; no input mutation or external I/O. |
| Design decisions | ✅ | Hand-written TOML, crypto/UTF-8 primitives, reflection limits, post-scan, raw-authority URL and exact worktree policies match design. |
| Scope boundary | ✅ | No process/fs/network/Docker/Supabase/Postgres/provider/lifecycle/SQL/runner/integration capability in the library or tests. |
| Package boundary | ✅ | Only exact `test:recovery-harness` script; package-lock/dependencies unchanged. |

### Stacked commits, review, and dirty-state preservation
- Code A `0f116d1` is the two-file core boundary; Code B `868e41a` is its direct child and changes only the two implementation/test files plus `package.json`. Both allowlists and caps are satisfied; Code A incremental diff is 596 changed lines and Code B is 217 changed lines.
- Apply-progress records focused/TDD RED-GREEN evidence, bounded remediation, native review/verification checks, exact package/image proofs, and the final 15-export boundary. `0f116d1` and `868e41a` are a valid stacked lineage.
- Existing dirty image `docs/about/helps/intakes/image.png` and unrelated dirty paths remain preserved; image SHA remains `1a0322e51ed8acc21f3e152907cc0fa65b26137bd5449e0aa058ad67561d9715`.

### Issues
**CRITICAL**: None.
**WARNING**: Recovery runner, process/receipt/invariant/cleanup/manifest/SQL/integration lifecycle, and external-system/provider evidence are intentionally deferred; therefore this PASS does not establish recovery readiness or close Week 01.
**SUGGESTION**: Run the follow-up runner/SQL/integration slice under its own change and verification contract.

### Verdict
**PASS WITH WARNINGS** — all 23 requirements, 35 scenarios, and 12 tasks pass for the utility/guard micro-slice; only explicitly deferred recovery work remains.

**Archive readiness**: Ready for this change's utility/guard verification artifact; not evidence of Week 01 closure.
