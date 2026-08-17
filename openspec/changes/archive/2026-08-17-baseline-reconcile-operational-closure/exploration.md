## Exploration: baseline-reconcile-operational-closure

### Current State

The repository is at `main@7b0aeca160f1f6ed857374bc8982f57dca100241` with one unrelated pre-existing worktree modification, `docs/about/helps/intakes/image.png`. The executable migration chain contains 59 numbered SQL files from `0001` through `0060`; `0051` is absent and `0052` follows `0050`. The local quote chain contains `0053`–`0060`, including `0057`.

The two committed packets remain fail-closed. Their authoritative remote ledger, environment role/separation, authorization, and recovery evidence were unavailable, and tracked generated types were intentionally not regenerated. The current living specification is stricter: no repair, migration allocation, generated-type overwrite, application change, or database mutation is permitted in this change.

Fresh read-only Supabase MCP inspection is possible and was performed against project ref `bdyhakpmxegoipbmbtjb` (`https://bdyhakpmxegoipbmbtjb.supabase.co`). The migration list currently proves remote entries for `0051`, `drop_public_rate_limits_write_policy`, `0044`–`0049`, `0053`–`0056`, `0058`–`0060`, and no `0057` entry. It does not prove that the linked project is production, staging, or disposable, nor does it supply operator authorization or recovery proof. The branch listing returned an empty list; this is not proof that no separately managed staging target exists.

Read-only catalog checks show the expected catalog media columns, quote/registration-intent columns, and selected CRM/quote policies exist. These final-state observations corroborate live behavior only; they cannot establish migration provenance for `0020` or the placeholder-looking `0044`–`0049` history rows. The fresh type-generation capability also works through MCP, but its output must be captured to an ignored temporary file and compared to `lib/supabase/database.types.ts`; the tracked file must remain untouched.

The local toolchain has Docker `29.4.1`, but no `supabase` executable is available on PATH and no `supabase/config.toml` exists. Docker alone does not provide an approved, repository-supported Supabase recovery target. Therefore local backup/restore rehearsal is currently unavailable, not failed or verified. The available baseline commands passed in this exploration: `npm run lint`, `npm run build`, and `npm run test:quote-notifications` (15/15). The build temporarily rewrote `next-env.d.ts`; that generated change was restored, leaving the unrelated image modification preserved.

### Affected Areas

- `docs/implementation/ACTIVE.md` — current Week 01 gate and prohibition on `0061+`; it must remain blocked until evidence is complete.
- `docs/implementation/weeks/week-01-baseline-safety.md` — defines the required reconciliation, recovery, type, validation, and completion gates.
- `openspec/specs/baseline-reconciliation/spec.md` — requires exclusive discrepancy labels, role-based authority, separated evidence planes, and a single bounded final gate.
- `openspec/changes/archive/2026-08-11-migration-history-remediation/` — historical local/remote discrepancy evidence and the original blocked gate.
- `openspec/changes/archive/2026-08-14-migration-provenance-recovery-readiness/` — latest blocked provenance, target, authorization, recovery, and type-preservation findings.
- `db/migrations/` — local inventory and byte/checksum source; do not apply, repair, renumber, or create migrations.
- `lib/supabase/database.types.ts` — tracked generated baseline; compare only, never overwrite in this change.
- `package.json`, `package-lock.json`, and `tests/` — reproducible dependency and validation baseline.
- `supabase/.temp/linked-project.json` — sanitized linked project identity only; it does not establish environment role.
- `docs/about/helps/intakes/image.png` — unrelated unstaged path that must remain untouched.

### Evidence Still Missing

| Finding | Current safe classification | Evidence still required | Why it blocks |
|---|---|---|---|
| Remote `0051` | `ambiguous/manual-review` | Current ledger statement/metadata, authoritative provenance or approved provider record, owner and authorization | Local bytes do not exist; do not synthesize or replay it. |
| `drop_public_rate_limits_write_policy` | `remote-only/untracked` or `ambiguous/manual-review` pending statement provenance | Current statement/metadata and approved explanation of why no local file represents it | Final policy state is not migration provenance. |
| Local `0020_catalog_media_columns_fix.sql` | `ambiguous/manual-review` | Authoritative linkage to an applied migration, or explicit provider/operator disposition | Existing columns cannot prove the migration was applied. |
| Remote `0044`–`0049` | `ambiguous/manual-review` | Exact stored statements and authoritative linkage to each substantive local body; archived evidence reported placeholder `select 1;` rows | A named ledger row or final schema cannot prove the local SQL ran. |
| `0057` / `0060` | `ambiguous/manual-review` until current linkage is reviewed | Current ledger confirmation that `0057` is absent plus reviewed evidence that `0060` repeats the required cutover; no retroactive replay | `0060` can explain final behavior but cannot erase the history discrepancy. |
| Environment identity/separation | `ambiguous/manual-review` | Role-confirmed project identity and an explicitly approved disposable non-production target | The linked ref is known, but production/staging status is not. |
| Recovery | `unavailable` | Approved backup identity, disposable restore, object/invariant checks, cleanup proof, and independent operator sign-off | Local lint/build/tests are not backup/restore evidence. |
| Generated types | `drift/alignment deferred` | Deterministic diff between fresh remote types and tracked types, followed later by authorized regeneration only after all gates pass | The required comparison is safe; overwriting tracked output is prohibited now. |

