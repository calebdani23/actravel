# Recovery Evidence Manifest - Combined Local Prepared-Target Binding

- Parent change: `week-01-operational-gate-closure`.
- Verification token: `sha256:958fbc84e23027035d301751a8729729a63e40b847ef229ca09d992ea67746b6`.
- Scope: retained successful local A/B evidence plus a later supplemental restore of the exact retained backup; local prepared-target recovery only.
- No production/provider contact, production-equivalence claim, fresh A provenance, or bare-cluster recovery claim is made.

## Retained Successful A/B Identity

- Run: `slice1-recovery-final-20260819T054840Z-201582`; retained root `tmp/audit-evidence/week01-recovery-final/slice1-recovery-final-20260819T054840Z-201582/`.
- Original immutable manifest SHA-256: `386ff2643096e04f36ec68c60d152fe7bfc5de27f113a4683a7e9b773c0a32f8`.
- Backup: retained custom-format `public` dump, `486607` bytes, SHA-256 `1f22b97a6703ac5d757faeacd847ab13b87710307ffcc7bd1d3d550dcab512d1`.
- Manifest input SHA-256: `61bb2627c9a8b90ee0389a9a83a8b34f7f54c7e37a405c8081d585b8fca24bec`; it binds this run, backup, image, CLI, restore/grant exits, and A/B hashes.
- A/B invariant files: SHA-256 `4e5f5ef8cde5cfba07297675899b657eccd2d820ade941600a2688a8ba5359f6` on both sides; `2248` lines each; byte-equal.
- Migration history: the byte-equal A/B invariant files contain the same ordered `59` migration rows; migration-only SHA-256 `28dfd2a0d16756db4d13826b7cc306ec2424b341107e00c44ce93f5e4f747f61`.
- A/B roles/ownership/table-grants files: SHA-256 `d4a4077081c39afc9f84d76516ede07d0f7a3e0e0755062afcbd83d631b6f6fb` on both sides; `1100` lines each; byte-equal.
- Restore/grants exits: `0/0`; RLS-enabled A/B SHA-256 `3bb4b5263e22a2e0bbe73ca05e96b34d42a0c07178b41f106051ce390f851256` on both sides.
- Raw CHECK JSON A/B SHA-256: `17cab3133732c5ade46c35df31e0257c73f778a3469a032474e0bebc97f670b3` / `7a7bdf160309b0e4efd6814c0ead16f9e498f16ef3361273d9ffb414dceaa854`; retained category diff SHA-256 `35eb8e80e3830aa61d32f789d13dade87a096b6a04aced039d2ae57a86463dbd`.
- Cleanup receipt SHA-256: `307948ab56b8768b3ac42e3371c153aff9fbc6caac81bf663cea338b087c1894`; run-owned A/B resources and temp root absent.
- Historical verifier artifact SHA-256 `97e8e47d404c5902d06e1636f41a22848f2905491d20d8354ee965310acb47ce` was recorded as `SIGNED_OFF` for this exact run and manifest. Its body was later replaced by a different-run audit, so it is historical support rather than current authority; the present verifier independently recomputed the retained hashes and equality.

## Supplemental Exact-Backup Identity

- Run: `20260820T184600Z-55509`; retained root `tmp/audit-evidence/week01-recovery-supplement-corrected-continuation-20260820T184600Z-55509/`.
- Bundle-internal token: `sha256:3555002c1ce0381b47041383a3e49020f0604e574e2cc818909a0a77f2c14560`; this differs from the parent verification token and is not used as an identity bridge.
- Predecessor `20260820T184300Z-55507` remains `FAIL`. The continuation report also remains `FAIL` because the exact retained invariant query stops at missing `supabase_migrations`; neither result is relabeled.
- Exact bridge to the retained run: backup SHA-256 `1f22b97a6703ac5d757faeacd847ab13b87710307ffcc7bd1d3d550dcab512d1`, retained `grants.sql` SHA-256 `955c666a41888eba40eb09e9769eddc3e7da6ecd366239b4c2ac962b924e35c9`, and retained `invariants.sql` SHA-256 `c1e3f760eb0462a3c8168f39a84f459d87e75ae4c0c68a685f26bdac0959de68` all recompute from the retained inputs; the backup also recomputes unchanged after restore.
- Bundle root/leaves-manifest SHA-256: `0880aaf5496e43bf6d609fd5aa8ac17fd5493b621521bff43584752fd891c480`; all `128` listed leaves verify and cover every non-manifest payload file. `manifest-leaves.sha256` is necessarily self-excluded but is not named in `manifest.json`'s two-item exclusion array; this manifest-layer omission does not hide a payload file.
- Manifest JSON SHA-256: `43cceb2990d1faeae812d600da52de145ed7fcfe09674c87f8aeb8b3f95d6ebe`; report JSON SHA-256 `7fb32c9431267750e9624eafeb8bde5a72d847fd947f9c1ad128ceb27c1a9e27`.
- Image: `public.ecr.aws/supabase/postgres:17.6.1.106@sha256:21ab971149317ea9cd12a8126fe4ebb34def08c8972956b0958cba0924409dab`.
- Restore: exit `0`, `--exit-on-error --single-transaction --no-owner --no-privileges --verbose`; receipt SHA-256 `cb46c00a5b8606482e64c75e661f6b2196930be656144f62f7f3c57e7b0b1c52`.
- Table-grant replay: exact retained input SHA-256 `955c666a41888eba40eb09e9769eddc3e7da6ecd366239b4c2ac962b924e35c9`, exit `0`, receipt SHA-256 `8d7dee15897ebfe930dea867889145b0890fa9e73a346fd9a7f13b959884d69f`; the restored `859`-row public table-grant subset exactly matches retained A after format projection.

