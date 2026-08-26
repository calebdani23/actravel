# Incident Report 2: False Gate 0 Authority

## Status

`INVALIDATED`. Run `20260826T044700Z-2482553-a5499196` is not authority for
delivery. Its approval pointer was removed, no replacement authority was published,
and baseline execution did not continue.

## External Provenance Location

Raw run evidence is stored under `tmp/audit-evidence/week02-closure-provenance/`, preserving
its original repository-relative paths. The complete manifest aggregate SHA-256 is
`764a1cb3827368f0f5a1b38f681accee29bfbe9b2def3f592caf6acccda2604e`; see
`provenance-manifest.json`. References below beginning with `evidence/` are historical
change-relative path values whose current external location preserves that suffix below
`openspec/changes/week-02-gate0-shadow-harness/` in the external root. Embedded pointer
preimage path values remain unchanged deliberately.

## Validator Findings

- Definition-bound validation against the retained contract rejects
  `gate0-report.json`: the PASS branch of `Gate0ReportV1` requires `finalDocker` to
  be an object, but the report records `finalDocker: null`.
- Definition-bound validation rejects `artifact-manifest.json`: entry 42 records
  `owner.json` with `byteCount: 0`, while `ArtifactManifestV1` requires every entry
  to have `byteCount >= 1`.
- `gate0-receipt.json`, `pre-pointer-validation.json`, the deleted pointer preimage,
  and `post-pointer-validation.json` validate against their individual definitions.
  They remain non-authoritative because they bind or depend on the invalid report and
  manifest, and the authority pointer has been deliberately removed.
- The prior Ajv PASS claim therefore cannot authorize delivery. The report, receipt,
  manifest, pre/post validations, and pointer preimage are incident provenance only.

## Invalidated Hashes

| Original artifact path | File SHA-256 | Embedded semantic SHA-256 | Disposition |
|---|---|---|---|
| `gate0-approved.json` | `cba49f643f13639d6bc5734476298877efe777ea8c714f8871f60261b5efa97a` | `55ffbcd346e3c0da711b8c017f464ccefec9d918de06ea5a56bd6fb3b6e09a00` | Deleted; never authority |
| `evidence/20260826T044700Z-2482553-a5499196/gate0-report.json` | `4c9026356508667187f91937424dd24769a2affec4913babf5b1f1aedfe9daff` | `8fd8603dd8354d675f9760f627fb2162944009055f42acbd1d8ebf3d0362a501` | Provenance only; schema-invalid |
| `evidence/20260826T044700Z-2482553-a5499196/gate0-receipt.json` | `d218c5681bfede5e8018e64efbe96c09d9ce02b7662b70634451d8284eec0c71` | `fe373b1630bb13e5016bae02701baa37193aa490866f5faa5e41d4b2fe60beaa` | Provenance only |
| `evidence/20260826T044700Z-2482553-a5499196/artifact-manifest.json` | `7f9bc1255921d0c1f4effe479b43d103b0b6d5dbbc6d839e90e58a40ed892cb4` | `31db4170bf89eb49cc4bc40dcb426ff2a06eb07de39717a4fb364a1f90a0910d` | Provenance only; schema-invalid |
| `evidence/20260826T044700Z-2482553-a5499196/pre-pointer-validation.json` | `8d79c8f7afa368092dfb6e2c1ebb335103647ab3421eb4e23be402dfa04e964a` | `ea56f99c669dc3688af653942cb4d0cd0e7acd4b29616c5a49cb5c5a9bef74a2` | Provenance only |
| `evidence/20260826T044700Z-2482553-a5499196/post-pointer-validation.json` | `5a414c1962938acd558e480605fc31bbf7a6ea302ce32983e155c8883fa016ef` | `9b054ceab95ab91e95b8a7766fef0b36b04658a3def876b71099a5b5a5dd7057` | Provenance only |

## Pointer Preimage

The deleted pointer's complete 1,800-byte preimage, mode `0664`, is reproduced below.
It ends with LF and has file SHA-256
`cba49f643f13639d6bc5734476298877efe777ea8c714f8871f60261b5efa97a`.
It is incident evidence only and must never be treated as authority.

