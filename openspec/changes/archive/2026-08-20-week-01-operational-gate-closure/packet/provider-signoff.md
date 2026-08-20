# Provider Evidence Verification - Strict Final Slice 1

- Verifier: OpenCode independent provider-evidence verifier (`openai/gpt-5.6-sol`), distinct from operator `apply executor` and maintainer/authorizer `calebdani`.
- Verified UTC: `2026-08-19T01:01:10Z`.
- Parent token: `sha256:52223a5e8651d2114bb5d1062708d28680f58c5966743e955ec1db4d6ac1c432`.
- Scope: immutable local evidence review only; no provider contact, database mutation, staging, commit, push, or image write.

## Bindings

- Production target: `bdyhakpmxegoipbmbtjb` / `https://bdyhakpmxegoipbmbtjb.supabase.co`; HEAD `39f7943b286ca1de6c69fdbbc8c0e650864df42b`.
- Authorization: `packet/maintainer-declaration.md`; `calebdani`, UTC `2026-08-19T00:46:40Z`, source Engram `#1746`; read-only only and no replay/repair/mutation authorized.
- Provider manifest SHA-256: `7b5e315c55021984d0fdf1dd2f51b758d80648ebdc80fc45c7be8cb2dc555b2e` (recomputed; exact expected match).
- Ignored `manifest.json` SHA-256: `c3ca904e66e76ba04801112e3055ec889663041503e7a6ea0a98872cf943374e`; capture-record SHA-256: `f7b1ad38ec72a296dbeb6f3bbe005c9bb4189e747c31bd74c2a042c4115213c9`.
- Manifest-input SHA-256: `f15d34f254b64c1de88c1fa092e6ee0fb41df8c58bce023b42ba9b2c608d7614` (1,971 bytes; exact byte-for-byte rebuild).

## Query Bindings

| ID | SQL / raw / normalized SHA-256 | Rows |
|---|---|---:|
| `schema` | `c7a5e826af21604a430426d13a08171a769442e72295b8cd0994de6cb7b14f31` / `aa5d200707107a3aca213108719bf43b0ef6e876f353bc682528a52840e400da` / `338bba0f4dbbf715898843adf2c7910230793702852133bd1225cde7b02c3d01` | 6 |
| `migrations-full` | `7bb6b401de085852973a9c3f0618ebd390f61e54fa639b5e3018b4c520a624e1` / `57f9f7d564dcf3e63a34e49481e9cde1af2c165ae45ee60612cc1fa0b5bb4f3f` / `626ed86c2da245050e93f2f3910840c66623917cbe32369965e716ac4b480d09` | 9 |
| `migrations-hash` | `0addb02a8935f99ac30e49ec607e17ed7e62ccb0b46b6ce473ba40919afdb1ed` / `ec375588935490fb8d1ee6ee533a9fd9fa46d928aecbf6a7a4a5b1fddbc3e44c` / `2e8bee5d9ac2e78112b23a37aabbea65ee8dca98f31d2157aad4c6e7f3d3cc9e` | 9 |
| `functions` | `f3e5f5a9fb3d2f7d6699cb58907c938cec359a5e1eb6e7b4b3db289955ab0f1c` / `eca835f5865755de30fd2beb1e331f7cc4633ca2a7ff025cb64fa3e083b028fc` / `e4825ee43901d87a5a0a96965d2bcd02eab6e19375db7c3a59a68a26c346d16d` | 6 |
| `triggers` | `f53730b4acdd6af0206f6e5e625e3597f60d0af17866fce26bfcbe07e02a1140` / `f7cd6d65dda0d3e0eaa71b049279665ce96b906ba75de198cda01ab89a8ada84` / `50292d9bb8efefdf40f882b4d04c8ab115a8cf6b33d4b73b0c1b280298edad87` | 18 |
| `policies` | `b8c5312d494863cc6ce9237825067d35466f5a41073d76f458975f2ac42cab2f` / `66c80197e7800b66cc2d3d41131b7892b5c871f5b6e9a0b9df7b72ca64031ea6` / `9cd2c8eabaa53728c096436f73a7fc64621eaab4998966ea399b7332c465e9a4` | 2 |

## Checks

- PASS: exact inventory is 6 SQL + 6 complete raw + 6 normalized + `capture-record.json`, `manifest-input.txt`, and `manifest.json`; all are regular files, `tmp/` is ignored, and no expected or unexpected path differs.
- PASS: every SQL/raw/normalized SHA and byte count recomputes; all six normalized files reproduce byte-for-byte from their complete raw result arrays using deterministic key/row ordering.
- PASS: every wrapper is fixed SELECT/catalog SQL with `BEGIN READ ONLY`, local `10s` timeout, per-row `current_user`/`transaction_read_only` assertion, and `ROLLBACK`; no DDL, DML, application-function invocation, or provider mutation exists in the executable wrappers.
- PASS: all 50 returned rows report `session_role=postgres`, `transaction_read_only=on`; raw, normalized, capture-record, target, query, UTC, and operator bindings agree.
- PASS: full migration statements and MD5s parse and agree: `0051` and the rate-policy migration are remote-only/untracked; `0044`-`0049` retain only `select 1;` ledger placeholders and remain ambiguous/manual-review; remote `0057` is absent; remote `0060` is present and byte-equals local `0060` after the ledger's final-LF removal, while the `0057/0060` discrepancy remains ambiguous/manual-review.
- PASS: six complete function definitions, 18 trigger definitions, and two SELECT policies parse and their definition MD5s recompute; the three cutover compatibility writers are absent, and no rate-limit write policy is returned.
- PASS: accepted/no-replay dispositions preserve classifications and provenance uncertainty; operator, authorizer, and this verifier are separate, with attributable UTC/source evidence.
- PASS: current strict-final links in `execution-declaration.md` and `local-recovery.md` bind this provider manifest; older `fabd5f7f...` summary references are superseded historical material and were not used for this verification.
- PASS: independent secret scan found no credential, JWT, database-URL password, bearer token, or private-key value.

## Limitation And Preservation

`postgres` is privileged, not a dedicated read-only credential. Effective production preservation is established only for this fixed allowlist by explicit transaction-read-only wrappers plus `postgres/on` in every returned row; this does not claim least privilege or migration provenance.

Protected image SHA-256 remains `1a0322e51ed8acc21f3e152907cc0fa65b26137bd5449e0aa058ad67561d9715`; its pre-existing diff digest remains `bc76721b30efa38760b6137bf94f3ba55aa90b3c14948cb33ebbeff7db4561ab`. Migrations, app/types, manifests, lockfiles, provider/database state, index, and history were not changed.

## Verdict

`SIGNED_OFF`
