# Incident Report: Invalid Gate 0 PASS and Resource Leak

## Status

`INVALIDATED`. Run `20260826T014900Z-20260826-a7c91d2e` is not authority for
delivery. Its approval pointer was removed, no replacement PASS or pointer was
published, and baseline execution did not continue.

## External Provenance Location

Raw run evidence is stored under `tmp/audit-evidence/week02-closure-provenance/`, preserving
its original repository-relative paths. The complete manifest aggregate SHA-256 is
`764a1cb3827368f0f5a1b38f681accee29bfbe9b2def3f592caf6acccda2604e`; see
`provenance-manifest.json`. References below beginning with `evidence/` are historical
change-relative path values whose current external location preserves that suffix below
`openspec/changes/week-02-gate0-shadow-harness/` in the external root. Embedded pointer
preimage path values remain unchanged deliberately.

## Findings

- The PASS run leaked 12 containers, 3 volumes, and 1 network because Docker used
  truncated project label `actravel-gate0-20260826T014900Z-20260826`.
- Diagnostic run `20260826T023000Z-2311731-d6b7c9e1` leaked another 12
  containers, 3 volumes, and 1 network under exact label
  `actravel-gate0-debug-20260826T023000Z-23`.
- The prior scoped-zero cleanup assertion was false for both effective labels.
- Retained `local/status.sanitized.json` contained local secrets. It was deleted;
  only its hash, byte count, redacted key names, and invalidation reason remain.
- Retained `local/generated-types.ts` was 112,953 bytes, 3,693 lines, mode `0664`,
  and SHA-256 `ce03b0519609eb101f5faacb41900dc96fdafc1126786ab00f85ea619461b461`.
  It was deleted and replaced with nonsecret invalidation metadata.
- The report, receipt, manifest, and pointer hashes cannot authorize delivery after
  deliberate secret redaction and generated-artifact deletion. The represented
  artifact set changed, and its cleanup premise was already false.
- The published `1,789`/`1,795` line-budget claim is invalid because the retained
  3,693-line generated type file was part of the packet. Corrective counting must occur
  only after that full file and raw status are deleted.

## Invalidated hashes

| Original artifact path | File SHA-256 | Embedded semantic SHA-256 | Disposition |
|---|---|---|---|
| `gate0-approved.json` | `e791e83920fac34a3b1a4e7dfdba90e4c136835d1eb3ea0399786caab1e15c54` | `c2475e92989e09f11092cb6418d1feebebc6107f56f1a75b5e100d0ce03f9136` | Deleted; never authority |
| `evidence/20260826T014900Z-20260826-a7c91d2e/gate0-report.json` | `4e977195e7ab6d13c0a7811bd91a1398b4fd796c28c73d1cdece91786de1fb97` | `8b27330b717dbb70c85efb7922252ed555abe5604a82f6eac3590fe552786ac8` | Provenance only |
| `evidence/20260826T014900Z-20260826-a7c91d2e/gate0-receipt.json` | `76e8c7d81d16be4732f77ee9649abd479ed4d60f0c741e7520f989946e05b9b6` | `23c9d8fbe836bd35c2bc4b96add7e79081675b73ca1807963245961d78660e0d` | Provenance only |
| `evidence/20260826T014900Z-20260826-a7c91d2e/artifact-manifest.json` | `685c33d94e12e0aa53ce1589b7b193c561f04ff1cd853dd93a83b18ed78e36b0` | `236d268ca95ff448730526f7dfb6079d9918ff1f4df6b438c404880564f014bf` | Provenance only |

## Pointer preimage

The deleted pointer's complete 1,238-byte preimage, mode `0664`, is recorded below.
Its file SHA-256 is
`e791e83920fac34a3b1a4e7dfdba90e4c136835d1eb3ea0399786caab1e15c54`.
It is incident evidence only and must never be treated as authority.

```json
{"approvedAt":"2026-08-26T01:55:00Z","artifactManifest":{"artifactHash":"sha256:685c33d94e12e0aa53ce1589b7b193c561f04ff1cd853dd93a83b18ed78e36b0","attempted":true,"available":true,"byteCount":6376,"path":"evidence/20260826T014900Z-20260826-a7c91d2e/artifact-manifest.json","reasonCodes":[],"recordHash":"sha256:bc7f6db4879db97e271ae80c73c4fabf23c42880dbb15ed8bfc94a46d5271fc6","schemaVersion":"ArtifactRefV1","semanticHash":"sha256:236d268ca95ff448730526f7dfb6079d9918ff1f4df6b438c404880564f014bf","succeeded":true},"authoritative":true,"outcome":"PASS","pointerHash":"sha256:c2475e92989e09f11092cb6418d1feebebc6107f56f1a75b5e100d0ce03f9136","ready":true,"receipt":{"artifactHash":"sha256:76e8c7d81d16be4732f77ee9649abd479ed4d60f0c741e7520f989946e05b9b6","attempted":true,"available":true,"byteCount":2678,"path":"evidence/20260826T014900Z-20260826-a7c91d2e/gate0-receipt.json","reasonCodes":[],"recordHash":"sha256:328c575f874b578c8f93b69387763e4fe4f661143d85b11271a357123a9b3f46","schemaVersion":"ArtifactRefV1","semanticHash":"sha256:23c9d8fbe836bd35c2bc4b96add7e79081675b73ca1807963245961d78660e0d","succeeded":true},"runId":"20260826T014900Z-20260826-a7c91d2e","schemaVersion":"ApprovalPointerV1","subject":"week-02-gate0-baseline"}
```