```json
{"allowedClockSkewSeconds":0,"approvedAt":"2026-08-26T04:50:00Z","artifactManifest":{"artifactHash":"sha256:7f9bc1255921d0c1f4effe479b43d103b0b6d5dbbc6d839e90e58a40ed892cb4","attempted":true,"available":true,"byteCount":7623,"path":"evidence/20260826T044700Z-2482553-a5499196/artifact-manifest.json","reasonCodes":[],"recordHash":"sha256:d71d3bfb119afbdac378b00fea895a74dff3ca5e8fd6b8f7dee213d46c690cf0","schemaVersion":"ArtifactRefV1","semanticHash":"sha256:31db4170bf89eb49cc4bc40dcb426ff2a06eb07de39717a4fb364a1f90a0910d","succeeded":true},"authoritative":true,"outcome":"PASS","pointerHash":"sha256:55ffbcd346e3c0da711b8c017f464ccefec9d918de06ea5a56bd6fb3b6e09a00","prePointerValidation":{"artifactHash":"sha256:8d79c8f7afa368092dfb6e2c1ebb335103647ab3421eb4e23be402dfa04e964a","attempted":true,"available":true,"byteCount":1211,"path":"evidence/20260826T044700Z-2482553-a5499196/pre-pointer-validation.json","reasonCodes":[],"recordHash":"sha256:cc457f890a5eb8a17baea1e43d1522c73a13ed0b2efa65e83d3a16dc129d73a1","schemaVersion":"ArtifactRefV1","semanticHash":"sha256:ea56f99c669dc3688af653942cb4d0cd0e7acd4b29616c5a49cb5c5a9bef74a2","succeeded":true},"ready":true,"receipt":{"artifactHash":"sha256:d218c5681bfede5e8018e64efbe96c09d9ce02b7662b70634451d8284eec0c71","attempted":true,"available":true,"byteCount":2723,"path":"evidence/20260826T044700Z-2482553-a5499196/gate0-receipt.json","reasonCodes":[],"recordHash":"sha256:c16ec833f2f43430186187336c6ed819660604bd0292ba1d0750662a2040c0a0","schemaVersion":"ArtifactRefV1","semanticHash":"sha256:fe373b1630bb13e5016bae02701baa37193aa490866f5faa5e41d4b2fe60beaa","succeeded":true},"receiptTtlSeconds":900,"runId":"20260826T044700Z-2482553-a5499196","schemaVersion":"ApprovalPointerV1","subject":"week-02-gate0-baseline","validatorTtlSeconds":300}
```

## Exact Cleanup

- Exact Docker label: `com.supabase.cli.project=atg0-b6869682`.
- Before cleanup decision: 0 containers, 0 volumes, 0 networks.
- Removed: 0 containers, 0 volumes, 0 networks, 0 images.
- After cleanup decision: 0 containers, 0 volumes, 0 networks.
- No image command or removal ran.

All unrelated Docker resources matched before and after:

- 1 container; identity manifest SHA-256
  `8f477af2fac0989a500fd5dd782be51879e31020daceab91da42862523bc5bb7`.
- 14 volumes; identity manifest SHA-256
  `af0894413672a4d8c68e66a91e42fa0ebc137ba3e48a76dcef82ad16e6f112a2`.
- 3 networks; identity manifest SHA-256
  `d248f93dbfdd8d4d1ea78d8ef9c61904413ef4f6bcd43964319d37f87ba210e9`.
- 29 image IDs; inventory SHA-256
  `59222d155c19acd87f40084ad69df930639953beddca306311931719a44cf41d`.

## Retention Scrub

The run contains no raw or sanitized status file and no full generated-types file.
The only status-named artifact is nonsecret `git/status.before.sha256`. The only
generated-types artifact is closed hash-only metadata at
`local/generated-types-evidence.json`. No redaction or evidence replacement was
required.

## Repository Preservation

Before and after incident response, HEAD was
`83a99ed5faaf01b51abc430b9098781cc7334704` on `main`. The real index was 67,292
bytes, mode `0664`, SHA-256
`12689367a125ed4db57b2ce4fe7211c3986f48e1ac32093039d5fbb5fc373f63`;
its entry manifest SHA-256 was
`6ebbf8edc4299364de75ac1cfae68acc85af845b6797273498a5e5de3f2c57dc`.

| Preserved set | Count | Before-and-after SHA-256 |
|---|---:|---|
| Source code manifest | 296 | `d115980704a877fdfd070cc0b79952f0f82c27a3cfd4bf00493bd31468f474c1` |
| Configuration manifest | 10 | `9aed446a5d6b4cb7b890831af5fa631e06e504dc6643bd3c739d6cb8a2de2d78` |
| Migration manifest | 61 | `072e6a95b0ac79baa5e1058dcab3ebbc3d575314eec65aeb163f91021f54fa20` |
| Unrelated worktree manifest | 385 | `d46d8115d17d8adfe286b7d598619571082d010033d34e743005e047e54e262a` |

Protected files were also byte- and mode-preserved:

| Path | Mode | Bytes | SHA-256 |
|---|---:|---:|---|
| `next-env.d.ts` | `0664` | 251 | `7ad303e40d4fddf44f156129e397511953a71481c5cfd86b1862649aaaf240cc` |
| `lib/supabase/database.types.ts` | `0664` | 113,159 | `b6e3ea6876dd32c1e817d9f9f8ff7b28571a75ed5b29fd2faa5e10449b492637` |
| `docs/about/helps/intakes/image.png` | `0664` | 794,206 | `fef8a13433a8084e6632b0a8c64f668f4a51cfba4fd14d951ec774d32fc58655` |

The unrelated worktree manifest excludes only the deleted pointer, this report and
receipt, `tasks.md`, and `apply-progress.md`.

## Task State

Tasks 1.1, 1.2, 3.2, 3.3, 4.1, 4.2, 4.3, 5.1, and 5.2 are reopened: 9 total.
Their descriptions and prior history remain intact.

## Authority Boundary

This report and `invalidated-authority-2.json` are incident evidence, not replacement
Gate 0 authority. No replacement report, receipt, manifest, PASS, validation, or
pointer was published. No baseline command, remote operation, Git lifecycle action,
or review lifecycle action followed this invalidation.
