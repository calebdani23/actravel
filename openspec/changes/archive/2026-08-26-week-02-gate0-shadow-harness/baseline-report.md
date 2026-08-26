# Gate 0 factual baseline report

- Run: `20260826T062950Z-gate0-factual-run-20260826a`; UTC apply result: `PASS`.
- Parent evidence revision: `sha256:c72f61a8207752f18d747a680512c90355797ed1d17c837c73b8eb10eeb47887`; captured `2026-08-26T06:15:57Z`, expires `06:30:57Z`.
- Attempt authority: request `gate0-factual-run-20260826a`, factual-gate0-baseline, max 2/runtime 1400; parent retained token.
- Remote: ref `bdyhakpmxegoipbmbtjb`; URL `https://bdyhakpmxegoipbmbtjb.supabase.co`.
- Remote R002: 59 rows, remote-only `0051`, missing `0057` accepted only under `ABSENT_WITH_EFFECT_EQUIVALENCE`, no `0061+`.
- Remote R002 hash `sha256:a7d8e973c3bfb3ed6408e7eee883f301b9b1399e5ae92a0b3d9f16ae351f27b6`; SQL ledger hash identical; complete-set equality PASS.
- Remote catalog: tasks absent; staff_notifications absent; manager count 0; Manager absent from constraint and policy. Parent catalog operation was read-only.
- Local project ID: `atg0-1350bc8c`; collision checks found zero exact label/name container, volume, network, and project-directory collisions.
- Supabase CLI: temporary `2.115.0`; local `start` exit 0; `db reset --local --no-seed` exit 0; no linked or remote fallback.
- Local source manifest: 60 rows through `0061_manager_capability_foundation.sql`; manifest hash `sha256:94d2de3e6e939c3ef7a0b122469b181060d974bffc0764db4eebbdeac144ed73`.
- `0061` file SHA-256: `979f03da567e32c12e2a5eef1c6b1f093332776719830b09dcb8474c327c81dd`; local `0051` absent and one local `0057` present.
- Local ledger: 60 rows, tail `0061`; normalized ledger hash `sha256:c4a826f87cf2fb938274e7e87354252a7afcf53ee2fc1917de1e0886d8187209`; manifest projection equality PASS.
- Local catalog: one Manager row; constraint includes six roles; `roles staff read` includes six roles; deferred tables absent.
- Quote functions: accept present; register_with_pdf present; accept_quote_version, create_quote, and link_legacy_quote_document absent.
- Generated types were temporary only: hash `sha256:ce03b0519609eb101f5faacb41900dc96fdafc1126786ab00f85ea619461b461`, 112953 bytes/3693 lines; `roles.Row.name` string; deferred tables absent; full file deleted.
- Preservation preimage: 920 path/type/mode/byte/hash records; manifest hash `sha256:c6d8b37911a6e59e4349434abd5e5d229454dd53508a26d3de798ba639e0b649`; coverage includes packages, active packet, migrations, index, next-env, tracked types, and protected image. Final comparison PASS; index hash `sha256:d746255071af0bf64816e86378d298e0b74324e29c162118935a48b9c4b43bd4`.
- Cleanup: exact-label stop exit 0; scoped containers 0, volumes 0, networks 0; temporary root absent; no secrets, raw streams, or full types retained; images were not removed.
- Command capture aggregate (computed before deletion): `sha256:ae3210222e7e676315ea5b5c0ff723a4c44420d25a03438736f417cbefbee82f`.

## Command evidence

Each row is `block: command SHA / stdout SHA / stderr SHA / decimal exit`.

- B001-containers: `e0fc535fc6754a31e2238be80d7f2d0c69500dc51dfd81c6ab7670ef2a2402d5 / 14fc8113cd61ae88d48b279b4e0ff4eec44e579d39ac79a2e856a4130f729003 / e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855 / 0`
- B001-volumes: `982449f8ff8a9f65370adb1d00ea91935e9e20ef945df95eab19ac92615f249c / bbe014ed6fb4220361eea6e259534ffe0aa046cad991ebaf05785ce470fda583 / e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855 / 0`
- B001-networks: `6538318d0e0a0d4b51724db64c40921788e3d1dcf6b35969499135ff5ea0026d / b0075cb50c42c8be801b1ea2724c519b0e7e6d10eacc5068fdd438e4d133b64f / e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855 / 0`
- B002-manifest: `e06c816f23bc093cdfb472b0b1e967e40b28db2a4ddae694c3cd2a96a0b97d0a / 95cf32708a31caa478a0e9141103ac567d85e5186e697e7e0c81f75589999e31 / e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855 / 0`
- B003-init: `ae1b31792149cba2ad77da3f86bbaf0a3cae1f6b9d159b2a2907979533e95734 / 1a96cfe1d585fade766d4e037ac78cec4f323088a8cc9e2d6d992c71e10e7ab8 / e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855 / 0`
- B003-start: `5f9b34e25a3ade41c3605671fb2f3262e03f88696a650e87aea92c8f0dc9c252 / e19889581ad6e15ca55bda53ddf236c82b67a53238713e119ff502e1ec53c235 / 104c1765c4a9d07cee7a97349f8dd0dd1ec8dbd0574083fc63190fd2b42e90e0 / 0`
- B004-reset: `b038a139c8e99d136a05793300d87e3e54027a90d75a59a529e1fc1737c91370 / e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855 / 09b7510b445d9d3372a84923274a72f026a355685e4bf6040b9937af71a9277c / 0`
- B004-query: `4ff86dc16dbd309d2d0ccd9f291328c10be1153ceed47e8f90a9bd6b09f91cf4 / 77ad3d2095d373754232da4a149fbd6f2773eb8415282cb15af3b10644b0f25b / e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855 / 0`
- B005-types: `b75cea476dcc1ed0d0d5599e20184324315c47f8aae9a6a8e31726fed33c0c1a / ce03b0519609eb101f5faacb41900dc96fdafc1126786ab00f85ea619461b461 / 66f61e3a57338caf9a33076142dfad2cb4f376b166893bdc90045d4d3fa497c7 / 0`
- B006-stop: `8e33f3dfa77ae41317ea400555e1dff28cb5221719d21facca2901a3dbc570c9 / a357c2665e8225aeff497c0dd3e31a85613e37c905495c233127a76e5120478c / e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855 / 0`
- B006-final inventories: containers `e0fc535fc6754a31e2238be80d7f2d0c69500dc51dfd81c6ab7670ef2a2402d5 / 14fc8113cd61ae88d48b279b4e0ff4eec44e579d39ac79a2e856a4130f729003 / e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855 / 0`; volumes `982449f8ff8a9f65370adb1d00ea91935e9e20ef945df95eab19ac92615f249c / a4e9ff9a27a9c479a889a39ecdbf185fb7a90923335e5aa481c523a01c19cd0a / e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855 / 0`; networks `6538318d0e0a0d4b51724db64c40921788e3d1dcf6b359694935ff5ea0026d / b0075cb50c42c8be801b1ea2724c519b0e7e6d10eacc5068fdd438e4d133b64f / e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855 / 0`.

This is a factual apply report only. Prior protocol artifacts and invalid runs remain provenance. No approval pointer, receipt, custom schema, product schema, new migration, package/code change, tracked types, remote mutation, Git lifecycle, or review lifecycle was performed. Independent native verification and external-parent review/post-apply remain required.