## Exact cleanup

Deleted repository paths:

- `gate0-approved.json`
- `evidence/20260826T014900Z-20260826-a7c91d2e/local/generated-types.ts`
- `evidence/20260826T014900Z-20260826-a7c91d2e/local/status.sanitized.json`

Removed PASS-label containers, with full IDs:

- `supabase_analytics_actravel-gate0-20260826T014900Z-20260826` (`0eb6d276c27f9c51d72ade7eb84ab4bd3f2462527444278c18e125de7f4283ef`)
- `supabase_auth_actravel-gate0-20260826T014900Z-20260826` (`d0352e1b4876657a1b3720c2badacc069a7955ec382a793190e779a11ff47e92`)
- `supabase_db_actravel-gate0-20260826T014900Z-20260826` (`72b481265caf1dd45e8c0d2d5a53104426de1ada38b2efd92c830c1d1c9502cb`)
- `supabase_edge_runtime_actravel-gate0-20260826T014900Z-20260826` (`724fb7da74bd091c1c2a262e723103af5159110c0163eb7ff4ccd00bde35ff75`)
- `supabase_inbucket_actravel-gate0-20260826T014900Z-20260826` (`54980ee68659f5b7871daf6a696e5aab8de1230103806ad16ba137a0b6d60a0b`)
- `supabase_kong_actravel-gate0-20260826T014900Z-20260826` (`e42365a71d8d64be5934f9928693479316d8478c37e3c62d6426847294893311`)
- `supabase_pg_meta_actravel-gate0-20260826T014900Z-20260826` (`459f9760e874c3c31d75cd53b5e077f0e25cf1e67546819a284d21e40a11c105`)
- `supabase_realtime_actravel-gate0-20260826T014900Z-20260826` (`f6fbffe62f68c678855c4d24f8877727e0b4445a8da49a24cb585ee8ba83528c`)
- `supabase_rest_actravel-gate0-20260826T014900Z-20260826` (`dbe88f43db437a8a04ed5d67fcf78b7f91e04b2e622fcf4f4fc6c09e7b1494ca`)
- `supabase_storage_actravel-gate0-20260826T014900Z-20260826` (`5679e6e4000f4230028e231afaa9d0da411dd0f1c6e2f69509a6830ae77cd2b1`)
- `supabase_studio_actravel-gate0-20260826T014900Z-20260826` (`e50eba0ca586dbadd4724a4f3ec061edc121354895c84176cf065c7f5b5f0296`)
- `supabase_vector_actravel-gate0-20260826T014900Z-20260826` (`b7b06212e7e93189d71b45871d297e31cc050a5d1d1f23ffe2c45adb25767b71`)

Removed diagnostic-label containers, with full IDs:

- `supabase_analytics_actravel-gate0-debug-20260826T023000Z-23` (`850ec2513023b62ca2137d9a916b4b780d75fd052df1d381930f190cf0fdae9e`)
- `supabase_auth_actravel-gate0-debug-20260826T023000Z-23` (`cecd7bb3be89e01a712f44bbde3fc6063d690ae06cbd2ab97b57a686dad501e9`)
- `supabase_db_actravel-gate0-debug-20260826T023000Z-23` (`993cb3655d6aae1916a19d150adff91f0ab587200d95e8d12ee2ec90004a1626`)
- `supabase_edge_runtime_actravel-gate0-debug-20260826T023000Z-23` (`035430de073fd3c071ca6ae1b270293e53fbb8613d3bd3d9a1e8e5a3b4012a64`)
- `supabase_inbucket_actravel-gate0-debug-20260826T023000Z-23` (`ccd50881a630a7881fc6bac8bce755672bacdc54c4a053fa2be39c6c27afffe0`)
- `supabase_kong_actravel-gate0-debug-20260826T023000Z-23` (`cbea2e3a829215681e4a72368100116f8d3ebbe52bd8ccf79c08b64744e29e2b`)
- `supabase_pg_meta_actravel-gate0-debug-20260826T023000Z-23` (`8f0de15869dc4cd9eebbda0c9c98fa2c4f3facf4c5ed02d9495426f89fd5ac63`)
- `supabase_realtime_actravel-gate0-debug-20260826T023000Z-23` (`eb27352cc586d885bca35437c8a93180e9d89dd63657b649354e924ecfd1d2de`)
- `supabase_rest_actravel-gate0-debug-20260826T023000Z-23` (`2920792c5a45166e68c9655921585384865fefaec2f1f960487eeefafd1a3524`)
- `supabase_storage_actravel-gate0-debug-20260826T023000Z-23` (`73b551727ed7d2a5e1b3e2509a8e26a0af8683ed430d45e679de474655666f8e`)
- `supabase_studio_actravel-gate0-debug-20260826T023000Z-23` (`1156753deee2496ecbb8cdc3981e274a796e48de3b38150b62a1868e1a062863`)
- `supabase_vector_actravel-gate0-debug-20260826T023000Z-23` (`64474ad78e9f49952214e0959cb98c75a0116f8a6cb9d71a8f8b40a3ec188a54`)

