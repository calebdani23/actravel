# Week 05 — independent local verification

**Result: PASS for S1–S7; Week 05 is locally complete.** The verified candidate is
`74b9f43ce1586865f24c9b92a8914882e009d5d5`, based on
`659b6083ad8e1f4aa829c0d6df622331b3e698e9`. Later closure edits are passive documents.
The feature branch has not been merged or pushed. Hosted rollout is not included.

## Scope and work units

| Commit | Outcome |
|---|---|
| `6a654b1` | Approved terms, narrow customer quote/history reads and private PDF access |
| `ce9bd1e` | Transactional acceptance/request evidence and compatible staff Tasks/intake |
| `986e088` | Customer consent/request interactions and guarded staff work controls |
| `74b9f43` | Browser regressions, local HTTP fixture, contention and preservation proof |

Requirements: [`weeks/week-05-portal-quotes.md`](./weeks/week-05-portal-quotes.md)
and `odd/tasks/week-05-portal-quotes.md`. Implementation details and approved policy:
[`week-05-portal-quotes.md`](./week-05-portal-quotes.md).

## Observed checks

| Check | Independent result | Evidence boundary |
|---|---|---|
| PostgreSQL | 17/17 TAP tests; zero failed/skipped/cancelled | Current candidate; includes parent tests, not 17 independent scenarios |
| Chromium | 5/5; zero skipped | Current candidate; anonymous and positive customer/staff journeys |
| TypeScript | PASS | `tsc --noEmit --incremental false` on current candidate |
| ESLint | PASS | `npm run lint` on current candidate |
| Focused adapters/boundaries | 51/51; zero skipped | Retained from `986e088`; corresponding product/test surfaces unchanged |
| UI/SSR | 8/8; zero skipped | Retained from `986e088`, not rerun in the targeted recheck |
| Production build/start | PASS as browser-server prerequisite | Playwright runs `npm run build && npm run start`; no separate build/page-count receipt |
| Preservation/cleanup | PASS | Live source/index/status and archived source preserved; generated types restored; owned resources stopped |

Parent spot-check repeated the fixed-candidate preflight and diff checks. Parent
correction checks separately passed 11 mutation TAP tests, types, lint and diff.
These overlapping results are not added into a deduplicated test total.

### Required behaviors

| Spec | Verified outcome |
|---|---|
| S1 | Authorized Week 05 local scope only; no Week 06 or hosted actions |
| S2 | Customer-owned safe history/read DTOs; direct table/storage denial; exact PDF hash/no-store and foreign-version/path-tampering denial |
| S3 | Exact immutable customer/Contact/version/terms/PDF/financial/time evidence; consent/current/expiry/revision guards; replay, rollback and actual staff-mutation contention |
| S4 | Bounded customer-attributed requests; zero-write denials, conflicting retries, input retention and successful browser submission |
| S5 | Advisor tasks due exactly 24 elapsed hours; inactive/unassigned-owner intake; original-deadline claim; audited completion; advisor/Admin/Operations browser controls |
| S6 | Admin-only versioned terms, missing/changed-terms denial, preserved accepted terms, no silent replacement; synthetic TEST ONLY legal fixtures |
| S7 | Exact legacy migration/function preservation, selected staff compatibility and differential output, historical-universe contention, source/resource integrity |

The positive journey exercises application customer OTP forms, private PDFs,
unavailable acceptance before approved terms, stale consent, rejected 2,001-character
input, successful changes and acceptance with persistent receipt. It then proves
Bob cannot read Alice's proposal/PDF, advisor Start/Complete, Admin Claim/Complete,
and Operations pre-alert-only controls. Acceptance does not win the tested Opportunity.

## Failure history and bounded correction

The initial independent run on `986e088` passed DB 15/15, focused 51/51, UI 8/8,
types and lint, but Chromium passed 3/5:

1. The anonymous PDF test parsed a relative Location without a base URL. Correction
   resolves it against `response.url()` while retaining privacy assertions.
2. The positive journey's exact implicit-label locator stopped resolving after
   textarea input. The snapshot retained both the input and accessible textbox name.
   The correction uses the exact textbox role/name; no input-loss defect was proved.
