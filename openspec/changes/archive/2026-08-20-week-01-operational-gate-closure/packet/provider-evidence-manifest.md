# Immutable Provider Evidence Manifest — Strict Final Recapture

- Recapture ID/UTC: `week01-provider-strict-final-20260819T004640Z` / `2026-08-19T00:46:40Z`; exact target `bdyhakpmxegoipbmbtjb` / `https://bdyhakpmxegoipbmbtjb.supabase.co`.
- Operator: apply executor. Authorizer: `calebdani`. Declaration binding: `packet/maintainer-declaration.md`, source Engram observation `#1746`.
- Session assertions in every returned row: `session_role=postgres`, `transaction_read_only=on`. `postgres` is privileged, not a dedicated read-only credential; every operation used explicit read-only transaction and 10s timeout.
- Aggregate ignored root: `tmp/audit-evidence/week01-provider-strict-final/`; deterministic manifest `manifest.json`; manifest-input SHA `f15d34f254b64c1de88c1fa092e6ee0fb41df8c58bce023b42ba9b2c608d7614`; manifest SHA `c3ca904e66e76ba04801112e3055ec889663041503e7a6ea0a98872cf943374e`; secret scan PASS.

## Query records

| Query ID | Query SHA | Raw SHA | Normalized SHA | Rows/status |
|---|---|---|---|---|
| schema | `c7a5e826af21604a430426d13a08171a769442e72295b8cd0994de6cb7b14f31` | `aa5d200707107a3aca213108719bf43b0ef6e876f353bc682528a52840e400da` | `338bba0f4dbbf715898843adf2c7910230793702852133bd1225cde7b02c3d01` | 6 / success; postgres/on |
| migrations-full | `7bb6b401de085852973a9c3f0618ebd390f61e54fa639b5e3018b4c520a624e1` | `57f9f7d564dcf3e63a34e49481e9cde1af2c165ae45ee60612cc1fa0b5bb4f3f` | `626ed86c2da245050e93f2f3910840c66623917cbe32369965e716ac4b480d09` | 9 / success; 0057 absent; postgres/on |
| migrations-hash | `0addb02a8935f99ac30e49ec607e17ed7e62ccb0b46b6ce473ba40919afdb1ed` | `ec375588935490fb8d1ee6ee533a9fd9fa46d928aecbf6a7a4a5b1fddbc3e44c` | `2e8bee5d9ac2e78112b23a37aabbea65ee8dca98f31d2157aad4c6e7f3d3cc9e` | 9 / success; postgres/on |
| functions | `f3e5f5a9fb3d2f7d6699cb58907c938cec359a5e1eb6e7b4b3db289955ab0f1c` | `eca835f5865755de30fd2beb1e331f7cc4633ca2a7ff025cb64fa3e083b028fc` | `e4825ee43901d87a5a0a96965d2bcd02eab6e19375db7c3a59a68a26c346d16d` | 6 / success; postgres/on |
| triggers | `f53730b4acdd6af0206f6e5e625e3597f60d0af17866fce26bfcbe07e02a1140` | `f7cd6d65dda0d3e0eaa71b049279665ce96b906ba75de198cda01ab89a8ada84` | `50292d9bb8efefdf40f882b4d04c8ab115a8cf6b33d4b73b0c1b280298edad87` | 18 / success; postgres/on |
| policies | `b8c5312d494863cc6ce9237825067d35466f5a41073d76f458975f2ac42cab2f` | `66c80197e7800b66cc2d3d41131b7892b5c871f5b6e9a0b9df7b72ca64031ea6` | `9cd2c8eabaa53728c096436f73a7fc64621eaab4998966ea399b7332c465e9a4` | 2 / success; postgres/on |

All six SQL operations used `BEGIN READ ONLY`, local 10s timeout, assertion, fixed allowlisted SELECT/catalog body, and rollback. Complete raw MCP result/envelopes and deterministic normalized rows are retained in the ignored root, including triggers and policies. Existing dispositions remain accepted/no-replay with original classifications. Review status: **SIGNED_OFF** under provider sign-off `e23b2c7fd39c485f1f0d9135fe7a1bcbaf6e08597902e8b84788b41f54770532`; task 1.4 is complete.