Removed volumes:

- `supabase_db_actravel-gate0-20260826T014900Z-20260826`
- `supabase_edge_runtime_actravel-gate0-20260826T014900Z-20260826`
- `supabase_storage_actravel-gate0-20260826T014900Z-20260826`
- `supabase_db_actravel-gate0-debug-20260826T023000Z-23`
- `supabase_edge_runtime_actravel-gate0-debug-20260826T023000Z-23`
- `supabase_storage_actravel-gate0-debug-20260826T023000Z-23`

Removed networks:

- `supabase_network_actravel-gate0-20260826T014900Z-20260826` (`1025e70f52165008a6e33d5b46755174ae8709e2b9c8b3b763badb74b29f2f65`)
- `supabase_network_actravel-gate0-debug-20260826T023000Z-23` (`f3754e173be27a4e9c7290a9fccb278602b0f67ffe4a8ceab44d674c5ef7c8a2`)

## Cleanup proof

| Exact project label | Containers after | Volumes after | Networks after |
|---|---:|---:|---:|
| `actravel-gate0-20260826T014900Z-20260826` | 0 | 0 | 0 |
| `actravel-gate0-debug-20260826T023000Z-23` | 0 | 0 | 0 |

No images were removed. All unrelated baseline resources matched after cleanup:

- 1 container, identity manifest SHA-256
  `1c90e7e7c7fe5d5f3813fb3e2c17895eb0e42c7102759b16a6fb6d5b18fe0bd7`.
- 14 volumes, identity manifest SHA-256
  `0c82cf9dbbd42e328deaeb895c4fe86a2f84b0e558ac61f13bc9ff0859de2636`.
- 3 networks, identity manifest SHA-256
  `4f54e1b8c692bdd0df90b0b3da6b8d5ec61b0af0f3cdcdc36d0975548054c533`.
- 29 image rows, stable inventory SHA-256
  `a490869a41484b282d3412c0bb8dedd97ac6d982d01417cff410c923e09d4cf8`.

## Repository preservation

Pre-cleanup repository evidence captured HEAD
`83a99ed5faaf01b51abc430b9098781cc7334704` on `main`; the real index was
67,292 bytes, mode `0664`, SHA-256
`9ab2becb461752539851fd11413ef863e9ee5e21c021ec171cd27958f7ebbf58`.
The index-entry manifest SHA-256 was
`fbbf16c6679e4075e2f07c85eaffa7ce16f23659e735f7f18f75a82ce5f1787a`.

Protected baseline paths were:

| Path | Mode | SHA-256 |
|---|---:|---|
| `next-env.d.ts` | `0664` | `7ad303e40d4fddf44f156129e397511953a71481c5cfd86b1862649aaaf240cc` |
| `lib/supabase/database.types.ts` | `0664` | `b6e3ea6876dd32c1e817d9f9f8ff7b28571a75ed5b29fd2faa5e10449b492637` |
| `docs/about/helps/intakes/image.png` | `0664` | `fef8a13433a8084e6632b0a8c64f668f4a51cfba4fd14d951ec774d32fc58655` |

Final byte/mode comparison preserved all 315 code paths, 9 configuration paths,
61 migration paths, the protected files above, the real index, and every unrelated
worktree path. The 838-path unrelated-worktree manifest matched before and after at
SHA-256 `03feddec01fef49a10de994a135baf7b642e6d74b0c149c556bccee5d65fea2a`.

## Task state

Tasks 1.1, 1.2, 3.2, 3.3, 4.1, 4.2, and 4.3 are reopened: 7 total. Their
descriptions and all prior-attempt history remain intact. A fresh validator is required
before any future baseline attempt; this cleanup does not authorize one.

## Corrective protocol disposition

The old run remains invalidated and there is still no approval pointer. A future run is
not authorized by this report, but if separately authorized it must use a new `RUN_ID`, a
new `^atg0-[0-9a-f]{8}$` project ID, and a new content-addressed receipt. It must derive
resource evidence/removal from the exact observed project label, verify label equality on
every owned resource, prove zero containers/volumes/networks, preserve images, retain no
status credentials or full generated types, retain C000-C016 hash-bound command records,
and pass the corrected 2,200-line pre-pointer count. A fresh external staged-packet
validator and a fresh pointer-bound read-only validator are mandatory before readiness.
All seven incident-reopened tasks remain open; corrective-run task 5.1 is also open.
