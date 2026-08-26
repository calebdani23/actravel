```yaml
schema: gentle-ai.verify-result/v1
evidence_revision: sha256:f21729c5467cec8f96c85c7e046952219660cdbdb8eddf82c048da538117aa3e
verdict: pass
blockers: 0
critical_findings: 0
requirements: 10/10
scenarios: 10/10
test_command: node --conditions react-server --import tsx --test tests/manager-migration-contract.test.ts tests/roles-capabilities.test.ts tests/admin-route-boundaries.test.ts
test_exit_code: 0
test_output_hash: sha256:db79ccef3144258388aae6c2d4818ee4d3550aa66da6fed0c456b00dc5b03f1a
build_command: npx tsc --noEmit
build_exit_code: 0
build_output_hash: sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855
```

# Gate 0 independent verification report

## Verification envelope

- Change: `week-02-gate0-shadow-harness`; attempt: `gate0-verify-20260826b`.
- Verdict: **PASS**. This report preserves the failed attempt below as history.
- Parent evidence revision: `sha256:898e0a67c8b8c8efd94a46baf0a5aca8d97544b5fe99524cae6e30bd62621fc4`; captured `2026-08-26T07:26:35Z`; expires `07:41:35Z`.
- Attempt token: `sha256:37ee0c93f0d25445e0f02b2c5a1cdeaa779135e157c2d2812b844e37dae82822` (retained by parent).
- Fresh temporary project: `atg0-5ce51847`; Supabase CLI `2.115.0`; root removed after settlement.

## Completeness and runtime evidence

| Check | Result | Evidence |
|---|---|---|
| Tasks | PASS, 6/6 planning/apply tasks checked | `tasks.md` |
| Remote identity and complete set | PASS | ref/URL match; 59 R002 rows; remote-only `0051`; accepted absent `0057`; no `0061+` |
| Remote R002/SQL ledger | PASS | both `sha256:a7d8e973c3bfb3ed6408e7eee883f301b9b1399e5ae92a0b3d9f16ae351f27b6` |
| Local source/copy/ledger | PASS | 60 rows; source manifest `sha256:94d2de3e6e939c3ef7a0b122469b181060d974bffc0764db4eebbdeac144ed73`; ledger `sha256:895e57599f487a13f143b768808ff9f680c4244eca255a039e106142ffa3db96` |
| `0061` | PASS | `sha256:979f03da567e32c12e2a5eef1c6b1f093332776719830b09dcb8474c327c81dd` |
| Start/reset | PASS | first start exit `0`; first reset exit `0`; no retry or fallback |
| Local catalog | PASS | one Manager row; exact six-role constraint/policy; deferred tables absent; required quote functions present and three prohibited functions absent |
| Temporary types | PASS | `roles.Row.name: string`; `tasks` and `staff_notifications` absent; generated file deleted before cleanup |
| Focused checks | PASS | lint, focused Node tests, `npx tsc --noEmit`, `git diff --check` all exit `0`; no build run |
| Preservation | PASS | before/after manifest hash `sha256:b8e95d41b7fd59367444f86ec7ca04025fc5e25b8953a09777d395afefbe0c8c`; equal |
| Cleanup | PASS | exact-ID containers/volumes/networks zero; temporary root absent; no image removal; no secrets/full types retained |

## Canonical command evidence

Rows are `block: command SHA / stdout SHA / stderr SHA / decimal exit`; complete capture was aggregated before deletion.

- B001: `795737b3ae475becb34e4b1617a338f01b5fd1b72f43bdc0c01480525b581c40 / e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855 / e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855 / 0`
- B002: `8f1db5e5fe6c8c09db42c3fdb4f14a4ade8112a8332b448e26c5d2379c452815 / ce23db2ac6d5b03c6ca45fe79a32c8d8479aede9a52117d68d60b5e69b31660e / e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855 / 0`
- B003: `eff12595f6df57b991b2771920f7702d92f486ec7e13c93ce9e28ee8546c789c / a682d7f4dc2ae6e2bd573fc85f74e81ad4039e6a6a19f3f267b7d3b98508a076 / 104c1765c4a9d07cee7a97349f8dd0dd1ec8dbd0574083fc63190fd2b42e90e0 / 0`
- B004: `0ade04418ef4cc40469a7e15c3139b56a9e83cbe279aba72c6defb5821f824b6 / d117ff896caf25aac115dc8b1e0b0a47dd951e671ca7c1a5858fa80705c50b32 / 2562d9642f598f3817ef9c15945d7400ed3668dcc1fd2bfd371e3956a4865401 / 0`
- B005: `587f5ac56902e3296477e428f9058caffec804f015c3736941fa1c752e55a162 / c368312779c625d76d1865148085ab016b123ffd155dbeb5f83ac7377a16e8f4 / 66f61e3a57338caf9a33076142dfad2cb4f376b166893bdc90045d4d3fa497c7 / 0`
- B006: `e95bcec096ba35ce6443307a48cbe1828fdf1c572a75a4c285a481bb9016f2ea / a357c2665e8225aeff497c0dd3e31a85613e37c905495c233127a76e5120478c / e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855 / 0`
- CHECKS: `613e76a1b99183955b3f1aacc115dd785a8d946a914447f5d50ff97b08c67693 / 16eaaa2d52712fa4d7d42941eb97321decee53d810e764cbb17482776bbbbe40 / e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855 / 0`
- Command-capture aggregate: `sha256:db79ccef3144258388aae6c2d4818ee4d3550aa66da6fed0c456b00dc5b03f1a`.

## Failed attempt history

The prior independent attempt remains historical FAIL: first reset exited nonzero, build altered `next-env.d.ts` before restoration, and its disposable command capture was incomplete. It is not used as evidence for this PASS. No review lifecycle, Git mutation, product/remote mutation, or settlement authority was performed here; external-parent bounded review/post-apply remains required.