3. Staff/customer and historical-universe contention were only source-inspected.
   New tests observe actual lock waits, unchanged state while blocked, and rejection
   of stale acceptance after a real staff version mutation.
4. Added exact Git blob/path/mode preservation for **89 migrations through 0090**,
   full existing CRM/Task function-definition equality, and ready-acceptance RPC
   output/commercial-state comparison before and after `0091`–`0092`.

One correction/proof commit, `74b9f43`, changed tests and the task log, not product
implementation. One targeted independent recheck then passed all four findings.
There are no unresolved local verification blockers. This does not claim every
historical staff workflow or the full historical-bootstrap process was rerun.

## Reproduction and retained evidence

The dedicated ignored runner `.opencode/verify-week05-runtime.mjs` binds the exact
candidate and baseline, archives the candidate into fresh external scratch, copies
cached dependencies and runs PostgreSQL with per-run labels, no pulls and no network.
Its exact commands were `preflight` then `run` for the initial candidate, followed
by `preflight` then `recheck` for the corrected candidate. It refuses a changed HEAD;
do not treat a later checkout as the same verified candidate.

Current database command:

```bash
RUN_CUSTOMER_QUOTES_DB_TESTS=1 RUN_CUSTOMER_IDENTITY_DB_TESTS=1 \
node --conditions react-server --import tsx --test --test-concurrency=1 \
  tests/customer-quote-read-runtime.test.ts \
  tests/customer-quote-actions-runtime.test.ts \
  tests/customer-identity-runtime.test.ts
```

Current browser command, **only inside the runner's isolated environment**, with
the committed `tests/helpers/customer-quote-http-fixture.ts` running on loopback
and `RUN_CUSTOMER_QUOTES_BROWSER_TESTS=1`:

```bash
node_modules/.bin/playwright test e2e/customer-portal.spec.ts \
  e2e/customer-quotes.spec.ts e2e/customer-quote-journey.spec.ts --project=chromium
```

Without that explicit environment, the positive fixture-dependent spec is skipped
rather than contacting a hosted service. It was enabled and passed in the evidence
above. All exact child commands, durations and individual log hashes are in receipts.

Local ignored evidence is retained under `.opencode/verification/week05/initial/`
and `recheck/`: receipt, input manifest and logs; the initial fixture sources and
corrected runner are retained as well. Both original disposable scratch trees were
removed only after verifying the retained receipt/log/input hashes. Receipt paths
inside the original JSON still identify those historical scratch locations.

| Artifact | SHA-256 |
|---|---|
| Initial receipt | `e89743649e744299753c00d32832671f22f06bb68fbf357d9b46ab190028e6ee` |
| Current receipt | `df8476248d2195df73caf96b61c77bfa73e2f30e5cf757a8db83ca0ece142cd8` |
| Current input manifest | `f5b22807f342986a8d015eae917f519ba111998ccb7787c6eaffa991c5ba226c` |
| Current runner | `f7ffea238711b766a7ac690c2742d639448b98fb2fdf53ab1a0b1ecc72580580` |
| Preserved migration manifest | `0fc611eca749a87c2d8d74b5b7d96681c54e6fd063ef4400d2b7d6b2a98b5d02` |
| Current HTTP fixture | `e0edc1c4579f11a7de212b41132283f89bbfd33cd6907606675457bdb434c01f` |
| Current positive browser journey | `71c6c0d9cbb7064bfdba417298fea294b5ebb8f34aacbedc7a90e70b9afd01d6` |

## Limits and next action

- Auth and Storage HTTP are simulated; actual application SQL/RLS runs in local
  PostgreSQL. This is not hosted GoTrue, Storage or SMTP parity.
- Staff fixture sessions use the installed SSR SDK with fixture OTP, not the
  existing staff password UI. Catalog endpoints excluded from the fixture emit
  expected 404 warnings; those warnings do not establish application regressions.
- Production approved legal terms must still be supplied by an Admin. No legal
  copy was invented, and acceptance remains gated until approved terms exist.
- No hosted migrations, production data changes, deployment, merge or push occurred.
  RDD stayed explicitly off; normal commit hooks were not bypassed.

Next action requires separate authorization for Git delivery or the next week.
Local verification is complete; no additional approval/review receipt is invented.