### Read-only Evidence and Boundaries

Available without mutation:

1. Supabase migration listing, project URL/ref, read-only `information_schema`/`pg_catalog` queries, selected policy/function/trigger/RLS inventories, and provider-returned generated types through MCP.
2. Local Git identity/status, migration filenames/order/size/checksums, protected-path hashes, dependency manifest/lockfile inventory, and repository tests/build.
3. A temporary type comparison: save MCP-generated text outside tracked paths, normalize only as needed for deterministic comparison, hash both artifacts, and emit a diff. Do not run `npm run db:types`, because that redirects into the tracked file.

Not available or not sufficient from this environment:

- Supabase CLI migration commands: the CLI is absent, and no local Supabase project configuration exists.
- Production/staging role proof: the linked ref and empty branch result do not establish it.
- Provider backup/restore proof: no approved disposable target, backup identity, cleanup record, or operator sign-off exists.
- Provenance proof from final schema, policy state, generated types, or archived packets: these are corroborating/historical inputs only.
- Any history repair, DDL/DML, `supabase migration repair`, migration push/reset, provider-native repair, `0061+`, type regeneration, or application change.

All local tests that can exercise external boundaries must set `E2E_DISABLE_EXTERNAL_BOUNDARIES=1` (Playwright already sets it in its web server configuration). No Resend, Meta, real Storage upload, or production smoke should run during reconciliation. If E2E is later needed, use the existing safety switch and an explicitly approved non-production database target.

### Approved Disposable Rehearsal Path

No executable rehearsal path is currently approved. Docker is installed, but the repository has no Supabase CLI/configuration and no disposable database target identity. The smallest safe next step is to obtain explicit target/authorization confirmation and provision a disposable local or non-production Supabase target through the native supported toolchain. Only then may an operator run backup/restore checks, verify protected objects and invariants, remove the target, and record cleanup. If target identity, cost, credentials, or cleanup proof is missing, the rehearsal remains `unavailable` and the gate remains blocked.

### Approaches

1. **Evidence-only closure packet (recommended)** — collect fresh read-only remote ledger/catalog evidence, local inventory/status, a non-destructive type diff, and baseline validation; classify every finding and publish the gate without repair.
   - Pros: smallest scope; uses currently available MCP capability; preserves all safety boundaries; produces actionable provider/operator requests.
   - Cons: cannot close Week 01 while environment, authorization, and recovery proof remain external.
   - Effort: Low

2. **Evidence plus approved disposable rehearsal** — first obtain explicit target identity/authorization, then perform a bounded local/non-production backup/restore and cleanup rehearsal alongside the evidence packet.
   - Pros: can resolve the recovery gate and test the actual operational runbook.
   - Cons: requires native tooling/target provisioning, credentials or cost confirmation, independent sign-off, and cleanup proof; still does not resolve migration provenance by itself.
   - Effort: Medium

3. **Provider-native repair or compensating migration** — attempt to make histories appear equal or allocate `0061+`.
   - Pros: none within this change's authorization boundary.
   - Cons: explicitly prohibited, risks production integrity, and would destroy the evidence-first separation.
   - Effort: Prohibited

### Recommendation

Take Approach 1 as the first slice: produce a fresh, append-only evidence packet and deterministic type diff, then keep the sole final gate `BLOCKED` because provider/operator identity, authorization, provenance linkage, and recovery proof are not all proven. The current MCP result narrows the missing work—it does not authorize closure. Do not update tracked types, repair history, create `0061+`, or move `ACTIVE.md` to Week 02.

After explicit native/tool confirmation supplies a disposable target, take Approach 2 as a separate bounded rehearsal slice. Only after that rehearsal and independent review should a later change consider authorized type regeneration or migration allocation.

Durable updates after evidence review should be limited to verified facts: add the final gate and evidence references to `docs/DECISIONS.md`, add only shipped/verified results and blockers to `docs/PROGRESS.md`, and keep `docs/implementation/ACTIVE.md` at Week 01 with the next action pointing to the missing authoritative/operator evidence. Those files are not changed by this exploration.

### Risks

- The linked Supabase project may be production despite the repository not proving that role; any unapproved inspection or mutation would violate the safety gate.
- Remote list rows and final schema can look compatible while local migration provenance remains unprovable, especially for `0020` and `0044`–`0049`.
- Archived evidence is useful for comparison but is stale by definition and cannot satisfy fresh identity, authorization, or recovery requirements.
- Running the normal build can rewrite generated Next metadata (`next-env.d.ts`); restore/check status after validation and preserve unrelated worktree changes.
- A type diff may show drift without proving which migration caused it; do not infer provenance or regenerate tracked output.
- Docker availability may create false confidence: without Supabase CLI/configuration and a verified disposable target, recovery rehearsal is unavailable.

### Ready for Proposal

Yes, for a bounded evidence-only proposal. Proposal readiness does not mean Week 01 or migration allocation is ready: the proposal must fail closed, require explicit target identity and authorization before any further live inspection, preserve a sole final gate of BLOCKED, and keep 0061+ unsafe until authoritative provenance, environment separation, recovery proof, and role-based authorization are proven. It must not repair history, mutate a database, regenerate tracked types, change application behavior, or move ACTIVE.md to Week 02.
