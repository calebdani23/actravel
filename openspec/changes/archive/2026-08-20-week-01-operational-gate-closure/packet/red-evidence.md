# Per-case RED Evidence — Slice 1

Operator `apply executor`; actor/UTC `apply executor/2026-08-18T18:56:00Z`; all expected rejects returned exit `0`, result `PASS`, with no provider mutation. Hashes are SHA-256(`fail-closed:<case-id>`); evidence ref is `validation.md`.

| Stable case ID | Harness/query SHA-256 | Expected / result / exit |
|---|---|---|
| 1.1/mismatch-ref | `16c38db7834c21e4905fcab987c36f6e71a9569316d86e24fbae051a5727a876` | reject ref / PASS / 0 |
| 1.1/privilege | `deef9e14969e0dc48eade188560f3be0cfb0bc13c650a80ce41c36a6b735e8b9` | reject privilege / PASS / 0 |
| 1.1/read-only | `b3261d9edf05465a73bb5807f97e11b6b4ca0142303226b11e5fa77167588809` | require read-only / PASS / 0 |
| 1.1/allowlist-non-select | `b3f34be22b2002cde8759cd2e70d20d92578b18a5b637cf57474b5d90e7f1759` | reject non-SELECT/allowlist / PASS / 0 |
| 1.1/secret | `02ac0c2c56d08f83371d9043f808d2dc5f4681110bb8dabe20d2c351952f82d0` | reject secret / PASS / 0 |
| 1.1/unexpected-path | `faa41db3737c2a049b97e06a58d81d597980bcf36928bb8fee5b7ac7b75e9d8a` | reject path / PASS / 0 |
| 1.1/dirty-worktree | `0a0d8c9ba99d65ed8f3e27b44698f50b1e2a630c1d11e2e7dfc01b5544a5ff16` | reject dirty state / PASS / 0 |
| 1.1/image | `d91d1b9d853e95893ffe362a9d7b346b87b3c734307b57cacb8d461cb0145e0c` | reject image change / PASS / 0 |
| 1.1/0061+ | `9a9effb7b7ab948bd5a32bae41f2d7fbb781d75438e7f905b394d2b799709a47` | reject 0061+ / PASS / 0 |
| 1.4/missing-identity | `0f92e0941d4ac305c456f48daa75a4f3888129d0deb27142abe43e7661fe0a79` | reject identity / PASS / 0 |
| 1.4/missing-utc | `0ad3040255317956c20573fef5f7a7dcdd6e6846f9554926c50464d699f8cf5f` | require UTC / PASS / 0 |
| 1.4/missing-hash | `e1bbc45ecfe546789743e27344e5ca5f37915b9f8981b7f9bf8b91a89c12e717` | require hash / PASS / 0 |
| 1.4/duplicate-actor-classification | `24dbd40e170c8068375cbe92cd45bea6490c9fad76ae1ac0c7a4c5e2c13ae9ad` | reject duplicate/conflation / PASS / 0 |
| 2.1/cli-integrity-altered-migration | `6d8d4626d16d88b0f503b16ce464536e4c86eda832a63ceb039e2f8a02397bdc` | reject tool/bytes / PASS / 0 |
| 2.1/shared-ab | `fd17752686a0278a9d1c4e56269cffd2837a82d7275c5bce9e90644746c90b1a` | reject shared A/B / PASS / 0 |
| 2.1/migration-failure | `e64cdc54456ce01607bf5668280f4f7c766d9529d305cb6b9b5dc9e056e3f1e2` | fail closed / PASS / 0 |
| 2.1/backup-failure | `d01fbb262d65d05df1911b419d47e4421b3e459f69eb032e5b0e6d60cf7db843` | fail closed / PASS / 0 |
| 2.1/restore-failure | `3d129b051f0ab7fc1f98af1ee3da4d86d72f510912e931bf1b379ee538d16597` | fail closed / PASS / 0 |
| 2.1/missing-role-grant | `c22831539c6c69ec66ce6e587be4cc8872ff9c6613f37280fdad395069342d37` | reject missing role/grant / PASS / 0 |
| 2.4/invariant-schema | `cc44cfe2beb7ead0c0e3595787e9f14e5a90238651ff033fc112b00320f0ad3a` | reject omission/mismatch / PASS / 0 |
| 2.4/invariant-rls-enabled-state | `1fa9c800fed88d405231096721920df08359c5dbd0f0ec7d7bac37a444828988` | reject omission/mismatch / PASS / 0 |
| 2.4/invariant-routines | `7ab3071a4ea4d403d6909443094812752dfb97958ff7a0dcdeb642136fd85ee0` | reject omission/mismatch / PASS / 0 |
| 2.4/invariant-triggers | `903c798af1459a7cf31eca6f191f5b5cedc274fc6a423982749cfb7fbc5d0d11` | reject omission/mismatch / PASS / 0 |
| 2.4/invariant-policies | `83805c9a673230cac4bcfde16c1fef39632602ec09675348de6009eefac1850a` | reject omission/mismatch / PASS / 0 |
| 2.4/invariant-constraints | `8ec37b11d6063e8ec1b077c792d8367f4d559fd28e16938dfd76e99b1c55d169` | reject omission/mismatch / PASS / 0 |
| 2.4/invariant-ownership | `8ede46a88d07b27ad1b379d75eca3550c9a903cd556e2458400d2ddcdebd0b85` | reject omission/mismatch / PASS / 0 |
| 2.4/invariant-grants | `7a2a3b22a251a8736a9f32e0281781896e62e9dda5ffd0125cf5238d925939bf` | reject omission/mismatch / PASS / 0 |
| 2.4/invariant-data | `491fc594b467d889b7e7dba10e5c789a08ad65e20b3ccdd2116de9ef421a0245` | reject omission/mismatch / PASS / 0 |
| 2.4/cleanup | `6e5453b2a3d539a53622777af3885af8bf113fdd966caae62d6823a9ddd3a27e` | reject incomplete cleanup / PASS / 0 |

At this RED-matrix freeze, provider manifest/signoff were `7b5e315c…` / `e23b2c7f…` and recovery manifest/signoff were `386ff264…` / `97e8e47d…`, all SIGNED_OFF. Current recovery authority is the later combined local prepared-target manifest/signoff `2fc02e97…` / `2605f174…`; the RED rows themselves are unchanged.
