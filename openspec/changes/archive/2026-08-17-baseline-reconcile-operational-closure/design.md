# Design: Baseline Reconciliation Operational Closure

## Technical Approach

Create an append-only packet with separate repository, provider, and operator evidence. Provider collection is hard-pinned to ref `bdyhakpmxegoipbmbtjb`: first observe and record the active ref and URL, compare both to the expected ref/URL (`https://bdyhakpmxegoipbmbtjb.supabase.co`), and fail closed before any ledger, catalog, or type collection if either differs.

## Architecture Decisions

| Decision | Choice | Alternatives rejected | Rationale |
|---|---|---|---|
| Evidence | Immutable IDs, UTC times, SHA-256, separated planes, role-based review. | Narrative or inferred provenance. | Makes facts reproducible without treating schema or archives as migration proof. |
| Types | Generate to ignored temporary storage, normalize/hash/diff against `lib/supabase/database.types.ts`; never run the redirecting `db:types` script. | Tracked regeneration. | Detects drift without mutation. |
| Rehearsal | `requested → unavailable|failed|verified`, with distinct preflight, target, execution, restore/invariants, cleanup, sign-off, and outcome fields. | One aggregate status. | Missing preflight inputs is `unavailable`; any post-start failure is `failed`; `verified` requires cleanup and independent sign-off. |

## Data Flow

`identity/preflight → protected snapshot → local/dependency manifests → target guard → read-only provider evidence → type diff → findings → rehearsal → final gate`.

Every finding, gate, and final decision has `review_status`, `reviewer_role`, `reviewed_at`, and `evidence_refs`; required unreviewed items deterministically yield `BLOCKED`. Findings cover `0051`, `drop_public_rate_limits_write_policy`, `0020`, `0044–0049`, and `0057/0060`, each exactly one exclusive disposition.

## Dependency Evidence

Create `packet/dependency-evidence.md` as inventory only. Record root `package.json` identity (`actravel@0.1.0`), lockfile identity (`actravel@0.1.0`, lockfile v3), SHA-256 hashes observed for this baseline (`package.json`: `1a07eba3d75a55111bd06f279182427bd61895deb955bd6be7aaad96dc77e0d6`; `package-lock.json`: `3b175f0c194a4b8d9e8f0f6328ab15e3b305937ff3bcdee8d6ca67639ebb512f`), Node `v22.22.3`, npm `10.9.8`, and the resolved commands for `lint`, `build`, and `test:quote-notifications`. Record that `latest` ranges are not independently reproducible without the committed lockfile and that no install, update, or dependency change is allowed.

## Protected Paths and Cleanup Contract

The explicit inventory is `db/migrations/**`, `lib/supabase/database.types.ts`, `package.json`, `package-lock.json`, `docs/DECISIONS.md`, `docs/PROGRESS.md`, `docs/implementation/ACTIVE.md`, and `docs/about/helps/intakes/image.png`. Snapshot exact tracked path, mode, index/worktree state, and SHA-256 using `git ls-files -s` plus `git status --porcelain=v2`; compare the identical inventory before and after each command. Prefer an isolated worktree/process. Otherwise capture exact preimages and modes, restore only files that were clean before and changed solely by the command; if a pre-existing change intersects generated output, stop and report rather than overwrite it.

## File Changes

| File | Action | Description |
|---|---|---|
| `packet/*.md` | Later create | Identity, evidence, dependency, type diff, findings, rehearsal, validation, and final gate. |
| `docs/DECISIONS.md`, `docs/PROGRESS.md`, `docs/implementation/ACTIVE.md` | Later modify | Verified facts only; retain Week 01 blocked. |
| `db/migrations/**`, `lib/supabase/database.types.ts` | Read only | Inventory and comparison inputs. |

## Interfaces / Contracts

Record fields: `id`, `plane`, `subject`, `source`, `locator`, `captured_at_utc`, `content_sha256`, `status`, `limitations`, `collector`, `authorizer`, plus the four review fields above. Rehearsal additionally records preflight approval, authorized target, execution started, backup/restore/invariants, cleanup verification, independent sign-off, and terminal outcome.

## Testing Strategy

Run only the existing safe scripts with `E2E_DISABLE_EXTERNAL_BOUNDARIES=1`; record no external traffic or mutation. RED tests cover target mismatch before provider calls, missing review, duplicate dispositions, type overwrite, protected preimage collision, invalid rehearsal transitions, prohibited mutation, and invalid final gates.

## Threat Matrix

| Boundary | Status | Safe/failure behavior and RED test |
|---|---|---|
| Documentation-like paths | Applicable | Classify only explicit protected paths; reject executable/ambiguous classification. Test README/MDX and `image.png`. |
| Git repository selection | Applicable | Use verified repo root; reject relative/foreign `-C`. Test absolute and relative selectors. |
| Commit state | Applicable | Preserve staged/dirty/index semantics; stop on collision. Test staged, dirty, and clean states. |
| Push state | N/A | No push or refspec exists in scope. |
| PR commands | N/A | No PR automation exists in scope. |

## Migration / Rollout

No DDL/DML, repair, `0061+`, type overwrite, application change, or database contact beyond the explicitly guarded read-only provider evidence. Fail closed on secrets, authorization, provenance, audit, rollback, or invariant gaps.

## Open Questions

- [ ] Which owner/authorizer and independent recovery reviewer are assigned?
- [ ] What disposable target and backup/cleanup proof are approved?
