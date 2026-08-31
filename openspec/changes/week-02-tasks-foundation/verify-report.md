```yaml
schema: gentle-ai.verify-result/v1
evidence_revision: sha256:21d0d169320ac4538a07835939d153d883445ce86efdc9ff57c96101c972e042
verdict: pass
blockers: 0
critical_findings: 0
requirements: 7/7
scenarios: 11/11
test_command: node --import tsx --test tests/tasks-foundation-contract.test.ts tests/tasks-rls.test.ts tests/tasks-runtime.test.ts
test_exit_code: 0
test_output_hash: sha256:576f6bb1f61429e0417f886afddd68c9cee15d295bf3de7a56205fdc43944ab0
build_command: npm run build
build_exit_code: 0
build_output_hash: sha256:e5d29b83e3760f0ca6a4e11caeb8184c6d460d00376668f5a0612d4c46a118e6
```

# Independent final verification report

## Verdict

**PASS.** Fresh parent evidence was validated before use: the supplied SHA-256 matched exactly,
the evidence was read-only, complete-set-equal, and unexpired during this run. It records remote
history through `0060`, no remote `0061` or later migration, and no Tasks or Notifications table.

## Completeness and execution evidence

| Area | Result | Evidence |
|---|---|---|
| Parent evidence | PASS | `.opencode-runtime/tasks-verify-parent-evidence.json`; SHA-256 `21d0d169320ac4538a07835939d153d883445ce86efdc9ff57c96101c972e042`; captured 19:44:02Z, expires 21:14:02Z |
| Migration ledger | PASS | Fresh minimal Supabase 2.115.0 shadow applied `0001`–`0062` exactly once; local/remote safety remained separate |
| Schema/catalog/RLS/grants/types | PASS | Full public catalog inspection confirmed Tasks columns, checks, FKs, indexes, trigger, RLS, one scoped SELECT policy, postgres ownership, fixed `search_path=public`, authenticated-only function execution, and exact table privileges; generated `Tasks` table and three function definitions compile |
| Focused tests | PASS | 7/7 |
| TypeScript/lint/build | PASS | `npx tsc --noEmit --pretty false` 0; `npm run lint -- --no-cache` 0; build 0 |
| Next.js restoration | PASS | `next-env.d.ts` restored exactly: `7ad303e40d4fddf44f156129e397511953a71481c5cfd86b1862649aaaf240cc` before and after |
| Cleanup/preservation | PASS | Shadow stopped with `--no-backup`, removed, Docker resources zero; `git diff --check` passed; no remote mutation or unrelated implementation drift |

## Spec compliance matrix

| Requirement | Scenarios | Result |
|---|---:|---|
| Reconcile migration state | 2 | PASS — unsafe/remote allocation denied by evidence; local shadow dependency applied only in disposable DB |
| Persist task data | 2 | PASS — pending create, UTC timestamps/context/key, invalid input no mutation, DELETE denied |
| Replay-safe creation | 2 | PASS — exact replay, concurrent two-session create produced one row, conflict and stale replay returned PT005/PT004 |
| Terminal lifecycle | 2 | PASS — all 16 lifecycle pairs passed, including pending→completed; terminal immutability and DELETE denial passed |
| Identical ownership authorization | 1 | PASS — owner, Admin, Manager, Admin-owned, non-owner, inactive, and unknown matrix passed |
| Actors and history | 1 | PASS — authenticated-human boundary, service-role denial, hard-delete and deactivation historical reads passed |
| Local verification and preservation | 1 | PASS — static/runtime evidence, Notifications exclusion, UTC/idempotency, PT001–PT006, preservation and cleanup passed |

## Runtime details

The container-only harness used the discovered healthy database container `supabase_db_tasks-vj`
and container `psql` only. Temporary assertions were privilege-safe and CRM fixtures set
`is_test_data=true`. The harness verified canonicalization, replay/conflict/concurrency, all
authorization cells, lifecycle pairs, stale context, historical hard deletion/deactivation,
service and DELETE denial, terminal immutability, and Notifications exclusion. No host `psql`
or remote/linked fallback was used.

## Warnings

Date-normalization review warnings, if considered separately, are non-blocking; all concrete
specification scenarios passed at runtime.

---

## Verification history: prior FAIL (stale parent evidence)

The prior attempt `tasks-foundation-independent-verify-20260831i` failed closed before execution
because its required parent evidence had expired. It recorded `requirements: 0/7`, `scenarios: 0/11`,
test/build exit `125`, and preserved no substantive implementation verdict. Its prior evidence
revision was the stale prerequisite; no shadow, tests, build, or runtime mutation was attempted.

## Verification history: prior FAIL (incomplete runtime matrix)

The earlier substantive report, evidence revision
`sha256:63a42d9b53f3d35a6c14522eb4a941461a31ace0ccbbae83918469c6bf667b48`, recorded `requirements:
4/7` and `scenarios: 6/11`. Static tests, TypeScript, lint, build, catalog, grants, and cleanup
passed, but its fresh authenticated harness stopped on `TASK_INVALID_TRANSITION`, so lifecycle,
ownership, and history were not credited. That report remains preserved as historical FAIL
evidence; this run independently corrected the lifecycle fixture and completed the runtime matrix.
