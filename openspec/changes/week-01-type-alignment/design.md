# Design: Week 01 Generated Type Alignment

## Technical Approach

Verify the tracked generated file is already the fixed snapshot, then leave it
untouched. Add a local `QuoteCurrencyNullabilityOverlay` and apply it only to the
`crm_quote_page` and `crm_quote_detail` row aliases. Move the semantic assertion
to that overlay boundary and remove only the stale generated-comment assertion.
The parent Week 01 gate remains `BLOCKED`.

## Architecture Decisions

| Decision | Alternatives considered | Rationale |
|---|---|---|
| Exact snapshot preservation plus boundary overlay | regeneration, hand edits to generated output, casts in mappers | Keeps generated identity while representing SQL nullable fields safely in application code. |
| Hash/mode guards before and after each boundary | Path-only checks | Prevents overwriting unrelated work and detects build/tool drift. |
| No normalization | LF conversion, trimming, prettier | “Exact bytes” includes line endings, final LF, encoding, size, and mode. |
| Generated identity, not authored budget | Treating declarations as authored lines | The complete generated diff must be reviewed and rollback-accounted, but does not represent authored work. |

## Data Flow

fixed snapshot identity check → nullable application overlay → mapper/contract boundary
→ compiler, contract, lint, build, and quote tests.

## Implementation File Changes

| File | Action | Description |
|---|---|---|
| `lib/supabase/database.types.ts` | Preserve | Exact aligned generated payload; no edit. |
| `lib/admin/quotes.ts` | Modify | Nullable overlay for two quote read RPC rows. |
| `tests/quotes-foundation-contract.test.ts` | Modify | Assert nullability at overlay boundary. |
| `tests/quote-registration-intents-contract.test.ts` | Modify | Replace stale generated-comment assertion only. |

The implementation source allowlist is exactly the four paths above. The generated
file and snapshot are read-only inputs; `.next/**` and
`next-env.d.ts` are build-owned temporary surfaces.

## Interfaces / Contracts

Preimage: target mode `100644`, SHA-256
`3ed53c0da5eb7baf54463e62a756ab040a8a39a4d6b7d3e7e1352fb432f93436`.
Postimage: mode `100644`, 113159 bytes, 3697 LF lines, SHA-256
`b6e3ea6876dd32c1e817d9f9f8ff7b28571a75ed5b29fd2faa5e10449b492637`.

Procedure (do not run as part of design): verify the fixed snapshot and tracked
target bytes/hash/mode/line count; abort before source edits on any mismatch.
Never copy, normalize, format, regenerate, or otherwise modify the generated file.

## Testing Strategy

Before copy, with the captured clean-worktree preimage, run the diagnostic and
guard contract suite:

```bash
node scripts/captured-type-tsc.mjs
npm run test:captured-type-tsc
```

After copy, run the direct consumer/compiler ledger (the CLI diagnostic is not
rerun because its contract intentionally rejects a changed worktree):

```bash
npx tsc --noEmit --incremental false
npm run lint
node --import tsx --test tests/quote-pdf-creation-cutover-contract.test.ts tests/quote-transaction-rpc-contract.test.ts tests/quote-registration-intents-contract.test.ts tests/quotes-foundation-contract.test.ts tests/quote-operations-traceability.test.ts tests/quote-pdf-storage-contract.test.ts tests/crm-final-correctness.test.ts tests/catalog-admin.test.ts tests/crm-contact-360-rpc-contract.test.ts tests/lead-delete.test.ts
E2E_DISABLE_EXTERNAL_BOUNDARIES=1 npm run build
npm run test:quote-notifications
```

The captured suite must report its existing compatible status; it is not proof of
the post-copy build. Contract or consumer failure is `BLOCKED`, with no source fix.
For the direct contract suite, preserve the exact pre-copy failure names, messages,
and hashes and compare them with the post-copy result. Only identical pre-existing
server-only harness failures may be labeled differential warnings; any new or
changed failure remains `BLOCKED`.

The build guard records `next-env.d.ts` mode/hash/bytes before build and attributes
any rewrite to that command only when the path was still at the captured preimage
when the command began and remains at the captured command postimage before
cleanup. Such an exact command-owned rewrite may be restored to the pre-build
bytes, mode/hash rechecked, and the build may still pass. A collision with
`.next/dev/types/routes.d.ts`, unknown `next-env.d.ts` bytes, a concurrent change,
or failed restoration/verification is `BLOCKED`; never accept a generated
`next-env.d.ts` delta or restore unrelated paths. Build output is disposable and
must not be committed.

## Semantic Diff and Evidence

Record pre/post target identities, Git HEAD, baseline status, source identity, mode,
bytes, LF lines, and the exact binary copy result. The semantic ledger must classify
only: generated declaration additions (1105), generated declaration removals (765),
structural table/function/type contract changes, and formatting/line-ending changes
(must be zero). Record 2238 unified-diff lines and stable patch identity from
`git diff --no-ext-diff --no-textconv --binary -- lib/supabase/database.types.ts | sha256sum`.
Review all generated lines under generated identity; authored-line budget excludes
them.

Status accounting starts from an exact captured baseline. The only permitted
implementation-source delta is the target path; the ignored snapshot may be read
but not changed, and planning/progress artifacts remain evidence rather than
implementation targets. Pre-existing unrelated dirty paths are allowed only when
their exact state is captured and remains unchanged at every boundary.
`next-env.d.ts` must return to its captured identity, but an exact command-owned
rewrite restored and verified as above does not prevent PASS. Any new unexpected
path, changed unrelated baseline path, collision, unknown bytes, source drift, mode
drift, diagnostic, external-boundary attempt, or command failure is a stop
condition.

## Rollback / Migration

No migration or rollout. First preflight every rollback target without writing:
the generated target must match its recorded postimage, and a command-owned
`next-env.d.ts` rewrite, when present, must match its recorded command postimage.
If either rollback target has collided or has unknown bytes, stop `BLOCKED` before
restoration. Otherwise rollback always restores the exact generated type preimage
bytes/mode and the exact captured `next-env.d.ts` preimage when that command changed
it, then verifies both identities. Captured unchanged unrelated dirty paths and
other unrelated paths never stop this rollback and are never touched. No Week 01
closure, provenance, recovery, or `0061+` authorization is inferred.

## Open Questions

None. Only the named nullable overlay and the two named contract-test corrections
are authorized; any other application/test need is a follow-up child.
