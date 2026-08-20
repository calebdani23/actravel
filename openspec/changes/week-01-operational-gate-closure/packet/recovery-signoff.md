# Independent Local Prepared-Target Recovery Verification - Slice 1

- Verifier: OpenCode independent verifier (`openai/gpt-5.6-sol`), distinct from the retained apply operator and authorizer.
- Verified UTC: `2026-08-20T18:58:56Z`.
- Parent token: `sha256:958fbc84e23027035d301751a8729729a63e40b847ef229ca09d992ea67746b6`.
- Combined recovery manifest: `recovery-evidence-manifest.md` SHA-256 `6b88c8f1433068f2b0f5b9db2f7ffa8e08b2642172ea284ac398f16a80d369a0`.
- Scope: retained local A/B evidence plus a supplemental restore of the exact retained backup; no Docker/provider execution by this verifier.

## Verdict

The combined evidence is sufficient for the narrow claim **LOCAL PREPARED-TARGET PUBLIC-BACKUP RECOVERY SIGNED OFF**.

This means the exact retained `public` backup restores successfully in the pinned local image, and the earlier migration-prepared disposable A/B run has byte-equal retained migration/schema/application invariants and roles/ownership/table grants. It does not mean the public-only dump can reconstruct a bare cluster or that local state is production-equivalent.

## Exact Lineage

- Retained run `slice1-recovery-final-20260819T054840Z-201582` binds backup SHA-256 `1f22b97a6703ac5d757faeacd847ab13b87710307ffcc7bd1d3d550dcab512d1` in manifest-input SHA-256 `61bb2627c9a8b90ee0389a9a83a8b34f7f54c7e37a405c8081d585b8fca24bec` and original immutable manifest SHA-256 `386ff2643096e04f36ec68c60d152fe7bfc5de27f113a4683a7e9b773c0a32f8`.
- The retained backup file independently recomputes to that exact SHA-256 and is `486607` bytes.
- Retained A/B invariant files independently recompute to `4e5f5ef8cde5cfba07297675899b657eccd2d820ade941600a2688a8ba5359f6`, are `2248` lines each, and are byte-equal.
- Those files contain the same ordered `59` migration rows; their migration-only SHA-256 is `28dfd2a0d16756db4d13826b7cc306ec2424b341107e00c44ce93f5e4f747f61`. This retained A/B evidence, not the supplemental bare-image restore, supplies exact migration-history equality.
- Retained A/B roles/ownership/table-grants files independently recompute to `d4a4077081c39afc9f84d76516ede07d0f7a3e0e0755062afcbd83d631b6f6fb`, are `1100` lines each, and are byte-equal.
- Historical signoff SHA-256 `97e8e47d404c5902d06e1636f41a22848f2905491d20d8354ee965310acb47ce` was explicitly recorded as `SIGNED_OFF` for retained manifest `386ff264...` and run `...201582`. Its body was later overwritten by a different-run audit, so this verdict uses the recomputed retained evidence as current authority rather than treating that hash reference as fresh provenance.
- Supplemental run `20260820T184600Z-55509` uses the same backup SHA-256 `1f22b97a...12d1` and exact retained inputs `grants.sql` SHA-256 `955c666a41888eba40eb09e9769eddc3e7da6ecd366239b4c2ac962b924e35c9` and `invariants.sql` SHA-256 `c1e3f760eb0462a3c8168f39a84f459d87e75ae4c0c68a685f26bdac0959de68`.
- Supplemental root/leaves-manifest SHA-256 `0880aaf5496e43bf6d609fd5aa8ac17fd5493b621521bff43584752fd891c480` verifies all `128` leaves with no unlisted non-manifest payload file; the leaves file's implicit self-exclusion is not listed in the JSON exclusion array.
- The supplemental bundle's internal token is `sha256:3555002c1ce0381b47041383a3e49020f0604e574e2cc818909a0a77f2c14560`, not this parent token. The only cross-run merge is through the exact backup and retained-input hashes above.
- The later sequential-port attempt uses backup `61e6c144659ebba4540d790c992caf967b74d0a43c49b4b33489536536c59992`; its `WITHHELD` result remains separate and contributes no evidence to this verdict.

## Supplemental Findings

- Restore receipt SHA-256 `cb46c00a5b8606482e64c75e661f6b2196930be656144f62f7f3c57e7b0b1c52` records exit `0` with fail-on-error, single-transaction, no-owner, and no-privileges flags against the exact pinned image.
- All 17 category captures have verified hashes, line counts, and zero command exits. Public tables, columns, RLS state, row counts, and all `859` retained public table grants exactly match retained A after deterministic format projection.
- The remaining category outputs are valid supplemental captures only, not asserted A/B equality. In particular, the bare-image restore has six extensions and lacks retained A's `pg_net` extension.
- Migration-history category SHA-256 `19630d541604dc93882130347eb0e474f5f0668fb07ba28c439ce5cffea0a6ec` records `absent_from_retained_public_only_dump`. The exact retained invariant replay therefore exits `3`; the supplemental report and its predecessor correctly remain `FAIL` and are not relabeled.
- Grant replay receipt SHA-256 `8d7dee15897ebfe930dea867889145b0890fa9e73a346fd9a7f13b959884d69f` records exit `0` for the exact retained table-grant input. No separate role-definition, schema, routine, sequence, or default-ACL replay input exists.
- Secret-scan receipt SHA-256 `7af7dd7a06d13bc67e5f872ba7bd6a5309845d295f16aadb3ed303bb64d8bf24` reports zero findings; independent credential URL, JWT, secret-key, and private-key pattern checks also found none.
- Cleanup receipt SHA-256 `9e1e1126b0a453edc69c14d3c2510d4a74f090eb7aa1e39119a546649979b0da` is internally consistent with exact-owned resource removals, post-removal absence receipts, unchanged unrelated inventories, absent temp/scripts, and no current listener on port `55509`.

## Limitations

- Local-only, pinned-image, migration-prepared compatible-target scope.
- The retained A/B run is historical evidence; this verification creates no fresh A provenance.
- The backup is `public`-only and its retained application tables contain zero rows. It does not include `supabase_migrations`, all base-image extensions, role definitions, or complete non-table privilege replay.
- No production/provider endpoint was contacted. No production recovery readiness, production equivalence, remote migration provenance, Week 01 closure, Week 02 advancement, or `0061+` safety claim is made.
- Task 2.5 is satisfied only under this exact narrow label. Phase 3/4 and the overall Week 01 gate remain separate.

SIGNED_OFF
