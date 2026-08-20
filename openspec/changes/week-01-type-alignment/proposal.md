# Proposal: Week 01 Generated Type Alignment

## Intent

Align consumers with the already verified tracked Supabase snapshot through the
minimum application-owned nullable overlay required by the live quote RPC
contract. This remains an isolated child slice; the Week 01 parent remains
`BLOCKED`.

## Scope

### In Scope
- Preserve the already aligned `lib/supabase/database.types.ts` exact snapshot bytes.
- Add only the `crm_quote_page` and `crm_quote_detail` currency nullability overlay in `lib/admin/quotes.ts`.
- Move the semantic nullability contract to the overlay/mapper boundary and remove only the stale generated-comment assertion.
- Run the bounded validation ledger and review generated changes as generated identity.
- Capture and preserve any pre-existing unrelated dirty paths without changing them.

### Out of Scope
- Generation, Supabase/provider operations, migrations, package/config changes, and app/test source edits beyond the two named contract corrections.
- Fresh provenance, recovery readiness, `0061+` authorization, or Week 01 closure.

## Capabilities

### New Capabilities
- None.

### Modified Capabilities
- `baseline-reconciliation`: permit only this guarded tracked generated-type alignment and require broader consumer validation without weakening historical/provenance gates.

## Approach

Authorize no generated payload change: verify the tracked file remains the fixed
snapshot byte-for-byte. Its identity is
`lib/supabase/database.types.ts`, mode `100644`, SHA-256
`3ed53c0da5eb7baf54463e62a756ab040a8a39a4d6b7d3e7e1352fb432f93436`.
The preserved identity MUST be mode `100644`, 113159 bytes, 3697 LF lines, SHA-256
`b6e3ea6876dd32c1e817d9f9f8ff7b28571a75ed5b29fd2faa5e10449b492637`, from
`tmp/audit-evidence/baseline-reconcile-remote-types.ts`. Record the exact
semantic diff ledger (1105 additions, 765 deletions, 2238 unified-diff lines
as the verified comparison) and its stable patch/hash identity.

Required checks: captured-type diagnostic and direct generated-type contract
suite, direct `tsc --noEmit`, lint, guarded build, and quote notifications. The
direct contract suite is run once on the exact target preimage and once after
alignment; an unchanged server-only harness-only failure may be recorded as
pre-existing, but any new or changed failure blocks.
Build may use the existing local environment read-only, with external
boundaries disabled. An exact command-owned `next-env.d.ts` rewrite may be
restored to its captured preimage and the check may still pass. A collision,
unknown bytes, or failed restoration/verification is `BLOCKED`. Any source edit
outside the named allowlist is `BLOCKED` and must become a follow-up child.

The implementation source allowlist is exactly `lib/supabase/database.types.ts`,
`lib/admin/quotes.ts`, `tests/quotes-foundation-contract.test.ts`, and
`tests/quote-registration-intents-contract.test.ts`. Planning and progress
artifacts record evidence only.

## Affected Areas

| Area | Impact | Description |
|---|---|---|
| `lib/supabase/database.types.ts` | Preserved | Exact aligned generated snapshot; no edit permitted |
| `lib/admin/quotes.ts` | Modified | Minimum nullable overlay for page/detail currency fields |
| quote contract tests | Modified | Boundary assertion and stale generated-comment correction |
| `scripts/captured-type-tsc.mjs`, quote/generated-type tests | Read-only validation | Required evidence only |

## Risks

| Risk | Likelihood | Mitigation |
|---|---|---|
| Snapshot breaks consumers | Med | Fail closed; no app edits in this slice |
| Preimage or mode drift | Med | Exact identity guards; abort before copy |

## Rollback Plan

Preflight every rollback target against its recorded command-owned postimage.
Unless the generated type target or an exact command-owned `next-env.d.ts`
rewrite has collided, always restore the generated type preimage and, when
present, the captured `next-env.d.ts` preimage, then verify both. Stop only for a
rollback-target collision. Never touch unrelated dirty paths; their captured,
unchanged presence does not block rollback.

## Dependencies

- Fixed captured snapshot and its verified identity must remain unchanged.

## Success Criteria

- [ ] Exact pre/post identities and semantic diff ledger verify; no implementation-source path outside the exact allowlist changes, and captured unrelated dirty paths remain unchanged.
- [ ] All required checks pass with no provider mutation or external traffic.
- [ ] Generated-line review is included in identity/rollback accounting but excluded from authored-line budget.
- [ ] Any consumer failure or unexpected app edit need is recorded as `BLOCKED`.
