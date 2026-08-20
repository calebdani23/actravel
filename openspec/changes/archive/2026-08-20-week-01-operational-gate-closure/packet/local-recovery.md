# Local A/B Recovery — Slice 1

Status: **SLICE 1 LOCAL PREPARED-TARGET RECOVERY SIGNED OFF**. Retained A/B equality plus an exact-backup supplemental restore passed under the limitations below; production was not contacted.

| Check | Result |
|---|---|
| CLI | `supabase` v2.101.0 isolated; package integrity and executable hash retained in manifest |
| A/B copies | prepared from byte-identical `db/migrations/**`; manifest verification issued |
| A start/reset | pass; all repository migrations applied fail-on-error from byte-identical `supabase/migrations` copies |
| Images | A/B database image digest `sha256:21ab971149317ea9cd12a8126fe4ebb34def08c8972956b0958cba0924409dab` |
| Final run | `slice1-recovery-final-20260819T054840Z-201582` |
| A invariants | final canonical SHA `4e5f5ef8cde5cfba07297675899b657eccd2d820ade941600a2688a8ba5359f6` |
| Backup | custom-format `public` application-owned dump; final SHA `1f22b97a6703ac5d757faeacd847ab13b87710307ffcc7bd1d3d550dcab512d1`; roles/grants replay exit 0 |
| B start/reset/empty target | pass; distinct project ID and public schema explicitly emptied |
| B restore | `pg_restore` exit 0 with `--exit-on-error --single-transaction --no-owner --no-privileges -U postgres` |
| B invariants | final canonical SHA `4e5f5ef8cde5cfba07297675899b657eccd2d820ade941600a2688a8ba5359f6`; exact equality with A |
| Required categories | aggregate `4e5f5ef8cde5cfba07297675899b657eccd2d820ade941600a2688a8ba5359f6`; RLS-enabled-state `3bb4b5263e22a2e0bbe73ca05e96b34d42a0c07178b41f106051ce390f851256`; roles/ownership/grants `d4a4077081c39afc9f84d76516ede07d0f7a3e0e0755062afcbd83d631b6f6fb` |
| Cleanup | A/B stopped with `--no-backup`; Docker query returned no matching containers, volumes, or networks; temp root absent |
| Supplemental restore | run `20260820T184600Z-55509`; exact retained backup; root/leaves manifest `0880aaf5496e43bf6d609fd5aa8ac17fd5493b621521bff43584752fd891c480`; restore/table-grant replay `0/0`; 17 category captures; cleanup passed |
| Current combined binding | `recovery-evidence-manifest.md` SHA `6b88c8f1433068f2b0f5b9db2f7ffa8e08b2642172ea284ac398f16a80d369a0`; `recovery-signoff.md` SHA `d87c91cc0592780c09230d9ac8b396823a6d676d16b2e35f935eb97ea454faee`; `SIGNED_OFF` |
| Different-backup final attempt | `recovery-evidence-manifest-final-attempt.md` SHA `5e9befb5185ee04184f641de44e83e3ab9a9a879ee9660e79f285d9cbc1bb146`; backup `61e6c144...9992`; its `WITHHELD` audit remains separate |
| Failed remediation rerun | `slice1-recovery-20260819T022136Z-3530161`; failed before A/B target discovery; cleanup `9285f1c68e2ff3aef09508dfa673db8ad837bc4e3d69b56e59139dab75f11341`; no slice resources remain |

Root cause: **harness canonicalization**. `pg_get_constraintdef` emitted redundant-parenthesis differences for exactly two `quote_registration_intents` checks after dump/restore; counts/names matched. Complete raw CHECK JSON hashes are A `17cab3133732c5ade46c35df31e0257c73f778a3469a032474e0bebc97f670b3`, B `7a7bdf160309b0e4efd6814c0ead16f9e498f16ef3361273d9ffb414dceaa854` (secret scan empty); derived raw text hashes are A `355346a1c90b9aef8283ee2e775403052c0c8a2d1cd7b5d0948cc4e29475498f`, B `79d5622f019995533f8a098be8b71882a77c78651b0408df3b2f0b4222a26875`. The deterministic parser strips only outer grouping, recognizes top-level AND/OR outside quotes/function parentheses, and flattens only associative same-operator groups; this is semantics-preserving for the captured CHECK grammar. Normalized SHA A/B `840d1f7156694b487cfa87d66c826940d86355f0b4836f99807d0fb0979a2f27`. Raw category diff SHA `d4dfb4120b8c68d7900aeef9d8f1910b2629818976eaa3a789c6e795fcb2d1f9`; both differences report `normalized_equal=True`. Structural signatures retain raw expression hash plus conkey/confkey/validated/deferrability/action fields. No mismatch was hidden.

The supplemental bundle is not relabeled globally: its exact retained invariant query exits `3` because the public-only dump does not contain `supabase_migrations`, its migration-history category records absence, and retained A's `pg_net` extension is absent. Exact migration-history equality comes from the byte-equal retained A/B files. Broader supplemental categories remain supplemental-only; only public tables, columns, RLS, row counts, and the retained public table-grant subset were independently projected back to exact retained A equality.

Provider signoff remains valid. Current recovery authority is combined manifest `6b88c8f1433068f2b0f5b9db2f7ffa8e08b2642172ea284ac398f16a80d369a0` plus signoff `d87c91cc0592780c09230d9ac8b396823a6d676d16b2e35f935eb97ea454faee`, `SIGNED_OFF`. This is local prepared-target recovery only: no bare-cluster reconstruction, production equivalence/readiness, fresh A provenance, remote migration provenance, Week 01 closure, or `0061+` claim.