| Supplemental category | Lines | SHA-256 | Authority |
|---|---:|---|---|
| schemas | 12 | `a632e0498d1c947945ad4153965a906b722da214836fe076f9ac46832c012511` | supplemental-only |
| extensions | 6 | `b0fa56d44dc2430fe2d39c431ce09f652dd9fc73f44d6301280a0fd411eab886` | supplemental-only; retained A's `pg_net` is absent |
| tables | 41 | `deb4cd1d35992dfa0609394e6c29ea7730503fabad436b1bc0ebef9d1d946cc1` | public subset exactly matches retained A |
| columns | 621 | `6c8ee9cf46c9478c795c3167366d3d34730c06c530ab6b8ad93b1e8a5ab535ac` | public subset exactly matches retained A |
| row-counts | 35 | `d25928f3ef510b806fc2d79ef95b4745306bf4b5f2cb8ba9ba08bdf8b377ea23` | exactly matches retained A after format projection |
| rls | 41 | `249401768631ddbde54db12faca17e1fa53e0f1a0c453e848bdf2534f7457a5c` | public subset exactly matches retained A |
| policies | 99 | `cd42e0350bb47695aa0522034afc930f7a32e9f8fdb23a570e967921c91695b6` | supplemental-only |
| routines | 80 | `5b144c456cb182b1a7706a9e940ac17e558d6b6e2372d42acf9d525141cfa361` | supplemental-only |
| triggers | 46 | `263aafa7d0bdbb51e991171c1ac39136f639030948428241127c5d048bbe488f` | supplemental-only |
| constraints | 252 | `c399fde204ab3df2c2391b253bee57359e9679893f54100831208b00a2dce8b8` | supplemental-only |
| indexes | 183 | `541d9ceb7690bb03ffb92b2380fb940891ae06c9ca762c9628fce7e4e22cb835` | supplemental-only |
| sequences | 1 | `8e5805afb063b792046d9d29618afde4f61bb837c940d805b17628f1ee9291e7` | supplemental-only |
| roles | 29 | `b51832a8e0f39e34de7c9b79ac2ae80a36943523abb796301b5e8ad469794c1b` | supplemental-only; base-image state |
| grants | 959 | `8893174365d0b5554a92ca479005d8118f4e58bfa0ea00ce6bcb009313f5efc8` | only public table-grant subset is exact-linked |
| object-ownership | 306 | `25188fe904fef79573a4c9c7afa5b9214739d0a92341a8d9763f0a7c3dbec3d5` | supplemental-only |
| check-constraints | 93 | `54a22fbf8388a92eb65f047f20effe97b69b891f978e0c44a94bb83205fad356` | supplemental-only full definitions |
| migration-history | 1 | `19630d541604dc93882130347eb0e474f5f0668fb07ba28c439ce5cffea0a6ec` | records `absent_from_retained_public_only_dump`; not equality |

- Retained invariant replay: exit `3` at `supabase_migrations.schema_migrations`; this is expected evidence of the public-only dump boundary, not a successful supplemental invariant comparison.
- Secret scan: bundle receipt SHA-256 `7af7dd7a06d13bc67e5f872ba7bd6a5309845d295f16aadb3ed303bb64d8bf24`; zero exact generated-credential or generic high-risk findings. Independent pattern checks found no credential URL, JWT, secret key, or private-key payload.
- Cleanup: receipt SHA-256 `9e1e1126b0a453edc69c14d3c2510d4a74f090eb7aa1e39119a546649979b0da`; owned container/network/volume removal exits `0`, exact-resource post-inspections exit `1`, before/after unrelated Docker inventories match, temp root and obsolete scripts are absent, and port `55509` has no current listener. No Docker command was run by this verifier.

## Binding Boundary

- The later sequential-port attempt manifest SHA-256 `5e9befb5185ee04184f641de44e83e3ab9a9a879ee9660e79f285d9cbc1bb146` uses backup `61e6c144659ebba4540d790c992caf967b74d0a43c49b4b33489536536c59992`; its `WITHHELD` audit remains valid for that identity and is not merged into this proof.
- The combined evidence supports only: **the retained public backup can be restored locally into the pinned image, and a migration-prepared compatible local target has exact retained A/B state equality for the captured invariants**.
- It does not support standalone bare-cluster reconstruction, full role/schema/default-ACL replay, production recovery readiness, production equivalence, fresh A provenance, remote migration provenance, or Week 01 closure.
- Current independent authority is `recovery-signoff.md` bound to this manifest. Task 2.5 may be completed only under this narrow label.
