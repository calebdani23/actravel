# RED Guards and Work-unit Evidence

| Guard set | Command/result |
|---|---|
| Complete RED matrix | `packet/red-evidence.md`; 29 formula-verified rows covering identity/ref, privilege/read-only, allowlist/non-SELECT, secret, unexpected path, dirty worktree, image, UTC/hash, altered migration, shared A/B, migration/backup/restore failure, missing role/grant, every invariant category including RLS-enabled-state, cleanup, and `0061+`; all exit 0/PASS |
| Whitespace | `git diff --check`; exit 0 |
| Root pollution | protected hashes/status inspection; no package/config/type/migration/app changes |
| A/B invariant equality | fresh run `slice1-recovery-final-20260819T054840Z-201582`; exit 0; exact A/B SHA `4e5f5ef8cde5cfba07297675899b657eccd2d820ade941600a2688a8ba5359f6` |
| Raw CHECK evidence | complete A/B JSON expressions retained in ignored runtime; JSON hashes `17cab3133732c5ade46c35df31e0257c73f778a3469a032474e0bebc97f670b3` / `7a7bdf160309b0e4efd6814c0ead16f9e498f16ef3361273d9ffb414dceaa854`; raw text hashes `355346a1c90b9aef8283ee2e775403052c0c8a2d1cd7b5d0948cc4e29475498f` / `79d5622f019995533f8a098be8b71882a77c78651b0408df3b2f0b4222a26875`; diff hash `d4dfb4120b8c68d7900aeef9d8f1910b2629818976eaa3a789c6e795fcb2d1f9` |
| Cleanup receipt | fresh recovery receipt SHA `307948ab56b8768b3ac42e3371c153aff9fbc6caac81bf663cea338b087c1894`; no slice containers/volumes/networks and temp root absent |
| Per-case RED evidence | `packet/red-evidence.md`; 29 stable rows with harness SHA, expected/result/exit, global actor/UTC, and evidence ref |
| Provider assertion/evidence | strict-final manifest `7b5e315c55021984d0fdf1dd2f51b758d80648ebdc80fc45c7be8cb2dc555b2e`; provider sign-off `e23b2c7fd39c485f1f0d9135fe7a1bcbaf6e08597902e8b84788b41f54770532`; all 50 rows postgres/on; SIGNED_OFF |
| Cleanup failure guard | retry cleanup receipt passed; matching Docker containers/volumes/networks absent and temp root absent |
| RLS/roles remediation | RLS A/B `3bb4b5263e22a2e0bbe73ca05e96b34d42a0c07178b41f106051ce390f851256`; roles/ownership/grants A/B `d4a4077081c39afc9f84d76516ede07d0f7a3e0e0755062afcbd83d631b6f6fb`; exact equality |
| Recovery remediation | fresh `slice1-recovery-final-20260819T054840Z-201582`; aggregate/RLS/roles A/B equality and cleanup passed; recovery SIGNED_OFF |
| Tool/category proof | image `sha256:21ab9711…`; container `psql` path `/nix/var/nix/profiles/default/bin/psql`, v17.6, SHA `96577e53f4c3558b7f27c5747b533bc7180a4b22a232e8a71af7724257d7efcc`; sanitized inspection exit 0 at `2026-08-19T01:57:45Z`; roles/grants SHA `3ac902c66161e0c34e489f1ea9b2f21287cba2b1a5875d3859a98b45654e2eb7` bound to recovery manifest/signoff and cleanup receipt; raw bytes deleted by contract |
| Supplemental exact-backup restore | root/leaves manifest `0880aaf5496e43bf6d609fd5aa8ac17fd5493b621521bff43584752fd891c480`; 128/128 leaves; restore/table-grant replay `0/0`; 17 category captures and cleanup valid; migration-history absence and missing `pg_net` retained as limitations |
| Current recovery authority | combined manifest `6b88c8f1433068f2b0f5b9db2f7ffa8e08b2642172ea284ac398f16a80d369a0`; signoff `d87c91cc0592780c09230d9ac8b396823a6d676d16b2e35f935eb97ea454faee`; local prepared-target recovery `SIGNED_OFF` |

## Work Unit Evidence

| Evidence | Result |
|---|---|
| Focused test | complete RED guard exit 0; 29/29 assertions; `git diff --check` exit 0 |
| Runtime harness | fresh isolated CLI/Docker A/B rehearsal `slice1-recovery-final-20260819T054840Z-201582`; A/reset/backup/B/reset/restore/invariants completed; exact equality and cleanup passed |
| Rollback boundary | remove only this change packet/tasks/progress; restore no provider state; preserve pre-existing image modification |

Recovery task gate: provider evidence, local prepared-target recovery, and the supplied production recovery evidence are independently retained. The different-backup sequential attempt remains `WITHHELD`. The amendment binds the absent 59-row ledger entry, exact LF-normalized `0060`, live durable category aggregate `45f3a8...b394`, and all required receipts without claiming `0057` executed. Proposed `PASS` remains subject to fresh independent verification; task 4.5 is complete.
